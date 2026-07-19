import  { DrawableSceneNode, SceneNode, type IScene } from "@lopoly/engine/scene";
import  type { DrawTask, IEngine } from "@lopoly/engine/Engine";
import  type { Model } from "@lopoly/engine/models";
import  { Animation } from "@lopoly/engine/animation";
import  type { Material } from "@lopoly/engine/materials";
import  { type IWireframeDrawable, type WireframeFaces } from "@lopoly/engine/util/DebugDraw";
import  { ModelMaterialOverrides, type MaterialOverrideType } from "@lopoly/engine/models/ModelMaterialOverrides";
import  { ModelNodeGeometry } from "@lopoly/engine/models/geometry";

export class ModelNode extends DrawableSceneNode implements IWireframeDrawable {
  private _model: Model;
  private _animationSource: Model;

  private currentAnimationTime: number = 0;
  private currentAnimation: Animation | undefined;
  private currentAnimationSpeed: number = 1;

  public renderLayer: number = 0;
  private materialOverrides: ModelMaterialOverrides;
  private _geometry: ModelNodeGeometry;

  public constructor(scene: IScene, name: string, model: Model, parent?: SceneNode) {
    super(scene, name, parent);
    this._model = model.createInstance();
    this._animationSource = model;
    this.materialOverrides = new ModelMaterialOverrides(model.materialOverrides);
    this._geometry = new ModelNodeGeometry({
      model: this._model,
      worldMatrixComputed: this.worldMatrixComputed,
    });
  }

  public setMaterialOverride(materialName: string, material: Material, type: MaterialOverrideType = 'override'): void {
    this.materialOverrides.setOverride(materialName, material, type);
  }

  public removeMaterialOverride(materialName: string): void {
    this.materialOverrides.removeOverride(materialName);
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
      this.model.draw(engine, drawQueue, viewMatrix, this.worldMatrix, this.materialOverrides, this.renderLayer);
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

  public getWireframeFaces(): WireframeFaces {
    return this.geometry.allTriangles;
  }


  public get animationSource(): Model { return this._animationSource; }
  public set animationSource(value: Model) {
    this.stopAnimation();
    this._animationSource = value;
  }
  public get model(): Model { return this._model; }
  public set model(value: Model) {
    this._model = value.createInstance();
    this.materialOverrides.parent = this._model.materialOverrides;
    this._geometry = new ModelNodeGeometry({
      model: this._model,
      worldMatrixComputed: this.worldMatrixComputed,
    });
  }

  // Geometry
  public get geometry(): ModelNodeGeometry { return this._geometry; }
}
