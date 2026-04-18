import { Vector3 } from "@lofi/core/math/vector";
import type { NodeDefinition, TransformDefinition } from "./definitions";
import { Quaternion } from "@lofi/core/math/Quaternion";

/**
 * Wrap a collection of node definitions in a parent node that applies a transform.
 * @param rootNodes Collection of node definitions to be children of the new root node.
 * @param transform Transforms to apply to the collection.
 * @returns A new root node definition.
 */
export function transformDefinition(rootNodes: NodeDefinition[], transform: Partial<TransformDefinition>): NodeDefinition {
  return {
    name: '__rootTransform',
    children: rootNodes,
    transform: Object.assign({
      position: Vector3.zero(),
      rotation: Quaternion.identity(),
      scale: Vector3.one(),
    } satisfies TransformDefinition, transform),
  };
}
