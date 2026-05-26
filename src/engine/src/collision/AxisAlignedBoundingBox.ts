import type { Matrix4, Vector3Definition } from "@lofi/core/math";
import { Vector3 } from "@lofi/core/math/vector";
import type { IWireframeDrawable } from "../util/DrawDebug";

export interface AxisAlignedBoundingBoxConstructorArgs {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}
// @TODO We should validate to make sure min is always less than max.
// @TODO Move out of `/collision` - it's just maths
export class AxisAlignedBoundingBox implements IWireframeDrawable {
  public xMin: number;
  public xMax: number;
  public yMin: number;
  public yMax: number;
  public zMin: number;
  public zMax: number;

  public constructor(min: Vector3Definition, max: Vector3Definition);
  public constructor(args: AxisAlignedBoundingBoxConstructorArgs);
  public constructor(minOrArgs: Vector3Definition | AxisAlignedBoundingBoxConstructorArgs, max?: Vector3Definition) {
    if ('x' in minOrArgs) {
      /* Separate min/max args */
      this.xMin = minOrArgs.x;
      this.yMin = minOrArgs.y;
      this.zMin = minOrArgs.z;
      this.xMax = max!.x;
      this.yMax = max!.y;
      this.zMax = max!.z;
    } else {
      /* AABB args */
      this.xMin = minOrArgs.xMin;
      this.yMin = minOrArgs.yMin;
      this.zMin = minOrArgs.zMin;
      this.xMax = minOrArgs.xMax;
      this.yMax = minOrArgs.yMax;
      this.zMax = minOrArgs.zMax;
    }
  }

  public intersects(other: AxisAlignedBoundingBox): boolean {
    return !(
      this.xMax < other.xMin ||
      this.xMin > other.xMax ||
      this.yMax < other.yMin ||
      this.yMin > other.yMax ||
      this.zMax < other.zMin ||
      this.zMin > other.zMax
    );
  }

  public getWireframeFaces(): Vector3[][] {
    const vertices = this.getVertices();
    return [
      // Front
      [vertices[1], vertices[0], vertices[4], vertices[5]],
      // Back
      [vertices[3], vertices[2], vertices[6], vertices[7]],
      // Right
      [vertices[0], vertices[3], vertices[7], vertices[4]],
      // Left
      [vertices[2], vertices[1], vertices[5], vertices[6]],
      // Top
      [vertices[0], vertices[1], vertices[2], vertices[3]],
      // Bottom
      [vertices[5], vertices[4], vertices[7], vertices[6]],
    ];
  }

  public transformSelf(matrix: Matrix4): this {
    const vertices = this.getVertices();

    // Transform vertices
    for (const vertex of vertices) {
      vertex.multiplySelf(matrix);
    }

    return this.fromVerticesSelf(vertices);
  }

  public setValue(min: Vector3, max: Vector3): this;
  public setValue(value: AxisAlignedBoundingBoxConstructorArgs): this;
  public setValue(minOrValue: Vector3 | AxisAlignedBoundingBoxConstructorArgs, max?: Vector3): this {
    if (minOrValue instanceof Vector3) {
      /* Separate min/max args */
      this.xMin = minOrValue.x;
      this.yMin = minOrValue.y;
      this.zMin = minOrValue.z;
      this.xMax = max!.x;
      this.yMax = max!.y;
      this.zMax = max!.z;
    } else {
      /* AABB arg */
      this.xMin = minOrValue.xMin;
      this.yMin = minOrValue.yMin;
      this.zMin = minOrValue.zMin;
      this.xMax = minOrValue.xMax;
      this.yMax = minOrValue.yMax;
      this.zMax = minOrValue.zMax;
    }
    return this;
  }

  public unionSelf(other: AxisAlignedBoundingBox): this {
    /* Min */
    if (other.xMin < this.xMin) this.xMin = other.xMin;
    if (other.yMin < this.yMin) this.yMin = other.yMin;
    if (other.zMin < this.zMin) this.zMin = other.zMin;
    /* Max */
    if (other.xMax > this.xMax) this.xMax = other.xMax;
    if (other.yMax > this.yMax) this.yMax = other.yMax;
    if (other.zMax > this.zMax) this.zMax = other.zMax;

    return this;
  }

  private tmp_getVertices: Vector3[] = Array.from({ length: 8 }, () => Vector3.zero());
  private getVertices(): Vector3[] {
    // @NOTE Does not allocate - return value is a shared reference.
    // 0: right, forward, top
    this.tmp_getVertices[0].setValue(this.xMax, this.yMax, this.zMax);
    // 1: left, forward, top
    this.tmp_getVertices[1].setValue(this.xMin, this.yMax, this.zMax);
    // 2: left, back, top
    this.tmp_getVertices[2].setValue(this.xMin, this.yMin, this.zMax);
    // 3: right, back, top
    this.tmp_getVertices[3].setValue(this.xMax, this.yMin, this.zMax);
    // 4: right, forward, bottom
    this.tmp_getVertices[4].setValue(this.xMax, this.yMax, this.zMin);
    // 5: left, forward, bottom
    this.tmp_getVertices[5].setValue(this.xMin, this.yMax, this.zMin);
    // 6: left, back, bottom
    this.tmp_getVertices[6].setValue(this.xMin, this.yMin, this.zMin);
    // 7: right, back, bottom
    this.tmp_getVertices[7].setValue(this.xMax, this.yMin, this.zMin);
    return this.tmp_getVertices;
  }

  private tmp_fromVerticesSelf = [Vector3.zero(), Vector3.zero()] as const;
  public fromVerticesSelf(vertices: Vector3[]): this {
    if (vertices.length === 0) {
      this.xMin = this.yMin = this.zMin = 0;
      this.xMax = this.yMax = this.zMax = 0;
      return this;
    }

    const minBounds = this.tmp_fromVerticesSelf[0].setValue(vertices[0]);
    const maxBounds = this.tmp_fromVerticesSelf[1].setValue(vertices[0]);
    for (let i = 1; i < vertices.length; i++) {
      // Min
      if (vertices[i].x < minBounds.x) minBounds.x = vertices[i].x;
      if (vertices[i].y < minBounds.y) minBounds.y = vertices[i].y;
      if (vertices[i].z < minBounds.z) minBounds.z = vertices[i].z;
      // Max
      if (vertices[i].x > maxBounds.x) maxBounds.x = vertices[i].x;
      if (vertices[i].y > maxBounds.y) maxBounds.y = vertices[i].y;
      if (vertices[i].z > maxBounds.z) maxBounds.z = vertices[i].z;
    }

    return this.setValue(minBounds, maxBounds);
  }
  public static fromVertices(vertices: Vector3[]): AxisAlignedBoundingBox {
    return AxisAlignedBoundingBox.zero().fromVerticesSelf(vertices);
  }

  public zeroSelf(): this {
    this.xMin = this.yMin = this.zMin = 0;
    this.xMax = this.yMax = this.zMax = 0;
    return this;
  }
  public static zero(): AxisAlignedBoundingBox {
    return new AxisAlignedBoundingBox({
      xMin: 0, yMin: 0, zMin: 0,
      xMax: 0, yMax: 0, zMax: 0,
    });
  }

  public static unit(): AxisAlignedBoundingBox {
    // 1x1x1 cube centered around origin.
    return new AxisAlignedBoundingBox({
      xMin: -0.5,
      xMax: 0.5,
      yMin: -0.5,
      yMax: 0.5,
      zMin: -0.5,
      zMax: 0.5,
    });
  }
}
