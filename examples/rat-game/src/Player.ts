import { Vector3, Quaternion, Vector2, Color3 } from '@lopoly/core/math';
import { AudioSourceNode, BoxColliderNode, ModelNode, PointLightNode } from '@lopoly/engine/scene/nodes';
import { SceneNode, type IScene } from '@lopoly/engine/scene';
import { type IInputSystem } from '@lopoly/engine/input';
import type { Camera } from './Camera';
import { Model } from '@lopoly/engine/models';
import { GltfLoader } from '@lopoly/engine/loaders/GltfLoader';
import { AudioClip } from '@lopoly/engine/audio';

// Config
const PlayerMaxSpeed = 3.5;
const Gravity = 24;
const JumpSpeed = 7;
const PlayerFootstepPeriod = 0.15;
const PlayerColliderSize = new Vector3(0.2, 0.45, 0.2);
const CoinMovementElasticity = 3; // @TODO rename

interface Resources {
  playerModel: Model;
  coinModel: Model;
  audioClips: {
    jump: AudioClip;
    footsteps: AudioClip;
  },
}

interface CollectedCoin {
  node: ModelNode;
  animationConfig: {
    frequency: Vector3;
    radius: number;
  },
  currentTarget: Vector3;
}

export class Player extends SceneNode {
  // References
  private readonly resources: Resources;
  private readonly camera: Camera;
  private readonly model: ModelNode;
  private readonly collider: BoxColliderNode;
  private readonly audio: {
    jump: AudioSourceNode,
    move: AudioSourceNode,
  };

  // State
  private isGrounded = false;
  private speed = {
    h: Vector2.zero(),
    v: 0,
    current: Vector3.zero(),
  };
  private lastFootstep = -1;
  private collectedCoins: CollectedCoin[] = [];

  private tmp_coinMovementDelta = Vector3.zero();

  private constructor(scene: IScene, camera: Camera, resources: Resources) {
    super(scene, 'player');
    this.camera = camera;
    this.resources = resources;

    /* Model */
    this.model = new ModelNode(scene, 'player:model', resources.playerModel, this);

    /* Audio */
    const playerAudio = this.audio = {
      jump: new AudioSourceNode(scene, 'player:audio:jump', this),
      move: new AudioSourceNode(scene, 'player:audio:move', this),
    }
    playerAudio.jump.global = true;
    playerAudio.jump.volume = 0.3;
    playerAudio.move.volume = 1;
    playerAudio.move.global = true;

    /* Collider */
    const playerCollider = this.collider = new BoxColliderNode(scene, 'player:collider', 0, PlayerColliderSize, this);
    playerCollider.position.z = PlayerColliderSize.z / 2;

    /* Light */
    const light = new PointLightNode(scene, 'light', { color: Color3.white(), range: 25 }, this);
    light.position.z = 1;
  }

