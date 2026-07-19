import  { toFixed } from "@lopoly/core/math/util";

export interface RateCounterConstructorOptions {
  intervalSeconds: number;
  startDisabled: boolean;
  mute: boolean;
}
export const DefaultRateCounterConstructorOptions: RateCounterConstructorOptions = {
  intervalSeconds: 1,
  startDisabled: false,
  mute: false,
};

/**
 * Debug / utility class that counts the rate of things and
 * periodically logs their rate.
 */
export class RateCounter {
  // Config
  /** Label printed in log messages. */
  private label: string;
  /** Divisor factor for recorded rates. */
  private per: number | RateCounter | undefined;
  /** Period between ticks. */
  private tickIntervalSeconds: number;
  /** Whether this RateCounter should log output */
  private logOutput: boolean;

  // State
  private totalCount: number;
  private currentCount: number;
  private startTime: number | undefined;
  private intervalKey: ReturnType<typeof setInterval> | undefined;
  private previous: { value: number, averageValue: number } | undefined;

  /**
   * @param label Label to print in log messages
   * @param per Divisor factor for recorded rates. e.g. `2` = halve printed values. Can also be an instance of
   * another RateCounter to divide the rate by the other RateCounter's value.
   */
  public constructor(label: string, per?: number | RateCounter, options: Partial<RateCounterConstructorOptions> = {}) {
    this.label = label;
    this.per = per;

    const opts = {
      ...DefaultRateCounterConstructorOptions,
      ...options,
    };

    this.tickIntervalSeconds = opts.intervalSeconds;
    this.logOutput = !opts.mute;

    this.currentCount = 0;
    this.totalCount = 0;
    if (!opts.startDisabled) {
      this.start();
    }
  }

  /**
   * Increase the count for this interval by `value`.
   * @param value Defaults to 1.
   */
  public count(value: number = 1): void {
    this.currentCount += value;
    this.totalCount += value;
  }

  /**
   * Start ticking.
   */
  public start(): void {
    if (this.intervalKey !== undefined) {
      console.warn(`Tried to start already-ticking RateCounter!`);
      return;
    }

    this.startTime = performance.now();
    this.intervalKey = setInterval(() => {
      this.tick();
    }, 1000 * this.tickIntervalSeconds);

    this.currentCount = 0;
    this.totalCount = 0;
  }

  /**
   * Stop ticking.
   */
  public stop(): void {
    if (this.startTime === undefined || this.previous === undefined) return;


    clearInterval(this.intervalKey);
    this.intervalKey = undefined;
    this.startTime = undefined;

    // Print summary
    if (this.logOutput) {
      const perFactor = this.getPerFactor();
      if (perFactor === undefined) {
        // Dependency has not yet computed a value.
        // We can't compute our average, so we have to skip the summary.
        console.warn(`Rate(${this.label}) Could not compute summary for RateCounter - 'per' dependency has never posted a value`);
        return;
      }
      const averageValue = this.previous.averageValue;
      console.log(`Rate(${this.label}) Stopped. Average ${this.label}${perFactor.average !== 1 ? `(${toFixed(perFactor.average, 1)})` : ""}: ${toFixed(averageValue, 1)}`);
    }
  }

  private tick(): void {
    const perFactor = this.getPerFactor();
    if (perFactor === undefined) {
      // Dependency has not yet computed a value.
      // Skip this tick for now
      return;
    }

    const totalDuration = performance.now() - this.startTime!;
    const totalNumTicks = totalDuration / 1000 * this.tickIntervalSeconds;
    const newValue = this.previous = {
      value: this.currentCount / perFactor.current,
      averageValue: this.totalCount / perFactor.average / totalNumTicks,
    };


    if (this.logOutput) {
      console.log(`Rate(${this.label}) ${toFixed(newValue.value, 1)} ${perFactor.current !== 1 ? `(per=${toFixed(perFactor.current, 1)})` : ""}`);
    }
    this.currentCount = 0;
  }


  private getPerFactor(): { current: number, average: number } | undefined {
    if (this.per instanceof RateCounter) {
      /* Dependency on another RateCounter */
      if (this.per.previous !== undefined) {
        return {
          current: this.per.previous.value,
          average: this.per.previous.averageValue,
        };
      } else {
        // Dependency has not yet computed a value.
        return undefined;
      }
    } else if (this.per !== undefined) {
      /* Dependency on a constant scalar */
      return {
        current: this.per,
        average: this.per,
      };
    } else {
      return {
        current: 1,
        average: 1,
      };
    }
  }
}
