import VertexShaderSource from './shaders/shader.vert?raw';
import FragmentShaderSource from './shaders/shader.frag?raw';
import { mat4, quat, vec3, glMatrix, mat3 } from 'gl-matrix';

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

export interface TextureCoordinate {
  u: number;
  v: number;
}

interface GeometryDefinition {
  vertexPositions: Vector3[];
  vertexColors: Color3[];
  vertexNormals: Vector3[];
  textureCoordinates: TextureCoordinate[];
  faces: number[][];
}

export interface CartridgeDefinition {
  geometry: GeometryDefinition[],
}

function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, data: AllowSharedBufferSource, usage?: GLenum): WebGLBuffer;
function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, size: GLsizeiptr, usage?: GLenum): WebGLBuffer;
function createBuffer(gl: WebGL2RenderingContext, bufferType: GLenum, dataOrSize: AllowSharedBufferSource | GLsizeiptr, usage: GLenum = gl.STATIC_DRAW): WebGLBuffer {
  const AllowedBufferTypes: (keyof WebGL2RenderingContext)[] = [
    'ARRAY_BUFFER',
    'ELEMENT_ARRAY_BUFFER',
    'UNIFORM_BUFFER',
  ];
  if (!AllowedBufferTypes.some((allowedBufferType) => bufferType === gl[allowedBufferType])) {
    throw new Error(`Invalid buffer type. Expected one of: ${AllowedBufferTypes.join(', ')}`);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(bufferType, buffer);
  gl.bufferData(bufferType, dataOrSize as BufferSource, usage); // @NOTE Type laundering
  gl.bindBuffer(bufferType, null);

  return buffer;
}

async function fetchBytes(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url);
  if (response.ok) {
    return response.bytes();
  } else {
    throw new Error(`Failed to get: ${url}`);
  }
}

// @TODO
export class Light {
  public position: Vector3;
  public color: Color3;

  public constructor(position: Vector3, color: Color3) {
    this.position = position;
    this.color = color;
  }
}

export class Texture {
  public readonly texture: WebGLTexture;
  public constructor(gl: WebGL2RenderingContext, texImage2d: () => void) {
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // @NOTE Callback, assumed to call gl.texImage2D()
    texImage2d();

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  public static async fromBytes(gl: WebGL2RenderingContext, bytes: Uint8Array<ArrayBuffer>): Promise<Texture> {
    const blob = new Blob([bytes]);
    const bitmap = await window.createImageBitmap(blob);
    return new Texture(gl, () => {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bitmap,
      );
    });
  }

  public static async fromUrl(gl: WebGL2RenderingContext, url: string): Promise<Texture> {
    const image = new Image();
    image.src = url;

    await new Promise<void>((resolve, reject) => {
      image.onload = (_e) => {
        resolve();
      };
      image.onerror = (_e, _src, _lineno, _colno, err) => {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(err);
      };
    });

    return new Texture(gl, () => {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
    });
  }
}

export class Mesh {
  private shader: ShaderProgram;
  private vao: WebGLVertexArrayObject;
  private definition: GeometryDefinition;
  public texture: Texture;

  private _worldMatrixTmp = mat4.create();
  private _positionTmp = vec3.create();
  private _scaleTmp = vec3.create();
  private _rotationTmp = quat.create();
  private _normalTmp = mat3.create();

  public constructor(gl: WebGL2RenderingContext, geometry: GeometryDefinition, shader: ShaderProgram, texture: Texture) {
    const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.vertexPositions.flatMap(v => [v.x, v.y, v.z])));
    const colorBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.vertexColors.flatMap(c => [c.r, c.g, c.b])));
    const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.vertexNormals.flatMap((n) => [n.x, n.y, n.z])));
    const faceIndexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.faces.flat()));
    const textureCoordinateBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(geometry.textureCoordinates.flatMap((t) => [t.u, t.v])));

    this.vao = gl.createVertexArray();
    if (!this.vao) {
      throw new Error('Failed to create VAO');
    }

    gl.bindVertexArray(this.vao);

    gl.enableVertexAttribArray(shader.vertexPositionAttribute);
    gl.enableVertexAttribArray(shader.vertexColorAttribute);
    gl.enableVertexAttribArray(shader.vertexNormalAttribute);
    gl.enableVertexAttribArray(shader.vertexTextureCoordinateAttribute);

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

    // Vertex normals
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(
      shader.vertexNormalAttribute,
      3,
      gl.FLOAT,
      false,
      3 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    // Vertex texture coordinates
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinateBuffer);
    gl.vertexAttribPointer(
      shader.vertexTextureCoordinateAttribute,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Face indices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
    gl.bindVertexArray(null);

    this.shader = shader;
    this.definition = geometry;
    this.texture = texture;
  }

  public draw(
    gl: WebGL2RenderingContext,
    position: Vector3,
    rotationEuler: Vector3,
    scale: Vector3,
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
    // World matrix
    gl.uniformMatrix4fv(this.shader.worldMatrixUniform, false, this._worldMatrixTmp);

    // Texture
    const textureIndex = 0;
    gl.activeTexture(gl.TEXTURE0 + textureIndex);
    gl.bindTexture(gl.TEXTURE_2D, this.texture.texture);
    gl.uniform1i(this.shader.textureSamplerUniform, textureIndex);

    // Lighting
    mat3.normalFromMat4(this._normalTmp, this._worldMatrixTmp);
    gl.uniformMatrix3fv(this.shader.normalMatrixUniform, false, this._normalTmp);

    // Draw
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

  public draw(gl: WebGL2RenderingContext): void {
    this.mesh.draw(gl, this.position, this.rotation, this.scale);
  }
}

