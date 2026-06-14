import { Observable } from "@lofi/core/util";
import { Color4 } from "./Color4";
import { clamp } from "./util";

export interface Color3Definition {
  r: number;
  g: number;
  b: number;
}

export class Color3 extends Observable {
  private _r: number;
  private _g: number;
  private _b: number;

  public constructor(r: number, g: number, b: number) {
    super();

    this._r = clamp(r, 0, 0xFF);
    this._g = clamp(g, 0, 0xFF);
    this._b = clamp(b, 0, 0xFF);
  }

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

  public static white(): Color3 { return new Color3(0xFF, 0xFF, 0xFF); }
  public static black(): Color3 { return new Color3(0, 0, 0); }
  public static red(): Color3 { return new Color3(0xFF, 0, 0); }
  public static green(): Color3 { return new Color3(0, 0xFF, 0); }
  public static blue(): Color3 { return new Color3(0, 0, 0xFF); }
  public static yellow(): Color3 { return new Color3(0xFF, 0xFF, 0); }
  public static fuchsia(): Color3 { return new Color3(0xFF, 0, 0xFF); }
  public static cyan(): Color3 { return new Color3(0, 0xFF, 0xFF); }
}
