import { Observable } from "@lofi/core/util";
import { type Color3Definition } from "./Color3";
import { clamp } from "./util";

export interface Color4Definition {
  r: number;
  g: number;
  b: number;
  a: number;
}


class Color4InternalBuffer {
  public static readonly BufferSize: number = 4;
  public readonly buffer: Float64Array = new Float64Array(Color4InternalBuffer.BufferSize);
  public get r(): number { return this.buffer[0]; }
  public set r(value: number) { this.buffer[0] = clamp(value, 0, 0xFF); }
  public get g(): number { return this.buffer[1]; }
  public set g(value: number) { this.buffer[1] = clamp(value, 0, 0xFF); }
  public get b(): number { return this.buffer[2]; }
  public set b(value: number) { this.buffer[2] = clamp(value, 0, 0xFF); }
  public get a(): number { return this.buffer[3]; }
  public set a(value: number) { this.buffer[3] = clamp(value, 0, 0xFF); }
}

export interface IReadonlyColor4 {
  clone(): Color4;
  withR(value: number): Color4;
  withG(value: number): Color4;
  withB(value: number): Color4;
  withA(value: number): Color4;
  get r(): number;
  get g(): number;
  get b(): number;
  get a(): number;
}

export class Color4 extends Observable implements IReadonlyColor4 {
  private readonly internal: Color4InternalBuffer;

  public constructor(color: Color3Definition, a?: number);
  public constructor(r: number, g: number, b: number, a?: number);
  public constructor(redOrColor: number | Color3Definition, greenOrAlpha?: number, blue?: number, alpha?: number) {
    super();
    this.internal = new Color4InternalBuffer();
    if (typeof redOrColor === 'number') {
      this.internal.r = redOrColor;
      this.internal.g = greenOrAlpha as number;
      this.internal.b = blue as number;
      this.internal.a = alpha ?? 0xFF;
    } else {
      this.internal.r = redOrColor.r;
      this.internal.g = redOrColor.g;
      this.internal.b = redOrColor.b;
      this.internal.a = greenOrAlpha ?? 0xFF;
    }
  }

  public scaleSelf(factor: number): this {
    this.internal.r *= factor;
    this.internal.g *= factor;
    this.internal.b *= factor;
    this.internal.a *= factor;
    this.notifyOnChange();
    return this;
  }
  public scale(factor: number): Color4 {
    return this.clone().scaleSelf(factor);
  }

  public setValue(r: number, g: number, b: number, a: number): this;
  public setValue(color: Color4Definition): this;
  public setValue(rOrColor: number | Color4Definition, maybeG?: number, maybeB?: number, maybeA?: number): this {
    if (typeof rOrColor === 'number') {
      this.internal.r = rOrColor;
      this.internal.g = maybeG!;
      this.internal.b = maybeB!;
      this.internal.a = maybeA!;
    } else {
      this.internal.r = rOrColor.r;
      this.internal.g = rOrColor.g;
      this.internal.b = rOrColor.b;
      this.internal.a = rOrColor.a;
    }
    this.notifyOnChange();
    return this;
  }

  public clone(): Color4 {
    return new Color4(this.r, this.g, this.b, this.a);
  }

  public setR(value: number): this {
    this.r = value;
    return this;
  }
  public withR(value: number): Color4 {
    return new Color4(value, this.g, this.b, this.a);
  }

  public setG(value: number): this {
    this.g = value;
    return this;
  }
  public withG(value: number): Color4 {
    return new Color4(this.r, value, this.b, this.a);
  }

  public setB(value: number): this {
    this.b = value;
    return this;
  }
  public withB(value: number): Color4 {
    return new Color4(this.r, this.g, value, this.a);
  }

  public setA(value: number): this {
    this.a = value;
    return this;
  }
  public withA(value: number): Color4 {
    return new Color4(this.r, this.g, this.b, value);
  }

  public toString(): string {
    return `${Color4.name}(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
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
  public get a(): number { return this.internal.a; }
  public set a(value: number) {
    if (this.internal.a !== value) {
      this.internal.a = value;
      this.notifyOnChange();
    }
  }

  public static white(): Color4 { return new Color4(0xFF, 0xFF, 0xFF); }
  public static black(): Color4 { return new Color4(0, 0, 0); }
  public static red(): Color4 { return new Color4(0xFF, 0, 0); }
  public static green(): Color4 { return new Color4(0, 0xFF, 0); }
  public static blue(): Color4 { return new Color4(0, 0, 0xFF); }
  public static yellow(): Color4 { return new Color4(0xFF, 0xFF, 0); }
  public static fuchsia(): Color4 { return new Color4(0xFF, 0, 0xFF); }
  public static cyan(): Color4 { return new Color4(0, 0xFF, 0xFF); }
}
