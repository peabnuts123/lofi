/**
 * Repeatedly invoke the garbage collector and wait for a certain condition to be true.
 * If timeout is exceeded, then waiting is cancelled and promise is rejected.
 * @param condition
 * @param timeoutMs
 */
export async function forceGCAndWaitForCondition(condition: () => boolean, timeoutMs = 3000): Promise<void> {
  const { gc } = (globalThis as { gc: () => void });
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const stopInterval = setInterval(() => {
      gc();
      if (condition()) {
        clearInterval(stopInterval);
        resolve();
      } else if (Date.now() >= deadline) {
        clearInterval(stopInterval);
        reject(new Error(`Timed out waiting for condition: ${condition}`));
      }
    }, 50);
  });
}
