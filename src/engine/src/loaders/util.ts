import  { Vector3 } from "@lopoly/core/math/Vector3";
import  { Quaternion } from "@lopoly/core/math/Quaternion";
import  { Matrix4 } from "@lopoly/core/math/Matrix4";
import  { type TypedArray } from "@lopoly/core/util";
import type { AnimationDefinition, ModelDefinition, ModelPartDefinition } from "./definitions";


export const ZUpConversionQuaternion = Quaternion.fromAxisAngle(Vector3.right(), 90);
export const ZUpConversionQuaternionInverse = ZUpConversionQuaternion.invert();
export const ZUpConversionMatrix = Matrix4.fromRotationTranslationScale(
  ZUpConversionQuaternion,
  Vector3.zero(),
  Vector3.one(),
);
export const ZUpConversionMatrixInverse = ZUpConversionMatrix.invert();

type ProcessedBufferSet = Set<TypedArray>;
export function changeYUpModelDefinitionToZUp(modelDefinition: ModelDefinition): ModelDefinition {
  const processedBuffers: ProcessedBufferSet = new Set();
  modelDefinition.rootParts.forEach((modelPartDefinition) => changeYUpModelPartDefinitionToZUp(modelPartDefinition, processedBuffers));
  modelDefinition.animations.forEach(changeYUpAnimationDefinitionToZUp);
  return modelDefinition;
}

export function changeYUpModelPartDefinitionToZUp(modelPartDefinition: ModelPartDefinition, processedBuffers: ProcessedBufferSet): void {
  // Transform
  /* Position */
  ZUpConversionMatrix.transformPointInPlace(modelPartDefinition.transform.position);
  /* Rotation */
  modelPartDefinition.transform.rotation = ZUpConversionQuaternion
    .multiply(modelPartDefinition.transform.rotation)
    .multiplySelf(ZUpConversionQuaternionInverse);
  /* Scale */
  const scale = modelPartDefinition.transform.scale;
  [scale.y, scale.z] = [scale.z, scale.y];

  // Mesh
  if (modelPartDefinition.mesh !== undefined) {
    for (const primitiveDefinition of modelPartDefinition.mesh.primitives) {
      // @NOTE Buffers are shared across primitive instances - we must only mutate them once

      /* Vertex positions */
      if (!processedBuffers.has(primitiveDefinition.positionData.buffer)) {
        processedBuffers.add(primitiveDefinition.positionData.buffer);
        for (let i = 0; i < primitiveDefinition.positionData.buffer.length; i += primitiveDefinition.positionData.componentCount) {
          const y = primitiveDefinition.positionData.buffer[i + 1];
          const z = primitiveDefinition.positionData.buffer[i + 2];
          primitiveDefinition.positionData.buffer[i + 1] = -z;
          primitiveDefinition.positionData.buffer[i + 2] = y;
        }
      }

      /* Vertex normals */
      if (primitiveDefinition.normalData !== undefined) {
        if (!processedBuffers.has(primitiveDefinition.normalData.buffer)) {
          processedBuffers.add(primitiveDefinition.normalData.buffer);
          for (let i = 0; i < primitiveDefinition.normalData.buffer.length; i += primitiveDefinition.normalData.componentCount) {
            const y = primitiveDefinition.normalData.buffer[i + 1];
            const z = primitiveDefinition.normalData.buffer[i + 2];
            primitiveDefinition.normalData.buffer[i + 1] = -z;
            primitiveDefinition.normalData.buffer[i + 2] = y;
          }
        }
      }

      /* Extents */
      primitiveDefinition.extents.transformSelf(ZUpConversionMatrix);
    }
  }

  // Skin
  if (modelPartDefinition.skin !== undefined) {
    for (const inverseBindMatrix of modelPartDefinition.skin.inverseBindMatrices) {
      inverseBindMatrix.setValue(
        ZUpConversionMatrix
          .multiply(inverseBindMatrix)
          .multiplySelf(ZUpConversionMatrixInverse),
      );
    }
  }

  /* Recursively transform children */
  modelPartDefinition.children.forEach((childModelPartDefinition) => changeYUpModelPartDefinitionToZUp(childModelPartDefinition, processedBuffers));
}

export function changeYUpAnimationDefinitionToZUp(animationDefinition: AnimationDefinition): void {
  for (const channel of animationDefinition.channels) {
    switch (channel.targetPartProperty) {
      case 'translation':
        channel.values.values.forEach((value) => ZUpConversionMatrix.transformPointInPlace(value));
        break;
      case 'rotation':
        channel.values.values.forEach((value) =>
          value.setValue(
            ZUpConversionQuaternion
              .multiply(value)
              .multiplySelf(ZUpConversionQuaternionInverse),
          ),
        );
        break;
      case 'scale':
        channel.values.values.forEach((value) => {
          [value.y, value.z] = [value.z, value.y];
        });
        break;
    }
  }
}
