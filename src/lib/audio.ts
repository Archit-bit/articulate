/*
 * Microphone capture (→ 16 kHz 16-bit mono PCM) and PCM playback.
 * Gemini wants 16 kHz PCM in and sends 24 kHz PCM back (Live API).
 */

const WORKLET_SRC = `
class ArticulateCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('articulate-capture', ArticulateCapture);
`;

export const TARGET_RATE = 16000;

export class Mic {
  onChunk?: (pcm: Int16Array) => void;
  onLevel?: (level: number) => void;

  private ctx?: AudioContext;
  private stream?: MediaStream;
  private node?: AudioWorkletNode;
  private rest = new Float32Array(0);

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser cannot access the microphone. Use Chrome on http://localhost.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'articulate-capture');
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(this.node);
    this.node.connect(mute).connect(this.ctx.destination); // keeps the graph pulling

    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      const f = e.data;
      let sum = 0;
      for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
      this.onLevel?.(Math.min(1, Math.sqrt(sum / f.length) * 4));
      this.onChunk?.(this.downsample(f));
    };
  }

  async stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    if (this.ctx && this.ctx.state !== 'closed') await this.ctx.close();
    this.ctx = undefined;
    this.rest = new Float32Array(0);
  }

  /** Box-filter downsample from the device rate to 16 kHz, carrying leftovers between chunks. */
  private downsample(chunk: Float32Array): Int16Array {
    const ratio = (this.ctx?.sampleRate ?? TARGET_RATE) / TARGET_RATE;
    const input = new Float32Array(this.rest.length + chunk.length);
    input.set(this.rest);
    input.set(chunk, this.rest.length);
    const outLen = Math.floor(input.length / ratio);
    const out = new Int16Array(outLen);
    for (let k = 0; k < outLen; k++) {
      const s = Math.floor(k * ratio);
      const e = Math.max(s + 1, Math.min(input.length, Math.floor((k + 1) * ratio)));
      let sum = 0;
      for (let i = s; i < e; i++) sum += input[i];
      const v = Math.max(-1, Math.min(1, sum / (e - s)));
      out[k] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    this.rest = input.slice(Math.floor(outLen * ratio));
    return out;
  }
}

/** Records a take for the scorecard drills. */
export class TakeRecorder {
  private mic = new Mic();
  private chunks: Int16Array[] = [];
  private startedAt = 0;

  set onLevel(fn: ((l: number) => void) | undefined) {
    this.mic.onLevel = fn;
  }

  async start() {
    this.chunks = [];
    this.mic.onChunk = (c) => this.chunks.push(c);
    await this.mic.start();
    this.startedAt = performance.now();
  }

  async stop() {
    await this.mic.stop();
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const pcm = new Int16Array(total);
    let o = 0;
    for (const c of this.chunks) {
      pcm.set(c, o);
      o += c.length;
    }
    const wav = encodeWav(pcm, TARGET_RATE);
    return {
      blob: new Blob([wav], { type: 'audio/wav' }),
      base64: bytesToBase64(new Uint8Array(wav)),
      durationSec: Math.max(total / TARGET_RATE, (performance.now() - this.startedAt) / 1000 - 0.2),
    };
  }

  async cancel() {
    await this.mic.stop();
    this.chunks = [];
  }
}

/** Gapless playback of streamed PCM chunks, with instant stop for interruptions. */
export class PcmPlayer {
  private ctx = new AudioContext();
  private next = 0;
  private sources = new Set<AudioBufferSourceNode>();
  /** Seconds of audio received from the model (for the cost estimate). */
  receivedSec = 0;

  async resume() {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  play(base64: string, rate = 24000) {
    const bytes = base64ToBytes(base64);
    const i16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (!i16.length) return;
    const f = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32768;
    this.receivedSec += f.length / rate;
    const buf = this.ctx.createBuffer(1, f.length, rate);
    buf.copyToChannel(f, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const t = Math.max(this.ctx.currentTime + 0.03, this.next);
    src.start(t);
    this.next = t + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  get speaking() {
    return this.ctx.currentTime < this.next;
  }

  interrupt() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.sources.clear();
    this.next = 0;
  }

  async close() {
    this.interrupt();
    if (this.ctx.state !== 'closed') await this.ctx.close();
  }
}

// ---- encoding helpers ----------------------------------------------------

export function encodeWav(pcm: Int16Array, rate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, pcm.length * 2, true);
  new Int16Array(buf, 44).set(pcm);
  return buf;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function pcmToBase64(pcm: Int16Array): string {
  return bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}
