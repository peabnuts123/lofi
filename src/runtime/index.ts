import VertexShaderSource from './shaders/shader.vert?raw';
import FragmentShaderSource from './shaders/shader.frag?raw';
import { mat4, quat, vec3, glMatrix } from 'gl-matrix';

export interface Color3 {
  r: number;
  g: number;
  b: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface GeometryDefinition {
  vertexPositions: Vector3[];
  vertexColors: Color3[];
  faces: number[][];
}

export interface CartridgeDefinition {
  geometry: GeometryDefinition[],
}

function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, data: AllowSharedBufferSource, usage: GLenum = gl.STATIC_DRAW): WebGLBuffer {
  if (bufferType != gl.ARRAY_BUFFER && bufferType !== gl.ELEMENT_ARRAY_BUFFER) {
    throw new Error(`Invalid buffer type. Expected either 'ARRAY_BUFFER' or 'ELEMENT_ARRAY_BUFFER'`);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, data, usage);

  return buffer;
}

export class Mesh {
  private shader: ShaderProgram;
  private vao: WebGLVertexArrayObject;
  private definition: GeometryDefinition;

  private _worldMatrixTmp = mat4.create();
  private _positionTmp = vec3.create();
  private _scaleTmp = vec3.create();
  private _rotationTmp = quat.create();

  public constructor(gl: WebGL2RenderingContext, geometry: GeometryDefinition, shader: ShaderProgram) {
    const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.vertexPositions.flatMap(v => [v.x, v.y, v.z])));
    const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.vertexColors.flatMap(c => [c.r, c.g, c.b])));
    const faceIndexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.faces.flat()));

    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error('Failed to create VAO');
    }

    gl.bindVertexArray(this.vao);

    gl.enableVertexAttribArray(shader.vertexPositionAttribute);
    gl.enableVertexAttribArray(shader.vertexColorAttribute);

    // Vertex positions
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(
      shader.vertexPositionAttribute,
      3,
      gl.FLOAT,
      false,
      3 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    // Vertex colors
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(
      shader.vertexColorAttribute,
      3,
      gl.FLOAT,
      false,
      3 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Face indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
    gl.bindVertexArray(null);

    this.shader = shader;
    this.definition = geometry;
  }

  public draw(
    gl: WebGL2RenderingContext,
    position: Vector3,
    rotationEuler: Vector3,
    scale: Vector3,
    camera: Camera,
  ): void {
    quat.fromEuler(this._rotationTmp, rotationEuler.x, rotationEuler.y, rotationEuler.z);
    vec3.set(this._scaleTmp, scale.x, scale.y, scale.z);
    vec3.set(this._positionTmp, position.x, position.y, position.z);

    mat4.fromRotationTranslationScale(
      this._worldMatrixTmp,
      this._rotationTmp,
      this._positionTmp,
      this._scaleTmp,
    );

    gl.useProgram(this.shader.program);
    // @TODO where the heck should this go
    gl.uniformMatrix4fv(this.shader.viewProjectionMatrixUniform, false, camera.viewProjectionMatrix);
    gl.uniformMatrix4fv(this.shader.worldMatrixUniform, false, this._worldMatrixTmp);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.definition.faces.length * 3, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
}

export class GameObject {
  private mesh: Mesh;

  public position: Vector3 = { x: 0, y: 0, z: 0 };
  public rotation: Vector3 = { x: 0, y: 0, z: 0 };
  public scale: Vector3 = { x: 1, y: 1, z: 1 };

  public constructor(mesh: Mesh) {
    this.mesh = mesh;
  }

  public draw(gl: WebGL2RenderingContext, camera: Camera): void {
    this.mesh.draw(gl, this.position, this.rotation, this.scale, camera);
  }
}

export class Camera {
  public fov: number;
  public aspectRatio: number;
  public position: Vector3 = { x: 0, y: 0, z: 0 };
  public rotation: Vector3 = { x: 0, y: 0, z: 0 };
  public near: number = 0.1;
  public far: number = 100;

  public constructor(fov: number, aspectRatio: number) {
    this.fov = fov;
    this.aspectRatio = aspectRatio;
  }

  public readonly viewProjectionMatrix = mat4.create();
  private readonly _positionTmp = vec3.create();
  private readonly _rotationTmp = quat.create();
  private readonly _viewMatrixTmp = mat4.create();
  private readonly _projectionMatrixTmp = mat4.create();

  public recalculateViewProjectionMatrix(): void {
    quat.fromEuler(
      this._rotationTmp,
      this.rotation.x,
      this.rotation.y,
      this.rotation.z,
    );
    vec3.set(this._positionTmp, this.position.x, this.position.y, this.position.z);
    mat4.fromRotationTranslation(
      this._viewMatrixTmp,
      this._rotationTmp,
      this._positionTmp,
    );
    mat4.invert(this._viewMatrixTmp, this._viewMatrixTmp);

    mat4.perspective(
      this._projectionMatrixTmp,
      glMatrix.toRadian(this.fov),
      this.aspectRatio,
      this.near,
      this.far,
    );

    mat4.multiply(this.viewProjectionMatrix, this._projectionMatrixTmp, this._viewMatrixTmp);
  }

  public pointAt(target: Vector3): void {
    const dir = vec3.create();
    vec3.subtract(dir, vec3.fromValues(this.position.x, this.position.y, this.position.z), vec3.fromValues(target.x, target.y, target.z));
    vec3.normalize(dir, dir);

    const pitch = Math.atan2(-dir[1], Math.sqrt(dir[0] * dir[0] + dir[2] * dir[2]));
    const yaw = Math.atan2(dir[0], dir[2]);

    this.rotation.x = glMatrix.toDegree(pitch);
    this.rotation.y = glMatrix.toDegree(yaw);
  }
}

export class ShaderProgram {
  public readonly program: WebGLProgram;
  public readonly vertexPositionAttribute: number;
  public readonly vertexColorAttribute: number;
  public readonly worldMatrixUniform: WebGLUniformLocation;
  public readonly viewProjectionMatrixUniform: WebGLUniformLocation;

  public constructor(gl: WebGL2RenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) {
      throw new Error(`Failed to allocate GL objects`);
    }

    gl.shaderSource(vertexShader, VertexShaderSource);
    gl.shaderSource(fragmentShader, FragmentShaderSource);

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

    this.program = program;

    this.vertexPositionAttribute = gl.getAttribLocation(this.program, 'vertexPosition');
    this.vertexColorAttribute = gl.getAttribLocation(this.program, 'vertexColor');

    this.worldMatrixUniform = gl.getUniformLocation(this.program, 'worldMatrix')!;
    this.viewProjectionMatrixUniform = gl.getUniformLocation(this.program, 'viewProjectionMatrix')!;

    if (
      this.vertexPositionAttribute < 0 ||
      this.vertexColorAttribute < 0 ||
      !this.worldMatrixUniform ||
      !this.viewProjectionMatrixUniform) {
      throw new Error(`Failed to look up attribute / uniform locations`);
    }
  }
}

