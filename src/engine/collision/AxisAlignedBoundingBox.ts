export interface AxisAlignedBoundingBoxConstructorArgs {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}
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
}
