export class IdPool {
  private pool: Set<number>;

  public constructor() {
    this.pool = new Set<number>();
  }

  /**
   * Generate a new unique ID that has not been issued from the pool
   * before.
   */
  public createNew(): number {
    let newId: number;
    do {
      newId = Math.trunc(Math.random() * 0xF000_0000) + 0x1000_0000;
    } while (this.pool.has(newId));

    this.pool.add(newId);

    return newId;
  }
}
