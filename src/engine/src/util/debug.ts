import type { ModelDefinition, ModelPartDefinition } from "../loaders/definitions";

export interface RateCounter {
  count(): void;
  stop(): void;
}
export function rateCounter(name: string): RateCounter {
  let count = 0;

  const intervalKey = setInterval(() => {
    console.log(`${name}: ${count}`);
    count = 0;
  }, 1000);

  return {
    count() { count++; },
    stop() {
      clearInterval(intervalKey);
    },
  };
};

export function getAllMaterialNamesForModelDefinition(model: ModelDefinition): string[] {
  const allMaterialNames = new Set<string>();

  const iterateModelPart = (modelPartDefinition: ModelPartDefinition) => {
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
