import  { Quaternion, Vector3 } from "@lopoly/core/math";
import  type { IInputSystem } from "@lopoly/engine/input";
import  { SceneNode, type IScene } from "@lopoly/engine/scene";
import  { CameraNode, ObjectNode } from "@lopoly/engine/scene/nodes";
import { Room, type RoomBounds } from "./Room";

const CameraRotateSpeed = 150;
const CameraDistance = 3;

export class Camera extends SceneNode {
  private pivot: ObjectNode;
  private camera: CameraNode;

  private roomBounds: RoomBounds;

  public constructor(scene: IScene, aspectRatio: number, roomSize: Vector3) {
    super(scene, 'camera:parent');

    this.roomBounds = Room.calculateBounds(roomSize);

    /* Pivot */
    const pivot = this.pivot = new ObjectNode(scene, 'camera:pivot', this);
    pivot.position.z = 0.0;
    pivot.rotation.euler = new Vector3(35, 0, 0);

    /* Camera */
    const camera = this.camera = new CameraNode(scene, 'camera', 60, aspectRatio, pivot);
    camera.position.y = CameraDistance
  }

  public override onUpdate(dt: number): void {
    let cameraHSpeed = 0;
    let cameraVSpeed = 0;

    const cameraAxisXInput = this.input.getAxisValue('camera:x');
    const cameraAxisYInput = this.input.getAxisValue('camera:y');

    if (cameraAxisXInput !== 0 || cameraAxisYInput !== 0) {
      cameraHSpeed = cameraAxisXInput * CameraRotateSpeed * dt;
      cameraVSpeed = cameraAxisYInput * CameraRotateSpeed * dt;
    }

    this.pivot.rotation.euler.z -= cameraHSpeed;
    if (
      (this.pivot.rotation.euler.x > -85 && cameraVSpeed > 0) ||
      (this.pivot.rotation.euler.x < 85 && cameraVSpeed < 0)
    ) {
      this.pivot.rotation.euler.x -= cameraVSpeed;
    }

    // Reset camera's distance before constraining to room bounds,
    // otherwise we can shorten the camera's distance permanently
    this.camera.position.x = 0;
    this.camera.position.z = 0;
    this.camera.position.y = CameraDistance;

    this.containToRoomBounds();
    this.camera.pointAt(this.pivot.absolutePosition);
  }

  public containToRoomBounds(): void {
    const target = this.camera;
    if (target.absolutePosition.x > this.roomBounds.max.x) {
      target.absolutePosition.x = this.roomBounds.max.x;
    } else if (target.absolutePosition.x < this.roomBounds.min.x) {
      target.absolutePosition.x = this.roomBounds.min.x;
    }
    if (target.absolutePosition.y > this.roomBounds.max.y) {
      target.absolutePosition.y = this.roomBounds.max.y;
    } else if (target.absolutePosition.y < this.roomBounds.min.y) {
      target.absolutePosition.y = this.roomBounds.min.y;
    }
    if (target.absolutePosition.z > this.roomBounds.max.z) {
      target.absolutePosition.z = this.roomBounds.max.z;
    } else if (target.absolutePosition.z < this.roomBounds.min.z) {
      target.absolutePosition.z = this.roomBounds.min.z;
    }
  }

  private get input(): IInputSystem { return this.scene.engine.inputSystem; }
  public get cameraAbsoluteQuaternion(): Quaternion { return this.camera.absoluteRotation.q; }
}
