import  { Vector3 } from "@lopoly/core/math";
import  { Model } from "@lopoly/engine/models";
import  { SceneNode, type IScene } from "@lopoly/engine/scene";
import  { AudioSourceNode, BoxColliderNode, ModelNode } from "@lopoly/engine/scene/nodes";
import type { Player } from "./Player";
import  { AudioClip } from "@lopoly/engine/audio";
import  { GltfLoader } from "@lopoly/engine/loaders/GltfLoader";

/* Config */
const CoinTriggerSize = 0.5;
const CoinPeakHeight = 0.75;
const CoinRotationSpeed = 45;

interface Resources {
  blockModel: Model;
  pillarModel: Model;
  coinModel: Model;
  pickupCoinAudio: AudioClip;
}

export interface RoomBounds {
  min: Vector3;
  max: Vector3;
}

export class Room extends SceneNode {
  private readonly size: Vector3;
  private readonly bounds: RoomBounds;

  private constructor(scene: IScene, size: Vector3, player: Player, resources: Resources) {
    super(scene, 'room');

    this.size = size;
    this.bounds = Room.calculateBounds(size);

    const minX = Math.ceil(-this.size.x / 2) - 1;
    const maxX = Math.ceil(this.size.x / 2) + 1;
    const minY = Math.ceil(-this.size.y / 2) - 1;
    const maxY = Math.ceil(this.size.y / 2) + 1;
    const maxZ = this.size.z + 2;

    /* Models */
    for (let z = 0; z < maxZ; z++) {
      const floor = z === 0;
      const ceiling = z === (maxZ - 1);
      const wall = !floor && !ceiling;

      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          if (
            x > minX && x < (maxX - 1) &&
            y > minX && y < (maxX - 1) &&
            wall
          ) {
            // Don't fill in "wall" layers"
            continue;
          }
          const block = new ModelNode(scene, `room:block(${x},${y})`, resources.blockModel, this);
          block.position.x = x;
          block.position.y = y;
          block.position.z = z - 1;
        }
      }
    }

    /* Colliders */
    // Floor
    const floorCollider = new BoxColliderNode(scene, 'room:floor-collider', 0, { x: this.size.x + 2, y: this.size.y + 2, z: 1 }, this);
    floorCollider.position.z = -0.5;
    // Ceiling
    const ceilingCollider = new BoxColliderNode(scene, 'room:ceiling-collider', 0, { x: this.size.x + 2, y: this.size.y + 2, z: 1 }, this);
    ceilingCollider.position.z = this.size.z + 0.5;
    // Walls - X
    const wallRight = new BoxColliderNode(scene, 'room:wall-right-collider', 0, { x: 1, y: this.size.y + 2, z: this.size.z }, this);
    wallRight.position.x = this.bounds.max.x + 0.5;
    wallRight.position.z = this.size.z / 2;
    const wallLeft = new BoxColliderNode(scene, 'room:wall-left-collider', 0, { x: 1, y: this.size.y + 2, z: this.size.z }, this);
    wallLeft.position.x = this.bounds.min.x - 0.5;
    wallLeft.position.z = this.size.z / 2;
    // Walls - Y
    const wallForward = new BoxColliderNode(scene, 'room:wall-right-collider', 0, { x: this.size.x, y: 1, z: this.size.z }, this);
    wallForward.position.y = this.bounds.max.y + 0.5;
    wallForward.position.z = this.size.z / 2;
    const wallBack = new BoxColliderNode(scene, 'room:wall-right-collider', 0, { x: this.size.x, y: 1, z: this.size.z }, this);
    wallBack.position.y = this.bounds.min.y - 0.5;
    wallBack.position.z = this.size.z / 2;

    /* Blocks */
    const BlockRate = 0.7;
    for (let y = minY + 1; y < maxY - 1; y++) {
      for (let x = minX + 1; x < maxX - 1; x++) {
        if (!(x === 0 && y === 0) && x % 2 === 0 && y % 2 === 0 && Math.random() < BlockRate) {
          const height = 0.5 + Math.random() * 2;

          // Model
          const block = new ModelNode(scene, `block(${x},${y})`, resources.pillarModel, this);
          block.scale.z = height;
          block.position.x = x;
          block.position.y = y;

          // Collider
          const collider = new BoxColliderNode(scene, `block(${x},${y}):collider`, 0, Vector3.one(), block);
          collider.position.z = 0.5;

          // Coin
          new Coin(scene, new Vector3(x, y, height + 0.2), player, this, resources);
        }
      }
    }
  }

  public static async create(scene: IScene, size: Vector3, player: Player): Promise<Room> {
    /* Models */
    const blockModelDefinition = await GltfLoader.loadModel('/models/block.glb', scene.engine.fileSystem);
    const blockModel = await Model.fromDefinition(scene.engine, blockModelDefinition);
    const pillarModelDefinition = await GltfLoader.loadModel('/models/pillar.glb', scene.engine.fileSystem);
    const pillarModel = await Model.fromDefinition(scene.engine, pillarModelDefinition);
    const coinModelDefinition = await GltfLoader.loadModel('/models/coin.glb', scene.engine.fileSystem);
    const coinModel = await Model.fromDefinition(scene.engine, coinModelDefinition);

    /* Audio */
    const pickupCoinAudio = await AudioClip.load(scene.engine, '/audio/coin5.ogg');

    return new Room(scene, size, player, {
      blockModel,
      pillarModel,
      coinModel,
      pickupCoinAudio,
    })
  }

  public static calculateBounds(size: Vector3): RoomBounds {
    return {
      min: new Vector3(-size.x / 2, -size.y / 2, 0),
      max: new Vector3(size.x / 2, size.y / 2, size.z),
    }
  }
}

export class Coin extends SceneNode {
  // References
  private readonly resources: Resources;
  private readonly player: Player;
  private readonly model: ModelNode;
  private readonly audio: AudioSourceNode;

  // State
  private rotationSpeed: number = CoinRotationSpeed;
  private heightOffset: number = 0;
  private seed: number = Math.random();
  private isDestroyed: boolean = false;
  private hasReachedPeakHeight: boolean = false;

  private tmp_playerDelta = Vector3.zero();

  public constructor(scene: IScene, position: Vector3, player: Player, room: Room, resources: Resources) {
    super(scene, `coin(${position.x},${position.y})`, room);

    this.resources = resources;
    this.position = position;
    this.player = player;
    this.model = new ModelNode(scene, `${this.name}:model`, resources.coinModel, this);
    this.model.rotation.z = this.seed * 360;
    this.audio = new AudioSourceNode(scene, `${this.name}:audio`, this);
  }

  public override onUpdate(dt: number, time: number): void {
    this.model.rotation.z = this.seed * 360 + this.rotationSpeed * time;
    if (this.isDestroyed && !this.hasReachedPeakHeight) {
      this.heightOffset += 5 * dt;
      if (this.heightOffset >= CoinPeakHeight) {
        this.hasReachedPeakHeight = true;
      }
    }
    this.model.position.z = this.heightOffset + Math.cos(time + this.seed * 2 * Math.PI) * 0.1;

    this.tmp_playerDelta.setValue(this.model.absolutePosition).subtractSelf(this.player.absolutePosition);
    const playerDistance = this.tmp_playerDelta.length();

    if (!this.isDestroyed && playerDistance < CoinTriggerSize) {
      this.isDestroyed = true;
      this.rotationSpeed *= 30;
      this.audio.playClip(this.resources.pickupCoinAudio);
      setTimeout(() => {
        this.player.addCoinToPurse(this.model.absolutePosition);
        this.destroy();
      }, 500);
    }
  }
}
