import type { Engine } from '@polyzone/engine/Engine';
import { zipSync } from 'fflate';

/**
 * Options for `DebugModule.recordCanvas()`.
 */
interface RecordCanvasOptions {
  /**
   * The number of seconds to record.
   * If no value is specified, recording will last until `Debug.stopRecording()` is called.
   */
  length: number | undefined;
}

/**
 * Options for `DebugModule.recordCanvasRaw()`.
 */
interface RecordCanvasRawOptions extends Omit<RecordCanvasOptions, 'length'> {
  length: number;
}

type SaveOverrideFunction = (data: Blob, filename: string) => void | Promise<void>;

/*
  @NOTE Since `DebugModule` is designed to be called from a JavaScript context (e.g. Devtools)
  you MUST validate parameters and types!
 */

/**
 * Debug module registered into devtools as `window.Debug` (or just `Debug`).
 * Contains various debug utilities for working in PolyZone.
 */
export class DebugModule {
  private static engineInstances: Map<HTMLCanvasElement, Engine> = new Map();

  /**
   * Optional override for saving files (e.g. for Tauri integration).
   * If set, this will be called with (data: Blob, filename: string) instead of using <a> tag download.
   */
  public saveOverride?: SaveOverrideFunction;

  private _currentMediaRecorder: MediaRecorder | undefined = undefined;
  private _currentRecordingBlobs: Blob[] | undefined = undefined;
  private _currentRecordingAutoStopTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  private _currentRecordingAudioDestination: MediaStreamAudioDestinationNode | undefined = undefined;

  private constructor(saveOverride: SaveOverrideFunction | undefined) {
    this.saveOverride = saveOverride;
  }

  /**
   * Create an instance of `DebugModule` and store it on `window.Debug`.
   * @param saveOverride Optional override for providing custom file-saving logic.
   */
  public static register(saveOverride: SaveOverrideFunction | undefined = undefined): void {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    if (typeof window !== 'undefined' && (window as any).Debug === undefined) {
      (window as any).Debug = new DebugModule(saveOverride);
    }
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
  }

  public static registerEngineInstance(engine: Engine, canvas: HTMLCanvasElement): void {
    DebugModule.engineInstances.set(canvas, engine);
  }

  /**
   * Record an HTML canvas directly to a compressed webm video. 640x480, 30fps.
   */
  public recordCanvas(): void;
  public recordCanvas(options: Partial<RecordCanvasOptions>): void;
  public recordCanvas(canvasSelector: string, options: Partial<RecordCanvasOptions>): void;
  public recordCanvas(canvasSelectorOrOptions?: string | Partial<RecordCanvasOptions>, maybeOptions?: Partial<RecordCanvasOptions>): void {
    // Parameters
    let canvasSelector = 'canvas';
    const DefaultOptions: RecordCanvasOptions = {
      length: 3,
    };
    let options: RecordCanvasOptions = { ...DefaultOptions };

    // Validation
    const printUsage = (): void => {
      console.error(
        [
          `Invalid parameters.`,
          `Usage: ${this.recordCanvas.name}(canvasSelector: string, options: RecordCanvasOptions)`,
          `Usage: ${this.recordCanvas.name}(options: RecordCanvasOptions)`,
          `Usage: ${this.recordCanvas.name}()`,
          '',
          'Options:',
          '  length: number - The number of seconds to record. Defaults to 3 seconds.',
        ].join('\n'),
      );
    };

    function isSelector(param: unknown): param is string {
      return typeof param === 'string';
    }
    function isOptionsObject(param: unknown): param is Partial<RecordCanvasOptions> {
      return typeof param === 'object' && param !== null && param.constructor === Object;
    }

    if (isSelector(canvasSelectorOrOptions)) {
      // First param is a selector
      canvasSelector = canvasSelectorOrOptions;
    } else if (isOptionsObject(canvasSelectorOrOptions)) {
      // First param is options object
      options = {
        ...DefaultOptions,
        ...canvasSelectorOrOptions,
      };
    } else if (canvasSelectorOrOptions !== undefined) {
      return printUsage();
    }

    if (isOptionsObject(maybeOptions)) {
      options = {
        ...DefaultOptions,
        ...maybeOptions,
      };
    } else if (maybeOptions !== undefined) {
      return printUsage();
    }

    // Find canvas element on the page
    const canvasElements = document.querySelectorAll(canvasSelector);
    let canvas: HTMLCanvasElement | undefined;
    if (canvasElements.length === 0) {
      throw new Error(`No canvas elements found on the page (selector: '${canvasSelector}')`);
    } else if (canvasElements.length > 1) {
      throw new Error(`Multiple potential canvas elements found on the page. Specify a more specific selector (selector: '${canvasSelector}')`);
    } else {
      canvas = canvasElements[0] as HTMLCanvasElement;
    }

    // Look up associated Engine instance (if any)
    const engine = DebugModule.engineInstances.get(canvas);

    // Initialise objects used for recording
    this._currentRecordingBlobs = [];
    try {
      const videoStream = canvas.captureStream(30);
      let combinedStream: MediaStream;

      // Capture audio if we have an engine with an AudioSystem
      if (engine?.audioSystem.context) {
        console.log('Capturing audio from AudioSystem');
        const audioDestination = this._currentRecordingAudioDestination = engine.audioSystem.context.createMediaStreamDestination();

        engine.audioSystem.master.connect(audioDestination);

        // Combine video and audio tracks
        const audioStream = audioDestination.stream;
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioStream.getAudioTracks(),
        ]);
      } else {
        console.log('Recording video only (no audio)');
        combinedStream = videoStream;
      }