// @TODO IDK man.
const CameraUboDefinition = {
  viewProjectionMatrix: null,
};
export type CameraUboPropertyName = keyof typeof CameraUboDefinition;
export const CameraUboPropertyNames = Object.keys(CameraUboDefinition) as CameraUboPropertyName[];
export const CameraUboIndex = 1;

export class Camera {
  public fov: number;
  public aspectRatio: number;
  public position: Vector3 = { x: 0, y: 0, z: 0 };
  public rotation: Vector3 = { x: 0, y: 0, z: 0 };
  public near: number = 0.1;
  public far: number = 100;
  public readonly ubo: Ubo<CameraUboPropertyName>;

  public constructor(fov: number, aspectRatio: number, ubo: Ubo<CameraUboPropertyName>) {
    this.fov = fov;
    this.aspectRatio = aspectRatio;
    this.ubo = ubo;
  }

  public readonly viewProjectionMatrix = mat4.create();
  private readonly _positionTmp = vec3.create();
  private readonly _rotationTmp = quat.create();
  private readonly _viewMatrixTmp = mat4.create();
  private readonly _projectionMatrixTmp = mat4.create();

  public recalculateViewProjectionMatrix(gl: WebGL2RenderingContext): void {
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
    this.ubo.setProperty(gl, 'viewProjectionMatrix', new Float32Array(this.viewProjectionMatrix));
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

interface UboBufferProperty {
  index: number;
  offset: number;
}
export class Ubo<TPropertyName extends string> {
  private buffer: WebGLBuffer;
  private propertyInfo: Record<TPropertyName, UboBufferProperty>;

  public constructor(gl: WebGL2RenderingContext, uboIndex: number, propertyNames: TPropertyName[], referenceShader: ShaderProgram) {
    // Look up UBO size in bytes
    const blockIndex = gl.getUniformBlockIndex(referenceShader.program, "Camera");
    const blockSize = gl.getActiveUniformBlockParameter(
      referenceShader.program,
      blockIndex,
      gl.UNIFORM_BLOCK_DATA_SIZE,
    ) as GLuint;

    // Create uniform buffer
    this.buffer = createBuffer(gl, gl.UNIFORM_BUFFER, blockSize, gl.DYNAMIC_DRAW);
    // Set uniform buffer index
    gl.bindBufferBase(gl.UNIFORM_BUFFER, uboIndex, this.buffer);

    // Look up property indices
    const uboVariableIndices = gl.getUniformIndices(
      referenceShader.program,
      propertyNames,
    );
    if (!uboVariableIndices) {
      throw new Error(`Failed to look up uniform indices for property names: ${propertyNames.join(',')}`);
    }
    // Look up property byte offsets
    const uboVariableOffsets = gl.getActiveUniforms(
      referenceShader.program,
      uboVariableIndices,
      gl.UNIFORM_OFFSET,
    ) as GLuint[];
    if (!uboVariableOffsets) {
      throw new Error(`Failed to look up uniform offsets for property names: ${propertyNames.join(',')}`);
    }

    // Aggregate indices + offsets into dictionary
    this.propertyInfo = propertyNames.reduce((curr, next, index) => {
      curr[next] = {
        index: uboVariableIndices[index],
        offset: uboVariableOffsets[index],
      };
      return curr;
    }, {} as Record<TPropertyName, UboBufferProperty>);
  }

  public setProperty<TValue extends AllowSharedBufferSource>(gl: WebGL2RenderingContext, propertyName: TPropertyName, value: TValue): void {
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
    gl.bufferSubData(
      gl.UNIFORM_BUFFER,
      this.propertyInfo[propertyName].offset,
      value,
    );
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }
}

export class ShaderProgram {
  public readonly program: WebGLProgram;
  public readonly vertexPositionAttribute: number;
  public readonly vertexColorAttribute: number;
  public readonly vertexNormalAttribute: number;
  public readonly vertexTextureCoordinateAttribute: number;
  public readonly worldMatrixUniform: WebGLUniformLocation;
  public readonly normalMatrixUniform: WebGLUniformLocation;
  public readonly textureSamplerUniform: WebGLUniformLocation;

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
    this.vertexNormalAttribute = gl.getAttribLocation(this.program, 'vertexNormal');
    this.vertexTextureCoordinateAttribute = gl.getAttribLocation(this.program, 'textureCoord');

    this.worldMatrixUniform = gl.getUniformLocation(this.program, 'worldMatrix')!;
    this.normalMatrixUniform = gl.getUniformLocation(this.program, 'normalMatrix')!;
    this.textureSamplerUniform = gl.getUniformLocation(this.program, 'sampler')!;

    if (
      this.vertexPositionAttribute < 0 ||
      this.vertexColorAttribute < 0 ||
      this.vertexNormalAttribute < 0 ||
      !this.worldMatrixUniform ||
      !this.normalMatrixUniform ||
      !this.textureSamplerUniform
    ) {
      throw new Error(`Failed to look up attribute / uniform locations`);
    }

    const cameraUboBlockIndex = gl.getUniformBlockIndex(this.program, "Camera");
    gl.uniformBlockBinding(this.program, cameraUboBlockIndex, CameraUboIndex);
  }
}

export class Runtime {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;

