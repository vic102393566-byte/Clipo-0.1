import speech from '@google-cloud/speech';
import fs from 'node:fs';
import path from 'node:path';
import { ChildProcess } from 'node:child_process';
import { SubtitleSegment, SubtitleWord, SubtitleFilesResult } from './types.js';
import { extractAudioForSpeech, extractAudioChunk } from './ffmpeg.js';

let speechClientInstance: speech.SpeechClient | null = null;

/**
 * Cria ou recupera a instância do cliente Speech-to-Text do Google Cloud
 */
export function getSpeechClient(): speech.SpeechClient {
  if (speechClientInstance) {
    return speechClientInstance;
  }

  // Opção 1: Credenciais passadas como JSON em variável de ambiente (prático para Cloud Run/Vercel)
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      speechClientInstance = new speech.SpeechClient({ credentials });
      return speechClientInstance;
    } catch (parseErr: any) {
      throw new Error(`Erro ao ler GOOGLE_CREDENTIALS_JSON: ${parseErr.message}`);
    }
  }

  // Opção 2: Chave de API Google Speech (se configurada)
  const apiKey = process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_API_KEY;
  if (apiKey) {
    speechClientInstance = new speech.SpeechClient({ apiKey });
    return speechClientInstance;
  }

  // Opção 3: Application Default Credentials (ADC) nativo do Google Cloud Run
  // ou GOOGLE_APPLICATION_CREDENTIALS apontando para arquivo
  speechClientInstance = new speech.SpeechClient();
  return speechClientInstance;
}

/**
 * Verifica se existem credenciais ou ambiente do Google Cloud configurado
 */
export function checkSpeechConfigStatus(): { isConfigured: boolean; details: string } {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return { isConfigured: true, details: 'GOOGLE_CREDENTIALS_JSON fornecida' };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return { isConfigured: true, details: `Arquivo de credenciais: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}` };
  }
  if (process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_API_KEY) {
    return { isConfigured: true, details: 'Chave de API do Google fornecida' };
  }
  if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT) {
    return { isConfigured: true, details: 'Google Cloud Run Service Account (ADC nativo)' };
  }

  return {
    isConfigured: false,
    details: 'Nenhuma credencial Google Cloud (ADC, GOOGLE_CREDENTIALS_JSON ou GOOGLE_APPLICATION_CREDENTIALS) encontrada.',
  };
}

/**
 * Converte protobuf Duration para segundos com casas decimais
 */
function durationToSeconds(duration?: any): number {
  if (!duration) return 0;
  let secs = 0;
  if (
    typeof duration.seconds === 'object' &&
    duration.seconds !== null &&
    typeof duration.seconds.toNumber === 'function'
  ) {
    secs = duration.seconds.toNumber();
  } else if (typeof duration.seconds === 'string') {
    secs = parseInt(duration.seconds, 10) || 0;
  } else if (typeof duration.seconds === 'number') {
    secs = duration.seconds;
  }
  const nanos = Number(duration.nanos || 0);
  return secs + nanos / 1e9;
}

/**
 * Transcreve um único bloco de áudio FLAC de até 50 segundos com Google Cloud Speech-to-Text
 */
async function transcribeAudioBlock(
  audioPath: string,
  languageCode: string = 'pt-BR',
  timeOffsetSec: number = 0
): Promise<{ text: string; words: SubtitleWord[] }> {
  const client = getSpeechClient();
  const audioBytes = await fs.promises.readFile(audioPath);

  const request = {
    audio: {
      content: audioBytes.toString('base64'),
    },
    config: {
      encoding: 'FLAC' as const,
      sampleRateHertz: 16000,
      languageCode,
      enableWordTimeOffsets: true,
      enableAutomaticPunctuation: true,
      model: 'default',
    },
  };

  try {
    const [response] = await client.recognize(request);
    const results = response.results || [];

    const words: SubtitleWord[] = [];
    const transcripts: string[] = [];

    for (const res of results) {
      const topAlt = res.alternatives?.[0];
      if (!topAlt) continue;

      if (topAlt.transcript) {
        transcripts.push(topAlt.transcript.trim());
      }

      if (topAlt.words && topAlt.words.length > 0) {
        for (const w of topAlt.words) {
          const wStart = durationToSeconds(w.startTime) + timeOffsetSec;
          const wEnd = durationToSeconds(w.endTime) + timeOffsetSec;
          words.push({
            word: (w.word || '').trim(),
            start: Math.round(wStart * 1000) / 1000,
            end: Math.round(Math.max(wStart + 0.1, wEnd) * 1000) / 1000,
            confidence: topAlt.confidence || 1.0,
          });
        }
      }
    }

    return {
      text: transcripts.join(' '),
      words,
    };
  } catch (err: any) {
    const msg = err.message || '';
    if (
      msg.includes('Could not load the default credentials') ||
      msg.includes('UNAUTHENTICATED') ||
      msg.includes('credentials') ||
      err.code === 16
    ) {
      throw new Error(
        'A API Google Cloud Speech-to-Text não está autenticada no ambiente do worker. ' +
        'Configure as credenciais no Google Cloud Run (Service Account com a permissão "roles/speech.client") ' +
        'ou defina a variável GOOGLE_APPLICATION_CREDENTIALS / GOOGLE_CREDENTIALS_JSON no servidor.'
      );
    }

    if (msg.includes('API has not been used') || msg.includes('disabled')) {
      throw new Error(
        'A API Cloud Speech-to-Text precisa ser ativada no projeto Google Cloud (Console -> APIs & Services -> Enable Cloud Speech-to-Text API).'
      );
    }

    throw new Error(`Falha no Google Cloud Speech-to-Text: ${msg}`);
  }
}

