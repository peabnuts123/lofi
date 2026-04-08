import { Vector3 } from "@lofi/core/math/vector";

export interface AxisAlignedBoundingBoxConstructorArgs {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}
// @TODO Move out of `/collision` - it's just maths
export class AxisAlignedBoundingBox {
  public xMin: number;
  public xMax: number;
  public yMin: number;
  public yMax: number;
  public zMin: number;
  public zMax: number;

  public constructor({
    xMin,
    xMax,
    yMin,
    yMax,
    zMin,
    zMax,
  }: AxisAlignedBoundingBoxConstructorArgs) {
    this.xMin = xMin;
    this.xMax = xMax;
    this.yMin = yMin;
    this.yMax = yMax;
    this.zMin = zMin;
    this.zMax = zMax;
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
    const verticesWorldSpace: Vector3[] = [
      // 0: top-back-right
      new Vector3(this.xMax, this.yMax, this.zMin),
      // 1: top-front-right
      new Vector3(this.xMax, this.yMax, this.zMax),
      // 2: bottom-back-right
      new Vector3(this.xMax, this.yMin, this.zMin),
      // 3: bottom-front-right
      new Vector3(this.xMax, this.yMin, this.zMax),
      // 4: top-back-left
      new Vector3(this.xMin, this.yMax, this.zMin),
      // 5: top-front-left
      new Vector3(this.xMin, this.yMax, this.zMax),
      // 6: bottom-back-left
      new Vector3(this.xMin, this.yMin, this.zMin),
      // 7: bottom-front-left
      new Vector3(this.xMin, this.yMin, this.zMax),
    ];

    return [
      // Front face (zMax)
      [verticesWorldSpace[1], verticesWorldSpace[5], verticesWorldSpace[7], verticesWorldSpace[3]],
      // Back face (zMin)
      [verticesWorldSpace[4], verticesWorldSpace[0], verticesWorldSpace[2], verticesWorldSpace[6]],
      // Right face (xMax)
      [verticesWorldSpace[0], verticesWorldSpace[1], verticesWorldSpace[3], verticesWorldSpace[2]],
      // Left face (xMin)
      [verticesWorldSpace[5], verticesWorldSpace[4], verticesWorldSpace[6], verticesWorldSpace[7]],
      // Top face (yMax)
      [verticesWorldSpace[4], verticesWorldSpace[5], verticesWorldSpace[1], verticesWorldSpace[0]],
      // Bottom face (yMin)
      [verticesWorldSpace[2], verticesWorldSpace[3], verticesWorldSpace[7], verticesWorldSpace[6]],
    ];
  }

  public static unit(): AxisAlignedBoundingBox {
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
