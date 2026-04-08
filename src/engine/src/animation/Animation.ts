import type { AnimationDefinition } from "@lofi/engine/loaders/definitions";
import { AnimationChannel } from "./AnimationChannel";

export class Animation {
  public readonly name: string;
  public readonly length: number;
  public readonly channels: AnimationChannel[];

  public constructor(definition: AnimationDefinition) {
    this.name = definition.name;
    this.length = definition.length;
    this.channels = definition.channels.map((channelDefinition) =>
      new AnimationChannel(channelDefinition),
    );
  }
}
