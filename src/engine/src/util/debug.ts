export interface RateCounter {
  count(): void;
  stop(): void;
}
export function rateCounter(name: string): RateCounter {
  let count = 0;

  const intervalKey = setInterval(() => {
    console.log(`${name}: ${count}`);
    count = 0;
  }, 1000);

  return {
    count() { count++; },
    stop() {
      clearInterval(intervalKey);
    },
  };
};
