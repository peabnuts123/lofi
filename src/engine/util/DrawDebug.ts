
import type { IEngine } from "@polyzone/engine/Engine";
import { ShaderProgram } from "@polyzone/engine/materials";

import { Vector3 } from "./vector";
import { Color4 } from "./Color4";
import { Matrix4 } from "./Matrix4";

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
  color: Color4;
  /** World matrix to transform all debug geometry. */
  worldMatrix: Matrix4;
  /**
   * Draw debug geometry over the top of everything else
   * in the scene.
   */
  overlay: boolean;
}
const DefaultDrawOptions: DrawOptions = {
  color: Color4.yellow(),
  worldMatrix: new Matrix4(),
  overlay: false,
};

export class DrawDebug {
  private static shaderProgram: ShaderProgram;
  private static vertexPositionAttribute: number;
  private static worldMatrixUniform: WebGLUniformLocation;
  private static colorUniform: WebGLUniformLocation;
  private static vertexBuffer: WebGLBuffer;

  public static drawPolyLine(engine: IEngine, linePoints: Vector3[], options: Partial<DrawOptions> = {}): void {
    throw new Error(`This is not updated to work with the new pipeline yet`);
    // Map linePoints into (0,1)(1,2),(2,3), etc.
    const vertexPointData = linePoints
      .slice(0, linePoints.length - 1)
      .flatMap((_, index) => {
        return [
          linePoints[index],
          linePoints[index + 1],
        ];
      });

    DrawDebug.drawLines(engine, vertexPointData, options);
  }

  public static drawWireframe(engine: IEngine, wireframe: IWireframeDrawable, options: Partial<DrawOptions> = {}): void {
    throw new Error(`This is not updated to work with the new pipeline yet`);
    // Map faces into closed-loop polylines
    const vertexPointData = wireframe.getWireframeFaces().flatMap((face: Vector3[]) => {
      return face
        .flatMap((_, index, array) => {
          return [
            array[index],
            array[(index + 1) % array.length],
          ];
        });
    });

    DrawDebug.drawLines(engine, vertexPointData, options);
  }

  private static drawLines(engine: IEngine, linePoints: Vector3[], options: Partial<DrawOptions>): void {
    throw new Error(`This is not updated to work with the new pipeline yet`);
    const { gl } = engine;
    const drawOptions = {
      ...DefaultDrawOptions,
      ...options,
    };

    // Ensure shader is initialised
    DrawDebug.initShader(engine);

    // Build vertex array
    const vertices = new Float32Array(linePoints.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]));

    if (drawOptions.overlay) {
      gl.disable(gl.DEPTH_TEST);
    }

    // Upload vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, DrawDebug.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    // Use debug shader
    gl.useProgram(DrawDebug.shaderProgram);

    // Bind uniforms
    gl.uniformMatrix4fv(
      DrawDebug.worldMatrixUniform,
      false,
      drawOptions.worldMatrix.toArray(),
    );
    gl.uniform4fv(DrawDebug.colorUniform, new Float32Array([
      drawOptions.color.r / 0xFF,
      drawOptions.color.g / 0xFF,
      drawOptions.color.b / 0xFF,
      drawOptions.color.a / 0xFF,
    ]));

    // Bind attributes
    gl.enableVertexAttribArray(DrawDebug.vertexPositionAttribute);
    gl.vertexAttribPointer(
      DrawDebug.vertexPositionAttribute,
      3,
      gl.FLOAT,
      false,
      0,
      0,
    );

    // Draw lines
    gl.drawArrays(gl.LINES, 0, linePoints.length);

    // Cleanup
    gl.disableVertexAttribArray(DrawDebug.vertexPositionAttribute);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.enable(gl.DEPTH_TEST);
  }

  private static initShader(engine: IEngine): void {
    if (DrawDebug.shaderProgram) return;

    const shaderProgram = DrawDebug.shaderProgram = new ShaderProgram(engine, 0, {
      fragmentShaderSource: DebugFragmentShaderSource,
      vertexShaderSource: DebugVertexShaderSource,
    });

    DrawDebug.vertexPositionAttribute = shaderProgram.getAttribute('vertexPosition')!;
    DrawDebug.worldMatrixUniform = shaderProgram.getUniform('worldMatrix')!;
    DrawDebug.colorUniform = shaderProgram.getUniform('color')!;
  }
}


export interface IWireframeDrawable {
  /**
   * An array of faces. Each face is represented by an array of points.
   * Faces will be drawn as a closed-loop polyline that will join the last point
   * to the first.
   */
  getWireframeFaces(): Vector3[][];
}
export function isWireframeDrawable(object: any): object is IWireframeDrawable {
  return 'getWireframeFaces' in object;
}