/**
 * Agrupa palavras sequenciais em segmentos legíveis de legendas (linhas de 3 a 7 palavras)
 */
export function buildSegmentsFromWords(
  words: SubtitleWord[],
  fallbackText: string = '',
  totalDurationSec: number = 0
): SubtitleSegment[] {
  if (!words || words.length === 0) {
    if (!fallbackText.trim()) return [];
    // Fallback: se não houver palavras com timestamp, divide o texto em frases
    const sentences = fallbackText.split(/(?<=[.?!])\s+/).filter(Boolean);
    const durationPerSentence = totalDurationSec > 0 ? totalDurationSec / sentences.length : 3;
    return sentences.map((sent, idx) => ({
      id: idx + 1,
      start: Math.round(idx * durationPerSentence * 100) / 100,
      end: Math.round(Math.min(totalDurationSec, (idx + 1) * durationPerSentence) * 100) / 100,
      text: sent.trim(),
    }));
  }

  const segments: SubtitleSegment[] = [];
  let currentWords: SubtitleWord[] = [];
  let segmentId = 1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentWords.push(word);

    const isLastWord = i === words.length - 1;
    const nextWord = !isLastWord ? words[i + 1] : null;

    const currentText = currentWords.map((w) => w.word).join(' ');
    const hasStrongPunctuation = /[.?!]$/.test(word.word);
    const hasSoftPunctuation = /[,;:]$/.test(word.word);
    const pauseToNext = nextWord ? nextWord.start - word.end : 0;
    const reachedWordLimit = currentWords.length >= 6;
    const reachedCharLimit = currentText.length >= 40;

    // Critérios para quebrar o segmento de legenda:
    // 1. Fim do áudio
    // 2. Pausa natural maior que 0.65 segundo
    // 3. Pontuação forte (.?!)
    // 4. Pontuação suave (,;:) com pelo menos 4 palavras ou pausa >= 0.35s
    // 5. Limite de palavras atingido
    if (
      isLastWord ||
      pauseToNext >= 0.65 ||
      hasStrongPunctuation ||
      (hasSoftPunctuation && (currentWords.length >= 4 || pauseToNext >= 0.35)) ||
      (reachedWordLimit && pauseToNext >= 0.25) ||
      reachedCharLimit
    ) {
      const segStart = currentWords[0].start;
      const segEnd = Math.max(segStart + 0.6, word.end);

      segments.push({
        id: segmentId++,
        start: Math.round(segStart * 1000) / 1000,
        end: Math.round(segEnd * 1000) / 1000,
        text: currentWords.map((w) => w.word).join(' ').trim(),
        words: [...currentWords],
      });

      currentWords = [];
    }
  }

  return segments;
}

/**
 * Formata segundos no formato SRT: HH:MM:SS,mmm
 */
export function formatSRTTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalMillis = Math.round(seconds * 1000);
  const hours = Math.floor(totalMillis / 3600000);
  const minutes = Math.floor((totalMillis % 3600000) / 60000);
  const secs = Math.floor((totalMillis % 60000) / 1000);
  const millis = totalMillis % 1000;

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    ',' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Formata segundos no formato WebVTT: HH:MM:SS.mmm
 */
export function formatVTTTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const totalMillis = Math.round(seconds * 1000);
  const hours = Math.floor(totalMillis / 3600000);
  const minutes = Math.floor((totalMillis % 3600000) / 60000);
  const secs = Math.floor((totalMillis % 60000) / 1000);
  const millis = totalMillis % 1000;

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(secs).padStart(2, '0') +
    '.' +
    String(millis).padStart(3, '0')
  );
}

/**
 * Gera o conteúdo do arquivo WebVTT (.vtt)
 */
export function generateVTTContent(segments: SubtitleSegment[]): string {
  let vtt = 'WEBVTT\n\n';

  for (const seg of segments) {
    vtt += `${seg.id}\n`;
    vtt += `${formatVTTTime(seg.start)} --> ${formatVTTTime(seg.end)}\n`;
    vtt += `${seg.text}\n\n`;
  }

  return vtt.trim() + '\n';
}

/**
 * Gera o conteúdo do arquivo SubRip (.srt)
 */
export function generateSRTContent(segments: SubtitleSegment[]): string {
  let srt = '';

  for (const seg of segments) {
    srt += `${seg.id}\n`;
    srt += `${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n`;
    srt += `${seg.text}\n\n`;
  }

  return srt.trim() + '\n';
}

