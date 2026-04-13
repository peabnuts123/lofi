import type { NodeDefinition } from "./definitions";

export function convertRightHandCoordinateSystemToLeftHand(node: NodeDefinition): void {
  // Mirror geometry across XY plane
  if (node.mesh) {
    node.transform.position.z = -node.transform.position.z;
    node.transform.rotation.x = -node.transform.rotation.x;
    node.transform.rotation.y = -node.transform.rotation.y;
    node.transform.scale.z = -node.transform.scale.z;
  }

  node.children.forEach(convertRightHandCoordinateSystemToLeftHand);
}