  public override onUpdate(dt: number, time: number): void {
    this.camera.absolutePosition = this.absolutePosition; // @TODO parent?

    /* Input */
    this.speed.h.setValue(0, 0);
    this.speed.v -= Gravity * dt * (this.speed.v < 0 ? 1.5 : 1);

    this.speed.h.x = this.input.getAxisValue('player:x');
    this.speed.h.y = this.input.getAxisValue('player:y');

    if (this.input.wasButtonPressed('player:jump') && this.isGrounded) {
      this.audio.jump.playClip(this.resources.audioClips.jump, { speedRange: 0.1 });
      this.speed.v = JumpSpeed;
    }
    this.speed.h.normalizeSelf().scaleSelf(PlayerMaxSpeed * dt);


    this.speed.current.setValue(this.speed.h.x, this.speed.h.y, 0);
    this.camera.cameraAbsoluteQuaternion.rotateVectorInPlace(this.speed.current)
      .setZ(this.speed.v * dt);

    /* Movement */
    const oldPositionZ = this.position.z;
    this.collider.move(this, this.speed.current);
    const movementResultZ = this.position.z - oldPositionZ;
    this.isGrounded = this.speed.current.z < 0 && (movementResultZ - this.speed.current.z) > 0.001;

    if (this.isGrounded) {
      this.speed.v = 0;
    }
    const footstepId = Math.trunc(time / PlayerFootstepPeriod);
    /* Audio */
    if (this.speed.h.lengthSquared() > 0.0001 && this.isGrounded && footstepId > this.lastFootstep) {
      this.lastFootstep = footstepId;
      this.audio.move.playClip(this.resources.audioClips.footsteps, { speed: 3.5, speedRange: 0.4 });
    }

    // @NOTE Fix bullshit bugs
    if (this.absolutePosition.z < 0) {
      this.absolutePosition.z = 0;
      this.speed.v = 0;
    }

    /* Facing */
    if (this.speed.h.lengthSquared() > 0) {
      this.rotation.q = Quaternion.fromLookDirection(this.speed.current.withZ(0).scaleSelf(-1));
      this.model.rotation.euler.z = Math.sin(time * 20) * 15; // Wiggle
    } else {
      this.model.rotation.euler.z = 0; // Don't wiggle!!!
    }

    /* Coins */
    for (const coin of this.collectedCoins) {
      // Coin is always moving towards a target rotating around the player
      coin.currentTarget.x = this.absolutePosition.x + coin.animationConfig.radius * Math.sin(coin.animationConfig.frequency.x * time);
      coin.currentTarget.y = this.absolutePosition.y + coin.animationConfig.radius * Math.cos(coin.animationConfig.frequency.y * time);
      coin.currentTarget.z = this.absolutePosition.z + coin.animationConfig.radius * 0.5 * Math.cos(coin.animationConfig.frequency.z * time) + 0.25;

      // Calculate delta between coin's current position and its target
      this.tmp_coinMovementDelta.setValue(coin.currentTarget).subtractSelf(coin.node.absolutePosition);

      // Move towards target
      coin.node.absolutePosition.addSelf(this.tmp_coinMovementDelta.scaleSelf(CoinMovementElasticity * dt));

      // Spin coin
      coin.node.rotation.z = coin.animationConfig.frequency.x * 50 + time * 90;
    }
  }

  public addCoinToPurse(spawnPosition: Vector3): void {
    const coin = new ModelNode(this.scene, `purse:coin`, this.resources.coinModel);
    coin.absolutePosition = spawnPosition;
    coin.scale.scaleSelf(0.3);

    this.collectedCoins.push({
      node: coin,
      animationConfig: {
        frequency: new Vector3(
          Math.random() * 1.5 + 0.8,
          Math.random() * 1.5 + 0.8,
          Math.random() * 1.5 + 0.8,
        ),
        radius: Math.random() * 0.2 + 0.3,
      },
      currentTarget: Vector3.zero(),
    });
  };

  public static async create(scene: IScene, camera: Camera): Promise<Player> {
    /* Model */
    const playerModelDefinition = await GltfLoader.loadModel('/models/rat.glb', scene.engine.fileSystem);
    const playerModel = await Model.fromDefinition(scene.engine, playerModelDefinition);
    const coinModelDefinition = await GltfLoader.loadModel('/models/coin.glb', scene.engine.fileSystem);
    const coinModel = await Model.fromDefinition(scene.engine, coinModelDefinition);

    /* Audio */
    const jumpAudioClip = await AudioClip.load(scene.engine, '/audio/jump1.ogg');
    const footstepAudioClip = await AudioClip.load(scene.engine, '/audio/bookFlip2.ogg');

    return new Player(scene, camera, {
      playerModel,
      coinModel,
      audioClips: {
        jump: jumpAudioClip,
        footsteps: footstepAudioClip,
      },
    });
  }

  private get input(): IInputSystem { return this.scene.engine.inputSystem; }
}
