import { type IReadonlyVector3 } from "@lofi/core/math/vector";
import { Matrix4 } from "@lofi/core/math/Matrix4";
import { Color3 } from "@lofi/core/math/Color3";
import type { IEngine, OpaqueDrawTask } from "@lofi/engine/Engine";
import { DefaultShader, Material, MaterialInstance, ShaderVariant } from "@lofi/engine/materials";
import { MeshPrimitiveMode } from "@lofi/engine/loaders/definitions";
import { BufferType } from "./createBuffer";

const DebugVertexShaderSource = `#version 300 es
  // @TODO use an #include for this
  layout(std140) uniform Camera {
    mat4 viewProjectionMatrix;
  };

  in vec3 vertexPosition;

  uniform mat4 worldMatrix;

  void main() {
    gl_Position = viewProjectionMatrix * worldMatrix * vec4(vertexPosition, 1.0);
  }
`;

const DebugFragmentShaderSource = `#version 300 es
  precision mediump float;

  out vec4 outputColor;

  uniform vec4 color;

  void main() {
    outputColor = color;
  }
`;

interface DrawOptions {
  /** Color used when drawing debug geometry. */
  color: Color3;
  /** World matrix to transform all debug geometry. */
  worldMatrix: Matrix4;
  /**
   * Draw debug geometry over the top of everything else
   * in the scene.
   */
  overlay: boolean;
}
const DefaultDrawOptions: DrawOptions = {
  color: Color3.yellow(),
  worldMatrix: new Matrix4(),
  overlay: false,
};

export class DrawDebug {
  private static shader: ShaderVariant;
  private static vertexPositionAttribute: number;
  private static colorUniform: WebGLUniformLocation;
  private static vertexBuffer: WebGLBuffer;
  private static vao: WebGLVertexArrayObject;

  public static drawPolyLine(engine: IEngine, linePoints: readonly IReadonlyVector3[], options: Partial<DrawOptions> = {}): OpaqueDrawTask {
    // Map linePoints into (0,1)(1,2),(2,3), etc.
    const vertexPointData = linePoints
      .slice(0, linePoints.length - 1)
      .flatMap((_, index) => {
        return [
          linePoints[index],
          linePoints[index + 1],
        ];
      });

    return DrawDebug.drawLines(engine, vertexPointData, options);
  }

  public static drawWireframe(engine: IEngine, wireframe: IWireframeDrawable, options: Partial<DrawOptions> = {}): OpaqueDrawTask {
    // Map faces into closed-loop polylines
    const vertexPointData = wireframe.getWireframeFaces().flatMap((face: readonly IReadonlyVector3[]) => {
      return face
        .flatMap((_, index, array) => {
          return [
            array[index],
            array[(index + 1) % array.length],
          ];
        });
    });

    return DrawDebug.drawLines(engine, vertexPointData, options);
  }

  private static drawLines(engine: IEngine, linePoints: readonly IReadonlyVector3[], options: Partial<DrawOptions>): OpaqueDrawTask {
    const drawOptions = {
      ...DefaultDrawOptions,
      ...options,
    };

    // Ensure shader is initialised
    DrawDebug.initShader(engine);

    // Build vertex array
    const vertices = new Float32Array(linePoints.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]));

    return {
      renderLayer: options.overlay ? Infinity : 0,
      isTransparent: false,
      shaderVariant: this.shader,
      material: MaterialInstance.fromMaterial(Material.DefaultMaterial),
      uniforms: {
        worldMatrix: drawOptions.worldMatrix,
      },
      draw: {
        id: Math.trunc(Math.random() * 0xF000_0000) + 0x1000_0000, //  @NOTE Always unique
        init: () => { }, // Because ID is unique, `init()` will ALWAYS be called, so it's not really needed
        exec: ({ gl }) => {
          // Bind VAO (restores attribute configuration)
          gl.bindVertexArray(DrawDebug.vao);

          // Upload vertex data
          gl.bindBuffer(BufferType.ARRAY_BUFFER, DrawDebug.vertexBuffer);
          gl.bufferData(BufferType.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

          // Bind uniforms
          gl.uniform4fv(DrawDebug.colorUniform, new Float32Array([
            drawOptions.color.r / 0xFF,
            drawOptions.color.g / 0xFF,
            drawOptions.color.b / 0xFF,
            1,
          ]));

          // Draw lines
          gl.drawArrays(MeshPrimitiveMode.LINES, 0, linePoints.length);

          // Cleanup
          gl.bindVertexArray(null);
        },
      },
    };
  }

  private static initShader(engine: IEngine): void {
    if (DrawDebug.shader) return;

    const gl = engine.gl;
    // @TODO should maybe store this `shader` on `Material.shader` as we're
    //  ~slightly hacking at the moment
    const shader = DrawDebug.shader = new ShaderVariant(engine, 0, new DefaultShader(
      DebugVertexShaderSource,
      DebugFragmentShaderSource,
    ));

    DrawDebug.vertexPositionAttribute = shader.getAttribute('vertexPosition')!;
    DrawDebug.colorUniform = shader.getUniform('color')!;

    // Create VAO
    DrawDebug.vao = gl.createVertexArray();
    if (!DrawDebug.vao) {
      throw new Error('Failed to create vertex array object');
    }

    // Set up VAO with buffer and attribute configuration
    gl.bindVertexArray(DrawDebug.vao);

    DrawDebug.vertexBuffer = gl.createBuffer();
    if (!DrawDebug.vertexBuffer) {
      throw new Error('Failed to create vertex buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, DrawDebug.vertexBuffer);
    gl.enableVertexAttribArray(DrawDebug.vertexPositionAttribute);
    gl.vertexAttribPointer(
      DrawDebug.vertexPositionAttribute,
      3,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindVertexArray(null);
  }
}

export type WireframeFaces = readonly (readonly IReadonlyVector3[])[];
export interface IWireframeDrawable {
  /**
   * An array of faces. Each face is represented by an array of points.
   * Faces will be drawn as a closed-loop polyline that will join the last point
   * to the first.
   */
  getWireframeFaces(): WireframeFaces;
}
export function isWireframeDrawable(object: any): object is IWireframeDrawable {
  return 'getWireframeFaces' in object;
}
