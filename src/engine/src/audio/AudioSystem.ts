import { type IAudioContext, AudioContext, DynamicsCompressorNode, GainNode, type IAudioNode } from 'standardized-audio-context';

import  { Vector3 } from "@lopoly/core/math/Vector3";
import  type { AudioSourceNode } from "@lopoly/engine/scene/nodes";
import  type { IEngine } from "@lopoly/engine/Engine";

const Up = Vector3.up();
const Forward = Vector3.forward();

export interface AudioSystemOptions {
  channels: number;
}

export interface PlayingAudioTask {
  audioSource: AudioSourceNode;
  priority: number;
  startTime: number;
}

export type AudioChannel = PlayingAudioTask | undefined;

export type PlayAudioSuccessResult = [success: true, onAudioStop: () => void];
export type PlayAudioFailureResult = [success: false];
export type PlayAudioResult = PlayAudioSuccessResult | PlayAudioFailureResult;

export interface IAudioSystem {
  playAudio(audioSource: AudioSourceNode, priority: number, audioNode: IAudioNode<IAudioContext>): PlayAudioResult;
  destroy(): void;
  onUpdate(engine: IEngine): void;
  get context(): IAudioContext;
  get master(): GainNode<IAudioContext>;
  get isInitialised(): boolean;
}

export class AudioSystem implements IAudioSystem {
  /**
   * Web Audio API AudioContext associated with the audio system.
   */
  public readonly context: IAudioContext;

  /**
   * Master output node that all audio should route through.
   */
  public readonly master: GainNode<IAudioContext>;
  /**
   * Array of virtual audio channels that limit the number of sounds
   * that can be playing simultaneously.
   */
  private readonly channels: Array<AudioChannel>;
  private readonly _upTmp = Vector3.zero();
  private readonly _forwardTmp = Vector3.zero();

  public constructor(options: AudioSystemOptions) {
    this.context = new AudioContext();

    this.channels = new Array<AudioChannel>(options.channels);

    // Create simple limiter between master node and output to prevent clipping audio
    const limiter = new DynamicsCompressorNode(this.context, {
      threshold: -3,
      knee: 0,
      ratio: 20,
      attack: 0.003,
      release: 0.05,
    });
    limiter.connect(this.context.destination);

    // Create master output node
    this.master = new GainNode(this.context);
    this.master.connect(limiter);

    this.init();
  }

  /**
   * Initialise the audio system, specifically dealing with browser autoplay
   * policies. Audio system will be initialised on first interaction with the page.
   */
  private init(): void {
    if (this.context.state == 'running') {
      // Audio context initialised. No work to do
      return;
    }

    const onInteract = (): void => {
      void this.context.resume()
        .then(() => {
          // Successfully resumed, remove init handlers
          document.removeEventListener('pointerdown', onInteract);
          document.removeEventListener('keydown', onInteract);
        })
        .catch((e) => {
          console.error(`Failed to resume AudioContext`, e);
        });
    };

    document.addEventListener('pointerdown', onInteract);
    document.addEventListener('keydown', onInteract);
  }

  public playAudio(audioSource: AudioSourceNode, priority: number, audioNode: IAudioNode<IAudioContext>): [success: true, onAudioStop: () => void] | [success: false] {
    // Find an empty channel
    let targetChannelIndex: number | undefined = undefined;
    for (let i = 0; i < this.channels.length; i++) {
      if (this.channels[i] === undefined) {
        targetChannelIndex = i;
        break;
      }
    }

    if (targetChannelIndex === undefined) {
      // All audio channels are in use

      // Find a suitable channel to override using the following criteria:
      // - Lowest priority
      // - Priority must be less than or equal to than `priority`
      // - Of equal-priority audio sources, the channel playing the oldest audio
      const viableChannels = (this.channels as PlayingAudioTask[]) // @NOTE No channels are empty, cast for type assist
        .filter((channel) => channel.priority <= priority)
        .sort((channelA, channelB) => {
          if (channelA.priority !== channelB.priority) {
            // Lowest priority first
            return channelA.priority - channelB.priority;
          } else {
            // Where priorities are equal, oldest start time first
            return channelA.startTime - channelB.startTime;
          }
        });

      if (viableChannels.length > 0) {
        // Found a lower-priority or older audio source to replace
        const channelToReplace = viableChannels[0];
        targetChannelIndex = this.channels.indexOf(channelToReplace);

        // Stop the existing audio
        channelToReplace.audioSource.stopPlaying(); // @NOTE Will deallocate channel through callback
      } else {
        // No viable channels for audio to override. This audio will not play
        console.warn(`[DEBUG] Audio could not play - all channels full. No viable channels to replace`); // @TODO @DEBUG REMOVE
        return [false];
      }
    }

    // Connect audioNode to audio system
    audioNode.connect(this.master);

    /**
     * Cleanup function fired whenever audio finishes or is stopped
     */
    const onAudioStopFn = (): void => {
      this.channels[targetChannelIndex] = undefined;
    };

    // Populate channel
    this.channels[targetChannelIndex] = {
      audioSource,
      priority,
      startTime: performance.now() / 1000,
    };

    return [true, onAudioStopFn];
  }

  public destroy(): void {
    for (const channel of this.channels) {
      if (channel !== undefined) {
        channel.audioSource.stopPlaying(); // Will de-allocate channel
      }
    }
  }

  public onUpdate(engine: IEngine): void {
    // Bind audio system listener to active camera
    const listener = engine.activeScene?.activeCamera;
    if (listener) {
      /* Position */
      this.context.listener.positionX.value = listener.absolutePosition.x;
      this.context.listener.positionY.value = listener.absolutePosition.y;
      this.context.listener.positionZ.value = listener.absolutePosition.z;

      /* Orientation */
      const up = listener.absoluteRotation.q.rotateVectorInPlace(this._upTmp.setValue(Up));
      const forward = listener.absoluteRotation.q.rotateVectorInPlace(this._forwardTmp.setValue(Forward));
      this.context.listener.upX.value = up.x;
      this.context.listener.upY.value = up.y;
      this.context.listener.upZ.value = up.z;
      this.context.listener.forwardX.value = forward.x;
      this.context.listener.forwardY.value = forward.y;
      this.context.listener.forwardZ.value = forward.z;
    }
  }

  public get isInitialised(): boolean {
    return this.context.state === 'running';
  }
}