export class Runtime {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;

  private camera: Camera | undefined;
  private debugObject: GameObject | undefined;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = this.canvas.getContext('webgl2', { antialias: false });
    if (gl === null) {
      throw new Error(`WebGL2 not supported`);
    }

    this.gl = gl;
  }

  public loadCartridge(cartridge: CartridgeDefinition): void {
    const shader = new ShaderProgram(this.gl);
    const debugMesh = new Mesh(this.gl, cartridge.geometry[0], shader);
    this.debugObject = new GameObject(debugMesh);
    this.camera = new Camera(90, this.canvas.width / this.canvas.height);
    this.camera.position.z = 5;
    this.camera.position = { x: 1, y: 1, z: 1 };
    this.camera.pointAt({ x: 0, y: 0, z: 0 });
  }

  public run(): void {
    if (!this.camera || !this.debugObject) {
      throw new Error('Cartridge not loaded');
    }

    let lastFrameTime = performance.now();
    const draw = (): void => {
      const { gl } = this;
      const camera = this.camera!;
      const debugObject = this.debugObject!;

      const thisFrameTime = performance.now();
      const dt = (thisFrameTime - lastFrameTime) / 1000;
      lastFrameTime = thisFrameTime;

      gl.clearColor(0.42, 0.02, 0.02, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      // gl.cullFace(gl.BACK);
      // gl.frontFace(gl.CCW);
      // gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      debugObject.rotation.y += 30 * dt;
      debugObject.rotation.y = debugObject.rotation.y % 360;

      camera.recalculateViewProjectionMatrix();
      debugObject.draw(gl, camera);

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
  }
}
