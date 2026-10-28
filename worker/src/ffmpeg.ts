import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { VideoProbeResult } from './types.js';

export function formatDurationHelper(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSizeHelper(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Safely kills a child process and its process tree
 */
export function killProcessTree(proc?: ChildProcess): void {
  if (!proc || proc.killed || !proc.pid) return;

  try {
    if (process.platform === 'win32') {
      proc.kill('SIGKILL');
    } else {
      // On POSIX, kill process group using negative PID
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch (groupErr: any) {
        if (groupErr.code !== 'ESRCH') {
          proc.kill('SIGKILL');
        }
      }
    }
  } catch (err: any) {
    if (err.code !== 'ESRCH') {
      console.warn('[Worker Process] Erro ao encerrar processo FFmpeg:', err.message);
    }
  }
}

/**
 * Inspect video properties using ffprobe (via spawn with separate arguments)
 */
export function probeVideoDetails(filePath: string): Promise<VideoProbeResult> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Arquivo para inspeção não existe: ${filePath}`));
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return reject(new Error('Arquivo de vídeo está vazio (0 bytes).'));
    }

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    const child = spawn('ffprobe', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;

    // Timeout de 20s para evitar travamento em arquivos corrompidos
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
      reject(new Error('Tempo limite excedido ao inspecionar vídeo com ffprobe (timeout de 20s).'));
    }, 20000);

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) {
        reject(new Error(`Falha ao iniciar ffprobe: ${err.message}`));
      }
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        return reject(
          new Error(`ffprobe encerrou com código ${code}: ${stderrData || 'Erro desconhecido'}`)
        );
      }

      try {
        const data = JSON.parse(stdoutData);
        const streams: any[] = data.streams || [];
        const videoStream = streams.find((s) => s.codec_type === 'video');
        const audioStream = streams.find((s) => s.codec_type === 'audio');

        let rawDuration = parseFloat(data.format?.duration);
        if (isNaN(rawDuration) || rawDuration <= 0) {
          rawDuration = parseFloat(videoStream?.duration);
        }

        if (!videoStream) {
          return reject(new Error('Nenhum stream de vídeo válido encontrado no arquivo.'));
        }

        if (isNaN(rawDuration) || rawDuration <= 0) {
          return reject(new Error('Duração do vídeo não pôde ser determinada pelo ffprobe.'));
        }

        const result: VideoProbeResult = {
          duration: rawDuration,
          hasVideo: true,
          hasAudio: Boolean(audioStream),
          videoCodec: videoStream.codec_name || 'desconhecido',
          audioCodec: audioStream?.codec_name || 'nenhum',
          width: videoStream.width,
          height: videoStream.height,
          fileSizeBytes: stat.size,
        };

        resolve(result);
      } catch (parseErr: any) {
        reject(new Error(`Erro ao interpretar saída do ffprobe: ${parseErr.message}`));
      }
    });
  });
}

/**
 * Cuts a video segment with high compatibility settings using spawn and separate arguments
 * Process is detached so the entire process group can be cleanly killed if cancelled.
 */
export function cutVideoSegment(
  inputPath: string,
  outputPath: string,
  startSec: number,
  durationSec: number,
  onProcessCreated?: (process: ChildProcess) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Formato com argumentos separados (sem interpolação de shell)
    const args = [
      '-y',
      '-ss', startSec.toString(),
      '-i', inputPath,
      '-t', durationSec.toString(),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-movflags', '+faststart',
      outputPath,
    ];

    const child = spawn('ffmpeg', args, {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderrData = '';
    let wasErrorHandled = false;

    if (onProcessCreated) {
      onProcessCreated(child);
    }

    child.stderr?.on('data', (chunk) => {
      // Manter apenas últimas linhas do stderr para diagnóstico sem estourar memória
      stderrData = (stderrData + chunk.toString()).slice(-4000);
    });

    child.on('error', (err) => {
      wasErrorHandled = true;
      reject(new Error(`Falha ao executar FFmpeg: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (wasErrorHandled) return;

      if (signal === 'SIGKILL' || signal === 'SIGTERM') {
        return reject(new Error('Processamento FFmpeg interrompido intencionalmente (cancelamento).'));
      }

      if (code !== 0) {
        return reject(
          new Error(`FFmpeg falhou com código ${code}: ${stderrData || 'Erro desconhecido na renderização'}`)
        );
      }

      resolve();
    });
  });
}

