import { Vector3 } from "@lofi/core/math/vector";
import { DrawableSceneNode, SceneNode, type IScene } from "@lofi/engine/scene";
import type { DrawTask, IEngine } from "@lofi/engine/Engine";
import type { Model, Triangle } from "@lofi/engine/models";
import { AxisAlignedBoundingBox } from "@lofi/engine/collision";
import { Animation } from "@lofi/engine/animation";
import type { Material } from "@lofi/engine/materials";
import { type IWireframeDrawable } from "@lofi/engine/util/DrawDebug";
import type { MaterialOverrideType } from "@lofi/engine/models/ModelMaterialOverrides";

export class ModelNode extends DrawableSceneNode implements IWireframeDrawable {
  public model: Model;
  private _animationSource: Model;
  private _verticesWorldSpaceTmp: Vector3[];

  private currentAnimationTime: number = 0;
  private currentAnimation: Animation | undefined;
  private currentAnimationSpeed: number = 1;

  public constructor(scene: IScene, name: string, model: Model, parent?: SceneNode) {
    super(scene, name, parent);
    this.model = model.createInstance(); // @TODO Probably going to need a way to "reset" this instance
    this._animationSource = model;
    this._verticesWorldSpaceTmp = model.allVertexPositions.map(() => Vector3.zero());
  }

  public setMaterialOverride(materialName: string, material: Material, type?: MaterialOverrideType): void {
    this.model.setMaterialOverride(materialName, material, type);
  }

  public removeMaterialOverride(materialName: string): void {
    this.model.removeMaterialOverride(materialName);
  }

  public playAnimation(animationName: string, speed: number = 1): void {
    const animation = this.animationSource.animations.find((animation) => animation.name === animationName);
    if (!animation) {
      throw new Error(`Cannot play animation. No animation exists with name '${animationName}'`);
    }
    if (this.currentAnimation !== animation) {
      this.currentAnimation = animation;
      this.currentAnimationTime = 0;
    }
    this.currentAnimationSpeed = speed;
  }

  public stopAnimation(): void {
    this.currentAnimation = undefined;
    this.currentAnimationTime = 0;
    this.currentAnimationSpeed = 1;
  }

  public draw(engine: IEngine, drawQueue: DrawTask[]): void {
    const viewMatrix = engine.activeScene?.activeCamera?.viewMatrix;

    // No scene or no camera = no draw tasks
    if (viewMatrix !== undefined) {
      this.model.draw(engine, drawQueue, viewMatrix, this.worldMatrix);
    }
  }

  public override onUpdate(dt: number, _time: number): void {
    if (this.currentAnimation) {
      for (const channel of this.currentAnimation.channels) {
        channel.update(this.currentAnimationTime, this.model);
      }
      this.currentAnimationTime += dt * this.currentAnimationSpeed;
      // @TODO looping controls
      if (this.currentAnimationTime > this.currentAnimation.length) {
        this.currentAnimationTime %= this.currentAnimation.length;
      }
    }
  }

  public getAABB(): AxisAlignedBoundingBox {
    const verticesWorldSpace = this.getVerticesWorldSpace();
    const min = new Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    const max = new Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

    for (const vertex of verticesWorldSpace) {
      if (vertex.x < min.x) min.x = vertex.x;
      if (vertex.x > max.x) max.x = vertex.x;
      if (vertex.y < min.y) min.y = vertex.y;
      if (vertex.y > max.y) max.y = vertex.y;
      if (vertex.z < min.z) min.z = vertex.z;
      if (vertex.z > max.z) max.z = vertex.z;
    }

    return new AxisAlignedBoundingBox({
      xMin: min.x,
      xMax: max.x,
      yMin: min.y,
      yMax: max.y,
      zMin: min.z,
      zMax: max.z,
    });
  }

  public getWireframeFaces(): Vector3[][] {
    const vertices = this.getVerticesWorldSpace();
    return this.model.allTriangleIndices.map((triangle) => ([
      vertices[triangle[0]],
      vertices[triangle[1]],
      vertices[triangle[2]],
    ]) satisfies Triangle);
  }

  // @TODO If we could observe worldMatrixDirty we could cache this
  public getVerticesWorldSpace(offset: Vector3 = Vector3.zero()): Vector3[] {
    this.model.allVertexPositions.forEach((vertexPosition, i) => {
      this._verticesWorldSpaceTmp[i]
        .setValue(vertexPosition)
        .multiplySelf(this.worldMatrix)
        .addSelf(offset);
    });

    return this._verticesWorldSpaceTmp;
  }

  public get animationSource(): Model { return this._animationSource; }
  public set animationSource(value: Model) {
    this.stopAnimation();
    this._animationSource = value;
  }
}
