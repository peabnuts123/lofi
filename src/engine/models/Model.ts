import type { Engine } from "@polyzone/engine/Engine";
import type { mat4 } from "gl-matrix";

import { SubMesh, type SubMeshDefinition } from "./SubMesh";

export interface ModelDefinition {
  subMeshes: SubMeshDefinition[];
}

export class Model {
  private subMeshes: SubMesh[];

  private constructor(subMeshes: SubMesh[]) {
    this.subMeshes = subMeshes;
  }

  public draw(engine: Engine, worldMatrix: mat4): void {
    for (const subMesh of this.subMeshes) {
      subMesh.draw(engine, worldMatrix);
    }
  }

  public static async fromDefinition(engine: Engine, definition: ModelDefinition): Promise<Model> {
    const subMeshes = await Promise.all(definition.subMeshes.map((subMeshDefinition) =>
      SubMesh.fromDefinition(engine, subMeshDefinition),
    ));
    return new Model(subMeshes);
  }
}
