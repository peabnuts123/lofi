import  { type IReadonlyVector3 } from "@lopoly/core/math/Vector3";
import  { Matrix4 } from "@lopoly/core/math/Matrix4";
import  { Color3 } from "@lopoly/core/math/Color3";
import  type { DrawTask, IEngine } from "@lopoly/engine/Engine";
import  { DefaultShader, Material, MaterialInstance, ShaderVariant } from "@lopoly/engine/materials";
import  { AccessorComponentType, MeshPrimitiveMode } from "@lopoly/engine/loaders/definitions";
import { BufferType, BufferUsage } from "./createBuffer";

export const DebugVertexShaderSource = `#version 300 es
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

export const DebugFragmentShaderSource = `#version 300 es
  precision mediump float;

  out vec4 outputColor;

  uniform vec4 color;

  void main() {
    outputColor = color;
  }
`;

export interface DrawOptions {
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
export const DefaultDrawOptions: DrawOptions = {
  color: Color3.yellow(),
  worldMatrix: new Matrix4(),
  overlay: false,
};

export interface IDebugDraw {
  drawPolyLine(linePoints: readonly IReadonlyVector3[], options?: Partial<DrawOptions>): void;
  drawWireframe(wireframe: IWireframeDrawable, options?: Partial<DrawOptions>): void;
}

export class DebugDraw implements IDebugDraw {
  private shader: ShaderVariant;
  private vertexPositionAttribute: number;
  private colorUniform: WebGLUniformLocation;
  private vertexBuffer: WebGLBuffer;
  private vao: WebGLVertexArrayObject;

  private readonly currentDrawTasks: DrawTask[];

  public constructor(engine: IEngine) {
    this.currentDrawTasks = [];

    const { gl } = engine;

    // @TODO should maybe store this `shader` on `Material.shader` as we're
    //  ~slightly hacking at the moment
    const shader = this.shader = new ShaderVariant(engine, 0, new DefaultShader(
      DebugVertexShaderSource,
      DebugFragmentShaderSource,
    ));

    this.vertexPositionAttribute = shader.getAttribute('vertexPosition')!;
    this.colorUniform = shader.getUniform('color')!;

    // Create VAO
    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error('Failed to create vertex array object');
    }

    // Set up VAO with buffer and attribute configuration
    gl.bindVertexArray(this.vao);

    this.vertexBuffer = gl.createBuffer();
    if (!this.vertexBuffer) {
      throw new Error('Failed to create vertex buffer');
    }

    gl.bindBuffer(BufferType.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(this.vertexPositionAttribute);
    gl.vertexAttribPointer(
      this.vertexPositionAttribute,
      3,
      AccessorComponentType.FLOAT,
      false,
      0,
      0,
    );

    gl.bindVertexArray(null);
  }

  public draw(drawQueue: DrawTask[]): void {
    drawQueue.push(...this.currentDrawTasks);
    this.currentDrawTasks.length = 0;
  }

  public drawPolyLine(linePoints: readonly IReadonlyVector3[], options: Partial<DrawOptions> = {}): void {
    // Map linePoints into (0,1)(1,2),(2,3), etc.
    const vertexPointData = linePoints
      .slice(0, linePoints.length - 1)
      .flatMap((_, index) => {
        return [
          linePoints[index],
          linePoints[index + 1],
        ];
      });

    return this.drawLines(vertexPointData, options);
  }

  public drawWireframe(wireframe: IWireframeDrawable, options: Partial<DrawOptions> = {}): void {
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

    return this.drawLines(vertexPointData, options);
  }

  private drawLines(linePoints: readonly IReadonlyVector3[], options: Partial<DrawOptions>): void {
    const drawOptions = {
      ...DefaultDrawOptions,
      ...options,
    };

    // Build vertex array
    const vertices = new Float32Array(linePoints.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]));

    this.currentDrawTasks.push({
      renderLayer: options.overlay ? Infinity : 0,
      isTransparent: false,
      shaderVariant: this.shader,
      material: MaterialInstance.fromMaterial(Material.DefaultMaterial),
      uniforms: {
        worldMatrix: drawOptions.worldMatrix,
      },
      draw: {
        id: Math.trunc(Math.random() * 0xF000_0000) + 0x1000_0000, //  @NOTE Always unique
        init: () => { }, // @NOTE Because ID is unique, `init()` will ALWAYS be called, so it's not really needed
        exec: ({ gl }) => {
          // Bind VAO (restores attribute configuration)
          gl.bindVertexArray(this.vao);

          // Upload vertex data
          gl.bindBuffer(BufferType.ARRAY_BUFFER, this.vertexBuffer);
          gl.bufferData(BufferType.ARRAY_BUFFER, vertices, BufferUsage.DYNAMIC_DRAW);

          // Bind uniforms
          gl.uniform4fv(this.colorUniform, new Float32Array([
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
    });
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
