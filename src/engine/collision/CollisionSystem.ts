export class CollisionSystem {
  public static readonly MaxCollisionGroups = 32;

  /**
   * Matrix of bits representing interactions between collision groups.
   * Entry `interactionMatrix[i]` represents collision group i. Bit `j`
   * within `interactionMatrix[i]` represents whether collision groups
   * `i` and `j` can interact.
   */
  private interactionMatrix: number[] = [];

  public constructor() {
    // Flag everything as interacting by default
    for (let i = 0; i < CollisionSystem.MaxCollisionGroups; i++) {
      this.interactionMatrix[i] = 0xFFFF_FFFF;
    }
  }

  /**
   * Set whether two collision groups can interact.
   * @param groupA
   * @param groupB
   * @param canInteract
   */
  public setInteraction(groupA: number, groupB: number, canInteract: boolean): void {
    if (
      groupA < 0 || groupA >= CollisionSystem.MaxCollisionGroups ||
      groupB < 0 || groupB >= CollisionSystem.MaxCollisionGroups
    ) {
      throw new Error(`Collision groups must be in range 0-$${CollisionSystem.MaxCollisionGroups - 1}`);
    }

    if (canInteract) {
      this.interactionMatrix[groupA] |= (1 << groupB);
      this.interactionMatrix[groupB] |= (1 << groupA);
    } else {
      this.interactionMatrix[groupA] &= ~(1 << groupB);
      this.interactionMatrix[groupB] &= ~(1 << groupA);
    }
  }

  /**
   * Get whether two collision groups can interact.
   * @param groupA
   * @param groupB
   * @returns
   */
  public canInteract(groupA: number, groupB: number): boolean {
    return !!(this.interactionMatrix[groupA] & (1 << groupB));
  }
}
