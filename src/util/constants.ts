import { SceneNode, SceneNode2 } from "@polyzone/engine/scene";

export const Flags = {
  UseEulernion: SceneNode.prototype instanceof SceneNode2,
};

console.log(`Flags`, Flags);