/**
 * Extracts a thumbnail from the video using spawn
 */
export function extractThumbnail(
  videoPath: string,
  thumbPath: string,
  seekSec: number = 0.5
): Promise<void> {
  return new Promise((resolve) => {
    const args = [
      '-y',
      '-ss', seekSec.toString(),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      thumbPath,
    ];

    const child = spawn('ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderrData = '';

    child.stderr?.on('data', (chunk) => {
      stderrData = (stderrData + chunk.toString()).slice(-2000);
    });

    child.on('error', (err) => {
      console.warn(`[Aviso Thumbnail] Erro ao iniciar ffmpeg para miniatura: ${err.message}`);
      resolve();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`[Aviso Thumbnail] FFmpeg miniatura retornou código ${code}: ${stderrData}`);
      }
      resolve();
    });
  });
}

/**
 * Extrai o áudio completo do vídeo para formato FLAC mono 16kHz otimizado para Speech-to-Text
 */
export function extractAudioForSpeech(
  videoPath: string,
  outputAudioPath: string,
  onProcessCreated?: (process: ChildProcess) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', videoPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'flac',
      outputAudioPath,
    ];

    const child = spawn('ffmpeg', args, {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderrData = '';
    let wasErrorHandled = false;

    if (onProcessCreated) {
      onProcessCreated(child);
    }

    child.stderr?.on('data', (chunk) => {
      stderrData = (stderrData + chunk.toString()).slice(-3000);
    });

    child.on('error', (err) => {
      wasErrorHandled = true;
      reject(new Error(`Falha ao extrair áudio com FFmpeg: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (wasErrorHandled) return;

      if (signal === 'SIGKILL' || signal === 'SIGTERM') {
        return reject(new Error('Extração de áudio interrompida intencionalmente (cancelamento).'));
      }

      if (code !== 0) {
        return reject(
          new Error(`FFmpeg falhou ao extrair áudio (código ${code}): ${stderrData || 'Erro desconhecido'}`)
        );
      }

      resolve();
    });
  });
}

/**
 * Extrai um pedaço (chunk) de áudio de no máximo X segundos para o Speech-to-Text síncrono
 */
export function extractAudioChunk(
  inputAudioPath: string,
  outputChunkPath: string,
  startSec: number,
  durationSec: number,
  onProcessCreated?: (process: ChildProcess) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', startSec.toString(),
      '-i', inputAudioPath,
      '-t', durationSec.toString(),
      '-c:a', 'flac',
      outputChunkPath,
    ];

    const child = spawn('ffmpeg', args, {
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderrData = '';
    let wasErrorHandled = false;

    if (onProcessCreated) {
      onProcessCreated(child);
    }

    child.stderr?.on('data', (chunk) => {
      stderrData = (stderrData + chunk.toString()).slice(-2000);
    });

    child.on('error', (err) => {
      wasErrorHandled = true;
      reject(new Error(`Falha ao recortar chunk de áudio: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      if (wasErrorHandled) return;

      if (signal === 'SIGKILL' || signal === 'SIGTERM') {
        return reject(new Error('Recorte de áudio cancelado intencionalmente.'));
      }

      if (code !== 0) {
        return reject(
          new Error(`FFmpeg falhou no chunk de áudio (código ${code}): ${stderrData || 'Erro desconhecido'}`)
        );
      }

      resolve();
    });
  });
}
