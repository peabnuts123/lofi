declare module 'online-3d-viewer/source/engine/import/importerobj' {
  interface Vector3 {
    x: number;
    y: number;
    z: number;
  }

  interface Vector2 {
    x: number;
    y: number;
  }

  interface RGBColor {
    r: number;
    g: number;
    b: number;
  }

  interface TextureMap {
    name: string;
    mimeType: string | null;
    buffer: Uint8Array;
    offset: Vector2;
    scale: Vector2;
    rotation: number;
  }

  interface Material {
    type: number;
    source: number;
    name: string;
    color: RGBColor;
    vertexColors: boolean;
    emissive: RGBColor;
    opacity: number;
    transparent: boolean;
    diffuseMap: TextureMap | null;
    bumpMap: TextureMap | null;
    normalMap: TextureMap | null;
    emissiveMap: TextureMap | null;
    alphaTest: number;
    multiplyDiffuseMap: boolean;
    ambient: RGBColor;
    specular: RGBColor;
    shininess: number;
    specularMap: TextureMap | null;
  }

  interface Triangle {
    v0: number;
    v1: number;
    v2: number;
    c0: number | null;
    c1: number | null;
    c2: number | null;
    n0: number | null;
    n1: number | null;
    n2: number | null;
    u0: number | null;
    u1: number | null;
    u2: number | null;
    mat: number | null;
    curve: number;
  }

  interface Mesh {
    name: string;
    propertyGroups: any[];
    vertices: Vector3[];
    normals: Vector3[];
    uvs: Vector2[];
    vertexColors: RGBColor[];
    triangles: Triangle[];
  }

  interface Node {
    name: string;
    parent: Node | null;
    transformation: any;
    childNodes: Node[];
    meshIndices: number[];
    idGenerator: any;
    id: number;
  }

  interface Model {
    name: string;
    propertyGroups: any[];
    unit: number;
    root: Node;
    materials: Material[];
    meshes: Mesh[];
  }

  interface ImportCallbacks {
    onError: () => void;
    onComplete: () => void;
    onSuccess: () => void;
    getFileBuffer: (fileName: string) => (Uint8Array | undefined);
    getDefaultLineMaterialColor: () => void;
    getDefaultMaterialColor: () => void;
  }

  export class ImporterObj {
    model: Model;
    Import(
      name: string,
      extension: string,
      content: Uint8Array,
      callbacks: ImportCallbacks,
    ): void;
  }
}