/**
 * Gera o conteúdo JSON estruturado com timestamps por palavra e segmento
 */
export function generateJSONContent(
  segments: SubtitleSegment[],
  language: string,
  duration: number,
  fullText: string
): string {
  const totalWords = segments.reduce((acc, s) => acc + (s.words?.length || 0), 0);

  const data = {
    generator: 'Clipo Video Worker (Google Cloud Speech-to-Text)',
    language,
    duration: Math.round(duration * 100) / 100,
    generatedAt: new Date().toISOString(),
    fullText,
    stats: {
      segmentsCount: segments.length,
      wordsCount: totalWords,
    },
    segments,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Orquestra todo o processo de transcrição de áudio:
 * 1. Extração do áudio via FFmpeg
 * 2. Segmentação em chunks seguros (< 50s) para o Google Cloud Speech
 * 3. Transcrição com timestamps em pt-BR
 * 4. Geração dos arquivos .vtt, .srt e .json
 */
export async function transcribeVideoToSubtitles(
  videoPath: string,
  jobDir: string,
  totalDurationSec: number,
  languageCode: string = 'pt-BR',
  onProgress?: (progressPercent: number, status: string) => void,
  onProcessCreated?: (proc: ChildProcess) => void
): Promise<{
  vttPath: string;
  srtPath: string;
  jsonPath: string;
  fullText: string;
  segments: SubtitleSegment[];
}> {
  // 1. Extrair áudio mestre FLAC mono 16kHz
  const masterAudioPath = path.resolve(jobDir, 'master_audio.flac');
  if (onProgress) onProgress(20, 'Extraindo áudio do vídeo com FFmpeg...');

  await extractAudioForSpeech(videoPath, masterAudioPath, onProcessCreated);

  if (!fs.existsSync(masterAudioPath) || fs.statSync(masterAudioPath).size === 0) {
    throw new Error('Falha ao extrair áudio: o arquivo gerado está vazio.');
  }

  // 2. Chunks de até 45 segundos para compatibilidade total com Speech-to-Text síncrono
  const CHUNK_DURATION = 45;
  const chunkCount = Math.max(1, Math.ceil(totalDurationSec / CHUNK_DURATION));
  const allWords: SubtitleWord[] = [];
  const allTexts: string[] = [];

  for (let c = 0; c < chunkCount; c++) {
    const startSec = c * CHUNK_DURATION;
    const currentChunkDuration = Math.min(CHUNK_DURATION, totalDurationSec - startSec);

    const progress = Math.min(85, Math.round(25 + ((c + 0.5) / chunkCount) * 55));
    if (onProgress) {
      onProgress(
        progress,
        `Transcrevendo áudio com Google Speech-to-Text (${c + 1}/${chunkCount})...`
      );
    }

    const chunkAudioPath = path.resolve(jobDir, `chunk_${c}.flac`);

    if (chunkCount === 1) {
      // Vídeo curto: usa o master_audio direto
      const result = await transcribeAudioBlock(masterAudioPath, languageCode, 0);
      if (result.text) allTexts.push(result.text);
      if (result.words) allWords.push(...result.words);
    } else {
      // Vídeo longo: recorta o chunk com FFmpeg
      await extractAudioChunk(
        masterAudioPath,
        chunkAudioPath,
        startSec,
        currentChunkDuration,
        onProcessCreated
      );

      try {
        const result = await transcribeAudioBlock(chunkAudioPath, languageCode, startSec);
        if (result.text) allTexts.push(result.text);
        if (result.words) allWords.push(...result.words);
      } finally {
        if (fs.existsSync(chunkAudioPath)) {
          try {
            fs.unlinkSync(chunkAudioPath);
          } catch {}
        }
      }
    }
  }

  // Remover master_audio para poupar espaço em disco
  if (fs.existsSync(masterAudioPath)) {
    try {
      fs.unlinkSync(masterAudioPath);
    } catch {}
  }

  const fullText = allTexts.join(' ').trim();
  if (onProgress) onProgress(88, 'Agrupando palavras e sincronizando legendas...');

  // 3. Montar segmentos sincronizados
  const segments = buildSegmentsFromWords(allWords, fullText, totalDurationSec);

  // 4. Gerar arquivos .vtt, .srt e .json
  if (onProgress) onProgress(92, 'Gerando arquivos VTT, SRT e JSON...');

  const vttPath = path.resolve(jobDir, 'subtitles.vtt');
  const srtPath = path.resolve(jobDir, 'subtitles.srt');
  const jsonPath = path.resolve(jobDir, 'subtitles.json');

  const vttContent = generateVTTContent(segments);
  const srtContent = generateSRTContent(segments);
  const jsonContent = generateJSONContent(segments, languageCode, totalDurationSec, fullText);

  await fs.promises.writeFile(vttPath, vttContent, 'utf-8');
  await fs.promises.writeFile(srtPath, srtContent, 'utf-8');
  await fs.promises.writeFile(jsonPath, jsonContent, 'utf-8');

  return {
    vttPath,
    srtPath,
    jsonPath,
    fullText,
    segments,
  };
}
