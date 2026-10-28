import assert from 'node:assert';
import {
  formatSRTTime,
  formatVTTTime,
  buildSegmentsFromWords,
  generateVTTContent,
  generateSRTContent,
  generateJSONContent,
  checkSpeechConfigStatus,
} from './src/speech.js';
import { SubtitleWord } from './src/types.js';

console.log('--- Iniciando Testes Automatizados do Módulo de Legendas ---');

// Teste 1: Formatação de tempo SRT
console.log('Teste 1: formatSRTTime');
assert.strictEqual(formatSRTTime(0), '00:00:00,000');
assert.strictEqual(formatSRTTime(1.234), '00:00:01,234');
assert.strictEqual(formatSRTTime(65.5), '00:01:05,500');
assert.strictEqual(formatSRTTime(3665.05), '01:01:05,050');
console.log('✓ formatSRTTime passou em todos os casos');

// Teste 2: Formatação de tempo VTT
console.log('Teste 2: formatVTTTime');
assert.strictEqual(formatVTTTime(0), '00:00:00.000');
assert.strictEqual(formatVTTTime(1.234), '00:00:01.234');
assert.strictEqual(formatVTTTime(65.5), '00:01:05.500');
assert.strictEqual(formatVTTTime(3665.05), '01:01:05.050');
console.log('✓ formatVTTTime passou em todos os casos');

// Teste 3: Agrupamento de palavras em segmentos de legendas
console.log('Teste 3: buildSegmentsFromWords');
const mockWords: SubtitleWord[] = [
  { word: 'Olá', start: 0.5, end: 0.8 },
  { word: 'pessoal,', start: 0.9, end: 1.3 },
  { word: 'bem-vindos', start: 1.4, end: 1.8 },
  { word: 'ao', start: 1.9, end: 2.0 },
  { word: 'Clipo.', start: 2.1, end: 2.5 },
  // Pausa grande de 1.5 segundos
  { word: 'Hoje', start: 4.0, end: 4.3 },
  { word: 'vamos', start: 4.4, end: 4.7 },
  { word: 'aprender', start: 4.8, end: 5.2 },
  { word: 'a', start: 5.3, end: 5.4 },
  { word: 'cortar', start: 5.5, end: 5.8 },
  { word: 'vídeos.', start: 5.9, end: 6.3 },
];

const segments = buildSegmentsFromWords(mockWords, '', 6.5);
assert.strictEqual(segments.length, 2, 'Deve quebrar em 2 segmentos devido à pontuação e pausa');
assert.strictEqual(segments[0].id, 1);
assert.strictEqual(segments[0].text, 'Olá pessoal, bem-vindos ao Clipo.');
assert.strictEqual(segments[1].id, 2);
assert.strictEqual(segments[1].text, 'Hoje vamos aprender a cortar vídeos.');
console.log('✓ buildSegmentsFromWords agrupou e quebrou corretamente nos pontos naturais');

// Teste 4: Geração de WebVTT
console.log('Teste 4: generateVTTContent');
const vtt = generateVTTContent(segments);
assert.ok(vtt.startsWith('WEBVTT\n\n'), 'VTT deve iniciar com cabeçalho WEBVTT');
assert.ok(vtt.includes('00:00:00.500 --> 00:00:02.500'), 'VTT deve conter timestamps formatados');
assert.ok(vtt.includes('Olá pessoal, bem-vindos ao Clipo.'), 'VTT deve conter o texto do segmento 1');
console.log('✓ generateVTTContent gerou sintaxe WebVTT válida');

// Teste 5: Geração de SubRip SRT
console.log('Teste 5: generateSRTContent');
const srt = generateSRTContent(segments);
assert.ok(srt.includes('1\n00:00:00,500 --> 00:00:02,500'), 'SRT deve conter numeração e vírgula nos millis');
assert.ok(srt.includes('2\n00:00:04,000 --> 00:00:06,300'), 'SRT deve conter segundo bloco');
console.log('✓ generateSRTContent gerou sintaxe SubRip SRT válida');

// Teste 6: Geração de JSON estruturado
console.log('Teste 6: generateJSONContent');
const jsonStr = generateJSONContent(segments, 'pt-BR', 6.5, 'Olá pessoal, bem-vindos ao Clipo. Hoje vamos aprender a cortar vídeos.');
const parsed = JSON.parse(jsonStr);
assert.strictEqual(parsed.language, 'pt-BR');
assert.strictEqual(parsed.duration, 6.5);
assert.strictEqual(parsed.stats.segmentsCount, 2);
assert.strictEqual(parsed.stats.wordsCount, 11);
assert.strictEqual(parsed.segments[0].words.length, 5);
console.log('✓ generateJSONContent gerou estrutura JSON válida e completa com estatísticas');

// Teste 7: Diagnóstico de configuração Speech
console.log('Teste 7: checkSpeechConfigStatus');
const status = checkSpeechConfigStatus();
assert.strictEqual(typeof status.isConfigured, 'boolean');
assert.strictEqual(typeof status.details, 'string');
console.log(`✓ checkSpeechConfigStatus respondeu limpo (isConfigured: ${status.isConfigured}, details: "${status.details}")`);

console.log('--- TODOS OS 7 TESTES AUTOMATIZADOS DO MÓDULO DE LEGENDAS PASSARAM COM SUCESSO! ---');
