import { toFixed } from "@lofi/core/math/util";

export interface RateCounterConstructorOptions {
  intervalSeconds: number;
  startDisabled: boolean;
}
export const DefaultRateCounterConstructorOptions: RateCounterConstructorOptions = {
  intervalSeconds: 1,
  startDisabled: false,
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

  // State
  private currentCount: number;
  private intervalKey: ReturnType<typeof setInterval> | undefined;
  private lastValue: number | undefined;

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

    this.currentCount = 0;
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
  }

  /**
   * Start ticking.
   */
  public start(): void {
    if (this.intervalKey !== undefined) {
      console.warn(`Tried to start already-ticking RateCounter!`);
      return;
    }

    this.intervalKey = setInterval(() => {
      this.tick();
    }, 1000 * this.tickIntervalSeconds);
  }

  /**
   * Stop ticking.
   */
  public stop(): void {
    clearInterval(this.intervalKey);
  }

  private tick(): void {
    let perFactor = 1;
    if (this.per instanceof RateCounter) {
      /* Dependency on another RateCounter */
      if (this.per.lastValue !== undefined) {
        perFactor = this.per.lastValue;
      } else {
        // Dependency has not yet computed a value.
        // Skip this tick for now
        this.currentCount = 0;
        return;
      }
    } else if (this.per !== undefined) {
      /* Dependency on a constant scalar */
      perFactor = this.per;
    }

    const newValue = this.lastValue = this.currentCount / perFactor;
    console.log(`${this.label}${perFactor !== 1 ? `(${perFactor})` : ""}: ${toFixed(newValue, 1)}`);
    this.currentCount = 0;
  }
}
