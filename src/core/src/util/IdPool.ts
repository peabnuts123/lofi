export type UniqueId = number;

export class IdPool {
  private latest: number = 0x1000_0000;

  /**
   * Generate a new unique ID that has not been issued from the pool
   * before.
   */
  public createNew(): UniqueId {
    return this.latest++;
  }
}
