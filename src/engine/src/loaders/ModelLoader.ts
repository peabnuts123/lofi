import  type { IFileSystem } from "@lopoly/engine/filesystem";
import type { ModelDefinition } from "./definitions";

/*
  @NOTE The loaders themselves cannot implement this interface,
  as these methods are intended to be implemented statically.
  So e.g. `GltfLoader` (the static reference) should be ASSIGNABLE to `ModelLoader`,
  but GltfLoader itself is not an INSTANCE of `ModelLoader`.

  e.g.
  ```
  const loader: ModelLoader = GltfLoader; // Correct, good
  const loader: ModelLoader = new GltfLoader(); // Incorrect, GltfLoader is abstract / should be static
  ```
 */
export interface ModelLoader {
  loadModel(gltfPath: string, filesystem: IFileSystem): Promise<ModelDefinition>;
}
