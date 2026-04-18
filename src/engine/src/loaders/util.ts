import { Vector3 } from "@lofi/core/math/vector";
import type { ModelPartDefinition, TransformDefinition } from "./definitions";
import { Quaternion } from "@lofi/core/math/Quaternion";

/**
 * Wrap a collection of part definitions in a parent part that applies a transform.
 * @param rootParts Collection of part definitions to be children of the new root part.
 * @param transform Transforms to apply to the collection.
 * @returns A new root part definition.
 */
export function transformDefinition(rootParts: ModelPartDefinition[], transform: Partial<TransformDefinition>): ModelPartDefinition {
  return {
    name: '__rootTransform',
    children: rootParts,
    transform: Object.assign({
      position: Vector3.zero(),
      rotation: Quaternion.identity(),
      scale: Vector3.one(),
    } satisfies TransformDefinition, transform),
  };
}
