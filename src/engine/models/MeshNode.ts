import type { NodeDefinition } from "@polyzone/engine/loaders/definitions/model";
import { Transform } from "@polyzone/engine/util/Transform";
import { Matrix4 } from "@polyzone/engine/util/Matrix4";
import type { DrawQueues, IEngine } from "@polyzone/engine/Engine";
import type { Vector3 } from "@polyzone/engine/util/vector";
import type { Rotation } from "@polyzone/engine/util/Rotation";

import { SubMesh } from "./SubMesh";
import type { MeshSkin } from "./MeshSkin";
import { MeshGeometry, type Edge, type EdgeIndices, type Triangle, type TriangleIndices } from "./MeshGeometry";

export interface MeshNodeArgs {
  name: string;
  meshPrimitives?: SubMesh[];
  meshGeometry?: MeshGeometry;
}

/*
@TODO rename
  - ModelPart?
  - ModelSubNode?
 */
export class MeshNode {
  public readonly name: string;
  private readonly _transform: Transform<MeshNode>;
  private _skin?: MeshSkin;
  private readonly meshPrimitives?: SubMesh[];
  private readonly meshGeometry?: MeshGeometry;

  private readonly _worldMatrixTmp: Matrix4 = new Matrix4();
  private _jointMatricesTmp: Matrix4[] | undefined;
  private _modelViewMatrixTmp: Matrix4 = new Matrix4();

  private constructor({ name, meshPrimitives, meshGeometry }: MeshNodeArgs) {
    this.name = name;
    this.meshPrimitives = meshPrimitives;
    this.meshGeometry = meshGeometry;
    this._transform = new Transform<MeshNode>(this);
  }

  public createInstance(): MeshNode {
    const instance = new MeshNode({
      name: this.name,
      meshPrimitives: this.meshPrimitives,
      meshGeometry: this.meshGeometry,
    });

    return instance;
  }

  public draw(
    drawQueues: DrawQueues,
    viewMatrix: Matrix4,
    worldMatrix: Matrix4,
  ): void {
    if (!this.meshPrimitives?.length) return; // @NOTE Don't bother doing math unless we need it

    this._worldMatrixTmp.setValue(worldMatrix).multiplySelf(this.worldMatrix);

    if (this.skin !== undefined) {
      this.skin.skeleton.forEach((bone, i) => {
        this._jointMatricesTmp![i].setValue(bone.worldMatrix).multiplySelf(this.skin!.inverseBindMatrices[i]);
      });
    }

    this._modelViewMatrixTmp
      .setValue(viewMatrix)
      .multiplySelf(this._worldMatrixTmp);

    for (const subMesh of this.meshPrimitives) {
      subMesh.draw(drawQueues, this._modelViewMatrixTmp, this._worldMatrixTmp, this._jointMatricesTmp);
    }
  }

  public addChild(child: MeshNode): void {
    this.transform.addChild(child.transform);
  }

  public static async fromDefinition(engine: IEngine, definition: NodeDefinition): Promise<MeshNode> {
    const meshPrimitives: SubMesh[] = [];
    let meshGeometry: MeshGeometry | undefined = undefined;
    if (definition.mesh) {
      for (const meshPrimitiveDefinition of definition.mesh.primitives) {
        // @TODO (?) Instances of MeshNode are distinct but share SubMeshes/Primitives
        const subMesh = await SubMesh.fromDefinition(
          engine,
          meshPrimitiveDefinition,
        );

        meshPrimitives.push(subMesh);
      }

      meshGeometry = new MeshGeometry(definition.mesh);
    }

    return new MeshNode({
      name: definition.name,
      meshPrimitives: meshPrimitives,
      meshGeometry,
    });
  }


  public get transform(): Transform<MeshNode> { return this._transform; }
  public get skin(): MeshSkin | undefined { return this._skin; }
  public set skin(value: MeshSkin | undefined) {
    this._skin = value;
    this._jointMatricesTmp = value?.skeleton.map(() => new Matrix4());
  }
  public get children(): MeshNode[] { return this.transform.children.map((childTransform) => childTransform.node); }

  public get position(): Vector3 { return this.transform.position; }
  public set position(value: Vector3) { this.transform.position = value; }
  public get rotation(): Rotation { return this.transform.rotation; }
  public get scale(): Vector3 { return this.transform.scale; }
  public set scale(value: Vector3) { this.transform.scale = value; }

  public get absolutePosition(): Vector3 { return this.transform.absolutePosition; }
  public set absolutePosition(value: Vector3) { this.transform.absolutePosition = value; }
  public get absoluteRotation(): Rotation { return this.transform.absoluteRotation; }
  public get absoluteScale(): Vector3 { return this.transform.absoluteScale; }
  public set absoluteScale(value: Vector3) { this.transform.absoluteScale = value; }

  public get worldMatrix(): Matrix4 { return this.transform.worldMatrix; }

  // @TODO Cache all this based on transform
  // @TODO At least pre-allocate space for arrays, maybe move into MeshGeometry (give access to worldMatrix or something)
  public get allVertexPositions(): Vector3[] | undefined {
    return this.meshGeometry?.vertexPositions.map((vertexPosition) => vertexPosition.multiply(this.worldMatrix));
  }
  public get allVertexNormals(): Vector3[] | undefined {
    return this.meshGeometry?.vertexNormals.map((vertexNormal) => vertexNormal.multiply(this.absoluteRotation.q));
  }
  public get allTriangles(): Triangle[] | undefined {
    const vertexPositions = this.allVertexPositions;
    if (!vertexPositions) return undefined;

    return this.meshGeometry?.triangleIndices.map((triangle) => {
      return [
        vertexPositions[triangle[0]],
        vertexPositions[triangle[1]],
        vertexPositions[triangle[2]],
      ] as Triangle;
    });
  }
  public get allTriangleIndices(): TriangleIndices[] | undefined {
    return this.meshGeometry?.triangleIndices;
  }
  public get allTriangleNormals(): Vector3[] | undefined {
    return this.meshGeometry?.triangleNormals.map((triangleNormal) => triangleNormal.multiply(this.absoluteRotation.q));
  }
  public get allEdges(): Edge[] | undefined {
    const vertexPositions = this.allVertexPositions;
    if (!vertexPositions) return undefined;

    return this.meshGeometry?.edgeIndices.map((edge) => {
      return [
        vertexPositions[edge[0]],
        vertexPositions[edge[1]],
      ] as Edge;
    });
  }
  public get allEdgeIndices(): EdgeIndices[] | undefined {
    return this.meshGeometry?.edgeIndices;
  }
}