  private camera: Camera | undefined;
  private debugObjects: GameObject[] | undefined;

  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = this.canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (gl === null) {
      throw new Error(`WebGL2 not supported`);
    }

    this.gl = gl;
  }

  public async loadCartridge(cartridge: CartridgeDefinition): Promise<void> {
    const { gl } = this;

    const stoneTextureBytes = await fetchBytes('/textures/stones.png');
    const stoneTexture = await Texture.fromBytes(gl, stoneTextureBytes);

    const shader = new ShaderProgram(gl);

    const debugMesh = new Mesh(gl, cartridge.geometry[0], shader, stoneTexture);
    this.debugObjects = [
      (() => {
        const object = new GameObject(debugMesh);
        object.position.x = -1.5;
        return object;
      })(),
      (() => {
        const object = new GameObject(debugMesh);
        object.position.x = 1.5;
        return object;
      })(),
      (() => {
        const object = new GameObject(debugMesh);
        object.position.z = -1.5;
        return object;
      })(),
      (() => {
        const object = new GameObject(debugMesh);
        object.position.z = 1.5;
        return object;
      })(),
      (() => {
        const object = new GameObject(debugMesh);
        object.position.y = -1;
        object.scale.x = 4;
        object.scale.z = 4;
        return object;
      })(),
    ];


    const cameraUbo = new Ubo(gl, CameraUboIndex, CameraUboPropertyNames, shader);
    this.camera = new Camera(70, this.canvas.width / this.canvas.height, cameraUbo);
  }

  public run(): void {
    if (!this.camera || !this.debugObjects) {
      throw new Error('Cartridge not loaded');
    }
    const { gl } = this;

    // @TODO ???
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    let lastFrameTime = performance.now();
    let debug_cameraAngle = 0;
    const draw = (): void => {
      const camera = this.camera!;
      const debugObjects = this.debugObjects!;

      const thisFrameTime = performance.now();
      const dt = (thisFrameTime - lastFrameTime) / 1000;
      lastFrameTime = thisFrameTime;

      gl.clearColor(0.05, 0.05, 0.2, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      // gl.cullFace(gl.BACK);
      // gl.frontFace(gl.CCW);
      // gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      // debugObject.rotation.y += 30 * dt;
      // debugObject.rotation.y = debugObject.rotation.y % 360;

      debug_cameraAngle += dt * glMatrix.toRadian(15);

      camera.position = {
        x: 3.5 * Math.sin(debug_cameraAngle),
        y: 2 * Math.sin(debug_cameraAngle) + 1,
        z: 3.5 * Math.cos(debug_cameraAngle),
      };
      camera.pointAt({ x: 0, y: 0, z: 0 });

      camera.recalculateViewProjectionMatrix(gl);
      for (const debugObject of debugObjects) {
        debugObject.draw(gl);
      }

      requestAnimationFrame(draw);
    };

    requestAnimationFrame(draw);
  }
}
