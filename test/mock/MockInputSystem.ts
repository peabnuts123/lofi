import type { AddInputArgs, AddInputBindingArgs, IInputSystem, InputConfiguration, InputDeviceId, InputSystem, RemoveInputBindingArgs } from "@polyzone/engine/input";
import type { PlayerNumber, NumberZeroToOne, NumberNegativeOneToOne } from "@polyzone/engine/input/types";

export class MockInputSystem implements IInputSystem {
  configure(_configuration: InputConfiguration): void {
    throw new Error("Method not implemented.");
  }
  addInput(_inputConfig: AddInputArgs): void {
    throw new Error("Method not implemented.");
  }
  removeInput(_type: "button" | "axis", _name: string): void {
    throw new Error("Method not implemented.");
  }
  addInputBinding(_inputBinding: AddInputBindingArgs): void {
    throw new Error("Method not implemented.");
  }
  removeInputBinding(_inputBinding: RemoveInputBindingArgs): void {
    throw new Error("Method not implemented.");
  }
  wasButtonPressed(_buttonName: string, _playerNumber?: PlayerNumber): boolean {
    throw new Error("Method not implemented.");
  }
  wasButtonReleased(_buttonName: string, _playerNumber?: PlayerNumber): boolean {
    throw new Error("Method not implemented.");
  }
  isButtonDown(_buttonName: string, _playerNumber?: PlayerNumber): boolean {
    throw new Error("Method not implemented.");
  }
  getButtonValue(_buttonName: string, _playerNumber?: PlayerNumber): NumberZeroToOne {
    throw new Error("Method not implemented.");
  }
  getAxisValue(_axisName: string, _playerNumber?: PlayerNumber): NumberNegativeOneToOne {
    throw new Error("Method not implemented.");
  }
  lockPointer(): void {
    throw new Error("Method not implemented.");
  }
  releasePointer(): void {
    throw new Error("Method not implemented.");
  }
  getPointer(): InputSystem["state"]["pointer"] {
    throw new Error("Method not implemented.");
  }
  listenForDevices(_listenFn: (deviceId: InputDeviceId) => void): void {
    throw new Error("Method not implemented.");
  }
  stopListeningForDevices(): void {
    throw new Error("Method not implemented.");
  }
  assignInputDeviceToPlayer(_playerNumber: PlayerNumber, _deviceId: InputDeviceId): void {
    throw new Error("Method not implemented.");
  }
}
