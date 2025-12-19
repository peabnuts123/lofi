
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

  public draw(gl: WebGL2RenderingContext): void {
    // quat.setAxisAngle(this.rotation, this.rotationAxis, this.rotationAngle);
    // vec3.set(this.scaleVec, this.scale, this.scale, this.scale);

    // mat4.fromRotationTranslationScale(
    //   this.matWorld,
    //   /* rotation= */ this.rotation,
    //   /* position= */ this.pos,
    //   /* scale= */ this.scaleVec);

    // gl.uniformMatrix4fv(matWorldUniform, false, this.matWorld);
    gl.useProgram(this.shader.program);
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.definition.faces.length * 3, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
}


// interface Shader {
//   program: WebGLProgram;
//   vertexPositionAttribute: number;
//   vertexColorAttribute: number;
// }
export class ShaderProgram {
  public readonly program: WebGLProgram;
  public readonly vertexPositionAttribute: number;
  public readonly vertexColorAttribute: number;

  public constructor(gl: WebGL2RenderingContext) {
    // const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    // const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) {
      throw new Error(`Failed to allocate GL objects`);
    }

    gl.shaderSource(vertexShader, ShaderProgram.getVertexShaderSource());
    gl.shaderSource(fragmentShader, ShaderProgram.getFragmentShaderSource());

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
  }

  private static getVertexShaderSource(): string {
    return `#version 300 es
      in vec4 vertexPosition;
      in vec3 vertexColor;

      out vec3 fragmentColor;

      void main() {
        gl_Position = vertexPosition;
        fragmentColor = vertexColor;
      }
    `;
  }

  private static getFragmentShaderSource(): string {
    return `#version 300 es
      precision mediump float;

      in vec3 fragmentColor;

      out vec4 outputColor;

      void main() {
        outputColor = vec4(fragmentColor, 1.0);
      }
    `;
  }
}

export class Runtime {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;

  private debugMesh: Mesh | undefined;
  // private debugVao: WebGLVertexArrayObject | undefined;
  // private cartridge: CartridgeDefinition | undefined = undefined;
  // private program: WebGLProgram | undefined = undefined;
  // private indexCount: number = 0;


  public constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = this.canvas.getContext('webgl2');
    if (gl === null) {
      throw new Error(`WebGL2 not supported`);
    }

    gl.clearColor(0.42, 0.02, 0.02, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.CULL_FACE);
    // gl.cullFace(gl.BACK);
    // gl.frontFace(gl.CCW);
    // gl.viewport(0, 0, canvas.width, canvas.height);

    this.gl = gl;
  }

  public loadCartridge(cartridge: CartridgeDefinition): void {
    const shader = new ShaderProgram(this.gl);

    // Position buffer
    // const positionBuffer = this.gl.createBuffer();
    // this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    // this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(cartridge.geometry.vertexPositions.flatMap(v => [v.x, v.y, v.z])), this.gl.STATIC_DRAW);


    // this.debugVao = createVaoForGeometry(this.gl, cartridge.geometry[0], shader);
    this.debugMesh = new Mesh(this.gl, cartridge.geometry[0], shader);

    // const positionLocation = this.gl.getAttribLocation(this.program, 'vertexPosition');
    // this.gl.enableVertexAttribArray(positionLocation);
    // this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0);
    // // Color buffer
    // // const colorBuffer = this.gl.createBuffer();
    // // this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    // // this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(cartridge.geometry.vertexColors.flatMap(c => [c.r, c.g, c.b])), this.gl.STATIC_DRAW);

    // const colorLocation = this.gl.getAttribLocation(this.program, 'vertexColor');
    // this.gl.enableVertexAttribArray(colorLocation);
    // this.gl.vertexAttribPointer(colorLocation, 3, this.gl.FLOAT, false, 0, 0);

    // // Index buffer
    // const indexBuffer = this.gl.createBuffer();
    // this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    // const indices = new Uint16Array(cartridge.geometry.faces.flat());
    // this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

    // this.cartridge = cartridge;
  }

  public run(): void {
    // if (!this.program || !this.cartridge) {
    if (!this.debugMesh) {
      throw new Error('Cartridge not loaded');
    }

    // Clear the canvas

    // Use the program
    // this.gl.useProgram(this.program);

    // Draw using indices
    this.debugMesh.draw(this.gl);
    // this.gl.drawElements(this.gl.TRIANGLES, this.cartridge.geometry.faces.flat().length, this.gl.UNSIGNED_SHORT, 0);
  }

  // private createShader(type: number, source: string): WebGLShader | null {
  //   const shader = this.gl.createShader(type);
  //   if (!shader) return null;

  //   this.gl.shaderSource(shader, source);
  //   this.gl.compileShader(shader);

  //   if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
  //     console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
  //     this.gl.deleteShader(shader);
  //     return null;
  //   }

  //   return shader;
  // }

  // private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  //   const program = this.gl.createProgram();
  //   if (!program) return null;

  //   this.gl.attachShader(program, vertexShader);
  //   this.gl.attachShader(program, fragmentShader);
  //   this.gl.linkProgram(program);

  //   if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
  //     console.error('Program linking error:', this.gl.getProgramInfoLog(program));
  //     this.gl.deleteProgram(program);
  //     return null;
  //   }

  //   return program;
  // }
}
