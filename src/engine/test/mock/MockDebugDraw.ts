import type { IReadonlyVector3 } from "@lofi/core/math";
import type { DrawOptions, IDebugDraw, IWireframeDrawable } from "@lofi/engine/util/DebugDraw";

export class MockDebugDraw implements IDebugDraw {
  public drawPolyLine(_linePoints: readonly IReadonlyVector3[], _options?: Partial<DrawOptions>): void {
    /* @NOTE No-op */
  }
  public drawWireframe(_wireframe: IWireframeDrawable, _options?: Partial<DrawOptions>): void {
    /* @NOTE No-op */
  }
}
