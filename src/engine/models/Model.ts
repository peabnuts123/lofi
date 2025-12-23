import type { Engine } from "@polyzone/engine/Engine";
import type { Vector3 } from "@polyzone/engine/util/vector";

import { SubMesh, type SubMeshDefinition } from "./SubMesh";

export interface ModelDefinition {
  subMeshes: SubMeshDefinition[];
}

export class Model {
  private subMeshes: SubMesh[];

  private constructor(subMeshes: SubMesh[]) {
    this.subMeshes = subMeshes;
  }

  public draw(engine: Engine, position: Vector3, rotation: Vector3, scale: Vector3): void {
    for (const subMesh of this.subMeshes) {
      subMesh.draw(engine, position, rotation, scale);
    }
  }

  public static async fromDefinition(engine: Engine, definition: ModelDefinition): Promise<Model> {
    const subMeshes = await Promise.all(definition.subMeshes.map((subMeshDefinition) =>
      SubMesh.fromDefinition(engine, subMeshDefinition),
    ));
    return new Model(subMeshes);
  }
}
