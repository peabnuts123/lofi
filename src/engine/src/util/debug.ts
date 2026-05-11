import type { ModelDefinition, ModelPartDefinition } from "../loaders/definitions";

export function getAllMaterialNamesForModelDefinition(model: ModelDefinition): string[] {
  const allMaterialNames = new Set<string>();

  const iterateModelPart = (modelPartDefinition: ModelPartDefinition): void => {
    if (modelPartDefinition.mesh) {
      for (const primitive of modelPartDefinition.mesh.primitives) {
        if (primitive.material) {
          allMaterialNames.add(primitive.material.name);
        }
      }
    }

    for (const child of modelPartDefinition.children) {
      iterateModelPart(child);
    }
  };

  for (const rootPart of model.rootParts) {
    iterateModelPart(rootPart);
  }

  return [...allMaterialNames.values()];
}
