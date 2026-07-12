// Диктофон, который пишет микрофон в WAV (16 кГц, моно, 16 бит).
//
// Почему не MediaRecorder: в Telegram WebView (особенно iOS/WKWebView) набор
// поддерживаемых контейнеров непредсказуем (webm/opus vs mp4/aac), а Gemini
// через OpenRouter принимает только wav/mp3. Сырой PCM через AudioContext
// работает одинаково везде, где есть getUserMedia, и кодируется в WAV на месте.

const TARGET_SAMPLE_RATE = 16000;
export const MAX_RECORDING_SECONDS = 60;

export class WavRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private inputSampleRate = 48000;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    this.audioContext = new AudioContext();
    // iOS может создать контекст в suspended-состоянии даже после жеста.
    if (this.audioContext.state === "suspended") await this.audioContext.resume();

    this.inputSampleRate = this.audioContext.sampleRate;
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    // ScriptProcessorNode устарел, но AudioWorklet требует отдельного файла
    // модуля, который капризно грузится в Telegram WebView. Для записи голоса
    // задержка обработчика не важна.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.chunks = [];

    const maxChunks = Math.ceil(
      (MAX_RECORDING_SECONDS * this.inputSampleRate) / 4096,
    );

    this.processor.onaudioprocess = (e) => {
      if (this.chunks.length >= maxChunks) return;
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  /** Останавливает запись и возвращает WAV-файл. */
  async stop(): Promise<Blob> {
    const samples = mergeChunks(this.chunks);
    this.cleanup();
    const downsampled = downsample(samples, this.inputSampleRate, TARGET_SAMPLE_RATE);
    return encodeWav(downsampled, TARGET_SAMPLE_RATE);
  }

  cancel(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close().catch(() => {});
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.audioContext = null;
    this.chunks = [];
  }
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const result = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), samples.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    result[i] = end > start ? sum / (end - start) : 0;
  }
  return result;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // моно
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