      this._currentMediaRecorder = new MediaRecorder(
        combinedStream,
        {
          mimeType: 'video/webm;codecs=vp8,opus',
          videoBitsPerSecond: 10_000_000,
        },
      );
    } catch (e) {
      console.error(`Error while trying to create MediaRecorder: `, e);
      throw e;
    }


    // Callbacks
    this._currentMediaRecorder.ondataavailable = (event) => {
      console.log(`[DEBUG] on data available: `, event);
      if (event.data && event.data.size > 0) {
        this._currentRecordingBlobs?.push(event.data);
      }
    };
    this._currentMediaRecorder.onstart = (_e) => {
      console.log(`Starting recording.`);
      if (options.length !== undefined) {
        console.log(`NOTE: Recording will automatically stop in ${options.length} seconds.`);
        this._currentRecordingAutoStopTimer = setTimeout(() => {
          this.stopRecording();
        }, options.length * 1000);
      } else {
        console.log(`Call \`Debug.stopRecording()\` to stop.`);
      }
    };

    // Start recording
    this._currentMediaRecorder.start(1000);
  }

  public stopRecording(): void {
    // Prevent doubling up on stopping recording (e.g. length + calling `stopRecording` manually)
    if (this._currentRecordingAutoStopTimer !== undefined) {
      clearTimeout(this._currentRecordingAutoStopTimer);
    }

    if (this._currentMediaRecorder === undefined) {
      console.warn(`Cannot stop recording, no recording is in-progress.`);
      return;
    }

    console.log(`Stopping recording...`);

    // Wait for last data before saving video
    this._currentMediaRecorder.onstop = (_e) => {
      const blob = new Blob(this._currentRecordingBlobs, { type: 'video/webm' });
      void this.saveFile(blob, 'recording.webm');

      // Disconnect audio tap if it exists
      if (this._currentRecordingAudioDestination !== undefined) {
        this._currentRecordingAudioDestination.disconnect();
        this._currentRecordingAudioDestination = undefined;
      }
    };
    this._currentMediaRecorder.stop();
    this._currentMediaRecorder = undefined;
  }

  /**
   * Capture the contents of an HTML canvas as a png image.
   */
  public screenshot(canvasSelector: string = "canvas"): void {
    // Validation
    const printUsage = (): void => {
      console.error(
        [
          `Invalid parameters.`,
          `Usage: ${this.screenshot.name}(canvasSelector: string)`,
          `Usage: ${this.screenshot.name}()`,
        ].join('\n'),
      );
    };

    function isSelector(param: unknown): param is string {
      return typeof param === 'string';
    }

    if (!isSelector(canvasSelector)) {
      return printUsage();
    }

    // Find canvas element on the page
    const canvasElements = document.querySelectorAll(canvasSelector);
    let canvas: HTMLCanvasElement | undefined;
    if (canvasElements.length === 0) {
      throw new Error(`No canvas elements found on the page (selector: '${canvasSelector}')`);
    } else if (canvasElements.length > 1) {
      throw new Error(`Multiple potential canvas elements found on the page. Specify a more specific selector (selector: '${canvasSelector}')`);
    } else {
      canvas = canvasElements[0] as HTMLCanvasElement;
    }

    canvas.toBlob((blob) => {
      if (blob === null) throw new Error(`Could not capture canvas contents`);
      void this.saveFile(blob, 'screenshot.png');
    }, 'image/png', 1);
  }

  /**
   * Record an HTML canvas as a series of PNGs and download them as a ZIP file.
   * This is a lossless, raw frame capture.
   * You can use something like `ffmpeg` to join the frames into a video:
   * @example
   * ```sh
   * ffmpeg -framerate 30 -i "${FRAMES_DIR}/frame_%04d.png" -vf "scale=iw*4:ih*4:flags=neighbor" -c:v libx264 -pix_fmt yuv420p -crf 0 -preset veryslow "$OUTPUT"
   * ```
   */
  public recordCanvasRaw(): void;
  public recordCanvasRaw(options: Partial<RecordCanvasRawOptions>): void;
  public recordCanvasRaw(canvasSelector: string, options?: Partial<RecordCanvasRawOptions>): void;
  public recordCanvasRaw(canvasSelectorOrOptions?: string | Partial<RecordCanvasRawOptions>, maybeOptions?: Partial<RecordCanvasRawOptions>): void {
    // Parameters
    let canvasSelector = 'canvas';
    const DefaultOptions: RecordCanvasRawOptions = {
      length: 5,
    };
    let options: RecordCanvasRawOptions = { ...DefaultOptions };

    // Validation
    const printUsage = (): void => {
      console.error(
        [
          `Invalid parameters.`,
          `Usage: ${this.recordCanvasRaw.name}(canvasSelector: string, options: RecordCanvasRawOptions)`,
          `Usage: ${this.recordCanvasRaw.name}(options: RecordCanvasRawOptions)`,
          `Usage: ${this.recordCanvasRaw.name}()`,
          '',
          'Options:',
          '  length: number - The number of seconds to record. Defaults to 5 seconds.',
        ].join('\n'),
      );
    };

    function isSelector(param: unknown): param is string {
      return typeof param === 'string';
    }
    function isOptionsObject(param: unknown): param is Partial<RecordCanvasRawOptions> {
      return typeof param === 'object' && param !== null && param.constructor === Object;
    }

    if (isSelector(canvasSelectorOrOptions)) {
      // First param is a selector
      canvasSelector = canvasSelectorOrOptions;

      if (isOptionsObject(maybeOptions)) {
        // Second param is an options object
        options = {
          ...DefaultOptions,
          ...maybeOptions,
        };
      } // else options are undefined

    } else if (isOptionsObject(canvasSelectorOrOptions)) {
      // First param is options object
      options = {
        ...DefaultOptions,
        ...canvasSelectorOrOptions,
      };
      // Second param ignored (options only)

    } else if (canvasSelectorOrOptions !== undefined) {
      // Anything else provided is invalid
      return printUsage();
    }

    // Find canvas element on the page
    const canvasElements = document.querySelectorAll(canvasSelector);
    let canvas: HTMLCanvasElement | undefined;
    if (canvasElements.length === 0) {
      throw new Error(`No canvas elements found on the page (selector: '${canvasSelector}')`);
    } else if (canvasElements.length > 1) {
      throw new Error(`Multiple potential canvas elements found on the page. Specify a more specific selector (selector: '${canvasSelector}')`);
    } else {
      canvas = canvasElements[0] as HTMLCanvasElement;
      console.log(`Capturing canvas: `, canvas);
    }

    // Look up associated Engine instance (if any)
    const engine = DebugModule.engineInstances.get(canvas);

    // Frame capture logic
    const frames: Uint8Array[] = [];
    // let capturing = true;
    let frameCount = 0;
    const fps = 30;
    const maxFrames = Math.floor(options.length * fps);

    console.log(`Recording '${maxFrames}' frames`);

    // Setup audio recording if available
    let audioRecorder: MediaRecorder | undefined;
    let audioDestination: MediaStreamAudioDestinationNode | undefined;
    const audioBlobs: Blob[] = [];

    if (engine) {
      console.log('Capturing audio from AudioSystem');
      audioDestination = engine.audioSystem.context.createMediaStreamDestination();
      engine.audioSystem.master.connect(audioDestination);

      try {
        audioRecorder = new MediaRecorder(audioDestination.stream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 320_000,
        });

        audioRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioBlobs.push(event.data);
          }
        };

        audioRecorder.start(1000 / fps);
      } catch (e) {
        console.error('Error starting audio recording:', e);
        audioRecorder = undefined;
      }
    }

    const finaliseRecording = (): void => {
      // Stop audio recording if it exists
      let audioBlob: Blob | undefined = undefined;
      if (audioRecorder) {
          // Wait for last data before saving video
        audioRecorder.onstop = () => {
          audioBlob = new Blob(audioBlobs, { type: 'audio/webm' });
          void this._downloadFramesAsZip(frames, audioBlob);
          audioDestination?.disconnect();
        };
        audioRecorder.stop();
      } else {
        void this._downloadFramesAsZip(frames, audioBlob);

      }
    };

    const stopRecording = setInterval(() => {
      const myFrameNumber = frameCount++;
      canvas.toBlob((blob) => {
        if (blob === null) throw new Error(`Could not capture canvas contents`);

        void blob.arrayBuffer().then(buffer => {
          frames[myFrameNumber] = new Uint8Array(buffer);
        });

      }, 'image/png');

      // @TODO Can we hook into the canvas API instead of this jank?
    }, 1000 / fps);

    setTimeout(() => {
      clearInterval(stopRecording);
      finaliseRecording();
    }, options.length * 1000);
  }

  /**
   * Helper to download frames as a ZIP file using fflate.
   */
  private async _downloadFramesAsZip(frames: Uint8Array[], audioBlob?: Blob): Promise<void> {
    const files: Record<string, Uint8Array> = {};
    frames.forEach((data, i) => {
      files[`frame_${String(i).padStart(4, '0')}.png`] = data;
    });

    if (audioBlob) {
      const audioData = new Uint8Array(await audioBlob.arrayBuffer());
      files['audio.webm'] = audioData;
    }

    const zipped = zipSync(files);
    const blob = new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
    await this.saveFile(blob, 'frames.zip');
  }

  /**
   * Prompt the user to save a blob as a file.
   */
  private async saveFile(blob: Blob, filename: string): Promise<void> {
    if (this.saveOverride) {
      // Use override if one is provided (assume external logic will handle everything)
      await this.saveOverride(blob, filename);
    } else {
      // Use ye-old anchor tag tricks to prompt user for a file download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
  }
}
