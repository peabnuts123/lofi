import { Observable } from "@lofi/core/util";
import { Color4 } from "./Color4";
import { clamp } from "./util";

// @TODO Rename to Color3Like
export interface Color3Definition {
  r: number;
  g: number;
  b: number;
}

class Color3InternalBuffer {
  public static readonly BufferSize: number = 3;
  public readonly buffer: Float64Array<ArrayBuffer> = new Float64Array(Color3InternalBuffer.BufferSize);
  public get r(): number { return this.buffer[0]; }
  public set r(value: number) { this.buffer[0] = clamp(value, 0, 0xFF); }
  public get g(): number { return this.buffer[1]; }
  public set g(value: number) { this.buffer[1] = clamp(value, 0, 0xFF); }
  public get b(): number { return this.buffer[2]; }
  public set b(value: number) { this.buffer[2] = clamp(value, 0, 0xFF); }
}

export class Color3 extends Observable {
  private readonly internal: Color3InternalBuffer;

  public constructor(r: number, g: number, b: number) {
    super();
    this.internal = new Color3InternalBuffer();
    this.internal.r = r;
    this.internal.g = g;
    this.internal.b = b;
  }

  // @TODO setValue(r: number, g: number, b: number): void;
  // @TODO setValue(color: Color3Definition): void;

  public setR(value: number): this {
    this.r = value;
    return this;
  }
  public withR(value: number): Color3 {
    return new Color3(value, this.g, this.b);
  }

  public setG(value: number): this {
    this.g = value;
    return this;
  }
  public withG(value: number): Color3 {
    return new Color3(this.r, value, this.b);
  }

  public setB(value: number): this {
    this.b = value;
    return this;
  }
  public withB(value: number): Color3 {
    return new Color3(this.r, this.g, value);
  }

  public toColor4(alpha: number = 0xFF): Color4 {
    return new Color4(this, alpha);
  }

  public toString(): string {
    return `${Color3.name}(${this.r}, ${this.g}, ${this.b})`;
  }

  public get r(): number { return this.internal.r; }
  public set r(value: number) {
    if (this.internal.r !== value) {
      this.internal.r = value;
      this.notifyOnChange();
    }
  }
  public get g(): number { return this.internal.g; }
  public set g(value: number) {
    if (this.internal.g !== value) {
      this.internal.g = value;
      this.notifyOnChange();
    }
  }
  public get b(): number { return this.internal.b; }
  public set b(value: number) {
    if (this.internal.b !== value) {
      this.internal.b = value;
      this.notifyOnChange();
    }
  }

  public static white(): Color3 { return new Color3(0xFF, 0xFF, 0xFF); }
  public static black(): Color3 { return new Color3(0, 0, 0); }
  public static red(): Color3 { return new Color3(0xFF, 0, 0); }
  public static green(): Color3 { return new Color3(0, 0xFF, 0); }
  public static blue(): Color3 { return new Color3(0, 0, 0xFF); }
  public static yellow(): Color3 { return new Color3(0xFF, 0xFF, 0); }
  public static fuchsia(): Color3 { return new Color3(0xFF, 0, 0xFF); }
  public static cyan(): Color3 { return new Color3(0, 0xFF, 0xFF); }
}
