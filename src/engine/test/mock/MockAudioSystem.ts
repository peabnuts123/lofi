
import { AudioContext as MockAudioContext } from "standardized-audio-context-mock";
import type { IAudioNode, IAudioContext, GainNode } from "standardized-audio-context";

import type { IAudioSystem, PlayAudioResult } from "@lofi/engine/audio";
import type { IEngine } from "@lofi/engine/Engine";
import type { AudioSourceNode } from "@lofi/engine/scene/nodes";

export class MockAudioSystem implements IAudioSystem {
  public readonly context: IAudioContext;
  public readonly master: GainNode<IAudioContext>;
  public readonly isInitialised: boolean = true;

  public constructor() {
    this.context = new MockAudioContext();
    this.master = this.context.createGain();
  }

  playAudio(_audioSource: AudioSourceNode, _priority: number, _audioNode: IAudioNode<IAudioContext>): PlayAudioResult {
    return [false];
  }
  destroy(): void {
    /* @NOTE No-op */
  }
  onUpdate(_engine: IEngine): void {
    /* @NOTE No-op */
  }
}
