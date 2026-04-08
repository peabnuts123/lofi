import { type IAudioContext, GainNode, PannerNode, AudioBufferSourceNode } from 'standardized-audio-context';

import { clamp01 } from "@lofi/core/math/util";
import { Vector3 } from "@lofi/core/math/vector";
import type { AudioClip } from "@lofi/engine/audio/AudioClip";
import type { IAudioSystem } from "@lofi/engine/audio/AudioSystem";
import { SceneNode, type IScene } from "@lofi/engine/scene";

export interface SpatialAudioSourceNodeOptions {
}
export interface GlobalAudioSourceNodeOptions {
  global: true;
}

export interface PlayClipOptions {
  priority?: number;
  speed?: number;
  speedRange?: number;
}

export interface CurrentAudio {
  audioClip: AudioClip;
  audioNode: AudioBufferSourceNode<IAudioContext>;
  onStop: () => void;
}

/**
 * Scene node that can play audio. Can be either spatial or global.
 */
export class AudioSourceNode extends SceneNode {
  /**
   * Whether this audio source is global. Global audio sources are not affected spatially
   * and always play at a constant volume. Often used for audio like music and UI sound effects.
   * Default: false.
   */
  public global: boolean;
  /**
   * (Spatial audio sources only) The range at which audio volume starts to attenuate.
   * When the listener is closer than `minRange`, any audio is played at max volume.
   * Default: 0.
   */
  public minRange: number;
  /**
   * (Spatial audio sources only) The range at which audio can no longer be heard.
   * When the listener is further away than `minRange`, any audio will be played at 0% volume.
   * Default: 30.
   */
  public maxRange: number;


  /**
   * Gain node to control the overall volume of this audio source node.
   */
  private volumeNode: GainNode<IAudioContext>;
  /**
   * (Spatial audio only) Spatial panner node to pan audio balance.
   */
  private pannerNode: PannerNode<IAudioContext>;
  /**
   * (Spatial audio only) Gain node to attenuate audio based on distance.
   */
  private spatialVolumeNode: GainNode<IAudioContext>;
  /**
   * The position of this node in listener space.
   * Calculated every frame, so pre-allocate and reuse.
   */
  private _positionListenerSpaceTmp: Vector3 = Vector3.zero();
  /**
   * Data associated with the current playing audio (if any).
   */
  private currentAudio: CurrentAudio | undefined = undefined;

  public constructor(scene: IScene, name: string) {
    super(scene, name);

    // Default values
    this.global = false;
    this.minRange = 1;
    this.maxRange = 40;

    /*
      Spatial audio pipeline:
      (input) -> spatialVolume => panner => volume -> (output)

      Global audio pipeline
      (input) -> volume -> (output)
     */
    this.volumeNode = new GainNode(this.audioSystem.context);
    this.pannerNode = new PannerNode(scene.engine.audioSystem.context, {
      // @NOTE Disable attenuation (we're handling it manually)
      distanceModel: 'linear',
      rolloffFactor: 0,
    });
    this.pannerNode.connect(this.volumeNode);
    this.spatialVolumeNode = new GainNode(this.audioSystem.context);
    this.spatialVolumeNode.connect(this.pannerNode);
  }

  public override onUpdate(_dt: number): void {
    // Bind Audio API Panner Node to position
    // @NOTE AudioSourceNodes are omnidirectional, so no need to set orientation vector.
    this.pannerNode.positionX.value = this.absolutePosition.x;
    this.pannerNode.positionY.value = this.absolutePosition.y;
    this.pannerNode.positionZ.value = this.absolutePosition.z;

    let gain: number;
    const listener = this.scene.engine.activeScene?.activeCamera;
    if (listener) {
      // @NOTE Calculate attenuation using a custom formula with a min/max distance
      const audioSourceDistance = this._positionListenerSpaceTmp
        .setValue(this.absolutePosition)
        .subtractSelf(listener.absolutePosition)
        .length();

      if (audioSourceDistance <= this.minRange) {
        gain = 1;
      } else if (audioSourceDistance > this.maxRange) {
        gain = 0;
      } else {
        // @NOTE Based on formula for formula from `exponential` PannerNode.distanceModel
        // Except dynamically calculate rolloffFactor based on max range
        const AudioLevelAtMaxRange = 0.005;
        const k = Math.log(AudioLevelAtMaxRange) / Math.log(this.minRange / this.maxRange);
        gain = Math.pow(Math.max(audioSourceDistance, this.minRange) / this.minRange, -k);
      }
    } else {
      gain = 0;
    }

    this.spatialVolumeNode.gain.setValueAtTime(gain, this.audioSystem.context.currentTime);
  }

  public playClip(audioClip: AudioClip, options?: PlayClipOptions): void {
    /* Parameter defaults */
    const priority = options?.priority ?? 0;
    const speed = options?.speed ?? 1;
    const speedRange = options?.speedRange ?? 0;

    // Drop one-shot sounds if audio context has not yet started
    if (!this.audioSystem.isInitialised && !audioClip.loop) {
      console.warn(`Non-looping sound was dropped since AudioContext is not yet initialised`);
      return;
    }

    // Clear out existing state before playing new audio
    if (this.isPlaying) {
      this.stopPlaying();
    }

    // Create Web Audio API audio source node from AudioClip
    const audioSourceNode = new AudioBufferSourceNode(this.audioSystem.context, { buffer: audioClip.buffer });
    audioSourceNode.loop = audioClip.loop;
    audioSourceNode.playbackRate.value = speed - speedRange + (Math.random() * speedRange * 2);
    audioSourceNode.start();

    if (this.global) {
      // Global audio: Audio source is connected straight to the output
      audioSourceNode.connect(this.volumeNode);
    } else {
      // Spatial audio: Audio source is routed through spatial audio nodes
      audioSourceNode.connect(this.spatialVolumeNode);
    }

    /**
     * Fired when the audio clip naturally ends.
     * NOT fired when the audio clip is stopped manually or
     * due to channel exhaustion.
     */
    const onAudioClipEnd = (): void => {
      console.log(`[DEBUG] Clip ended.`);
      this.stopPlaying();
    };

    // Attempt to play the audio through the audio system
    // Request can fail if channels are full and this audio is not high-enough priority
    const [success, cleanupAudioChannel] = this.audioSystem.playAudio(this, priority, this.volumeNode);

    if (success) {
      // Only register 'ended' callback if audio actually played
      audioSourceNode.addEventListener('ended', onAudioClipEnd);

      this.currentAudio = {
        audioClip,
        audioNode: audioSourceNode,
        onStop: () => {
          cleanupAudioChannel();
          audioSourceNode.removeEventListener('ended', onAudioClipEnd);
        },
      };
    }
  }

  public stopPlaying(): void {
    if (this.currentAudio !== undefined) {
      this.currentAudio.audioNode.disconnect();
      this.currentAudio.audioNode.stop();
      this.volumeNode.disconnect();
      this.currentAudio.onStop();
      this.currentAudio = undefined;
    }
  }

  private get audioSystem(): IAudioSystem {
    return this.scene.engine.audioSystem;
  }

  public get isPlaying(): boolean {
    return this.currentAudio !== undefined;
  }

  public get volume(): number { return this.volumeNode.gain.value; }
  public set volume(value: number) {
    this.volumeNode.gain.value = clamp01(value);
  }
}
