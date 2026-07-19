import  type { IEngine } from "@lopoly/engine/Engine";

export interface AudioClipOptions {
  loop?: boolean;
}

export class AudioClip {
  public readonly buffer: AudioBuffer;
  public loop: boolean;

  private constructor(buffer: AudioBuffer, options?: AudioClipOptions) {
    this.buffer = buffer;
    this.loop = options?.loop ?? false;
  }

  public static async load(engine: IEngine, path: string, options?: AudioClipOptions): Promise<AudioClip> {
    const audioFile = await engine.fileSystem.readFile(path);
    const buffer = await engine.audioSystem.context.decodeAudioData(audioFile.bytes.buffer);
    return new AudioClip(buffer, options);
  }

  public get length(): number {
    return this.buffer.duration;
  }
}
