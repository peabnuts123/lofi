import { Observable } from "@lofi/core/util";
import { Color3 } from "./Color3";
import { clamp } from "./util";

export interface Color4Definition {
  r: number;
  g: number;
  b: number;
  a: number;
}


export class Color4 extends Observable {
  private _r: number;
  private _g: number;
  private _b: number;
  private _a: number;

  public constructor(color: Color3, a?: number);
  public constructor(r: number, g: number, b: number, a?: number);
  public constructor(redOrColor: number | Color3, greenOrAlpha?: number, blue?: number, alpha?: number) {
    super();

    let r: number, g: number, b: number, a: number;
    if (redOrColor instanceof Color3) {
      r = redOrColor.r;
      g = redOrColor.g;
      b = redOrColor.b;
      a = greenOrAlpha ?? 0xFF;
    } else {
      r = redOrColor;
      g = greenOrAlpha!;
      b = blue!;
      a = alpha ?? 0xFF;
    }

    this._r = clamp(r, 0, 0xFF);
    this._g = clamp(g, 0, 0xFF);
    this._b = clamp(b, 0, 0xFF);
    this._a = clamp(a, 0, 0xFF);
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

  public get r(): number { return this._r; }
  public set r(value: number) {
    this._r = clamp(value, 0, 0xFF);
    this.notifyOnChange();
  }
  public get g(): number { return this._g; }
  public set g(value: number) {
    this._g = clamp(value, 0, 0xFF);
    this.notifyOnChange();
  }
  public get b(): number { return this._b; }
  public set b(value: number) {
    this._b = clamp(value, 0, 0xFF);
    this.notifyOnChange();
  }
  public get a(): number { return this._a; }
  public set a(value: number) {
    this._a = clamp(value, 0, 0xFF);
    this.notifyOnChange();
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
