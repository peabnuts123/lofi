import { mat4 } from "gl-matrix";

import type { IEngine } from "@polyzone/engine/Engine";
import { CameraUboIndex } from "@polyzone/engine/scene/nodes/CameraNode";
import { getAttribute, getUniform } from "@polyzone/engine/materials/ShaderProgram";

import { Vector3 } from "./vector";
import { Color4 } from "./Color4";

const DebugVertexShaderSource = `#version 300 es
  // @TODO use an #include for this
  layout(std140) uniform Camera {
    mat4 viewProjectionMatrix;
  };

  uniform mat4 worldMatrix;
  in vec3 vertexPosition;

  void main() {
    gl_Position = viewProjectionMatrix * worldMatrix * vec4(vertexPosition, 1.0);
  }
`;

const DebugFragmentShaderSource = `#version 300 es
  precision mediump float;

  uniform vec4 color;

  out vec4 outputColor;

  void main() {
    outputColor = color;
  }
`;

interface DrawOptions {
  /** Color used when drawing debug geometry. */
  color: Color4;
  /** World matrix to transform all debug geometry. */
  worldMatrix: mat4;
  /**
   * Draw debug geometry over the top of everything else
   * in the scene.
   */
  overlay: boolean;
}
const DefaultDrawOptions: DrawOptions = {
  color: Color4.yellow(),
  worldMatrix: mat4.create(),
  overlay: false,
};

export class DrawDebug {
  private static shaderProgram: WebGLProgram;
  private static vertexPositionAttribute: number;
  private static worldMatrixUniform: WebGLUniformLocation;
  private static colorUniform: WebGLUniformLocation;
  private static vertexBuffer: WebGLBuffer;

  public static drawPolyLine(engine: IEngine, linePoints: Vector3[], options: Partial<DrawOptions> = {}): void {
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
    const { gl } = engine;
    const drawOptions = {
      ...DefaultDrawOptions,
      ...options,
    };

    // Ensure shader is initialised
    DrawDebug.initShader(gl);

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
      drawOptions.worldMatrix,
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

  private static initShader(gl: WebGL2RenderingContext): void {
    if (this.shaderProgram) return;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) {
      throw new Error(`Failed to allocate GL objects`);
    }

    gl.shaderSource(vertexShader, DebugVertexShaderSource);
    gl.shaderSource(fragmentShader, DebugFragmentShaderSource);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(vertexShader);
      throw new Error(`Failed to compile vertex shader: ${errorMessage}`);
    }
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      const errorMessage = gl.getShaderInfoLog(fragmentShader);
      throw new Error(`Failed to compile fragment shader: ${errorMessage}`);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const errorMessage = gl.getProgramInfoLog(program);
      throw new Error(`Failed to link GL program: ${errorMessage}`);
    }

    this.shaderProgram = program;

    this.vertexPositionAttribute = getAttribute(gl, program, 'vertexPosition', true);
    this.worldMatrixUniform = getUniform(gl, program, 'worldMatrix', true);
    this.colorUniform = getUniform(gl, program, 'color', true);

    const cameraUboBlockIndex = gl.getUniformBlockIndex(program, "Camera");
    gl.uniformBlockBinding(program, cameraUboBlockIndex, CameraUboIndex);

    this.vertexBuffer = gl.createBuffer();
    if (!this.vertexBuffer) {
      throw new Error('Failed to create vertex buffer');
    }
  }
}


export interface IWireframeDrawable {
  /**
   * An array of faces. Each face is a closed-loop poly-line
   * represented by an array of points.
   */
  getWireframeFaces(): Vector3[][];
}
export function isWireframeDrawable(object: any): object is IWireframeDrawable {
  return 'getWireframeFaces' in object;
}
