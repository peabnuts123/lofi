import type { ModelLoader } from './ModelLoader';
import { GltfLoader } from './GltfLoader';
// import { ObjLoader } from './ObjLoader';

export * from './ObjLoader';

export const AllLoaders: ModelLoader[] = [
  GltfLoader,
  // ObjLoader,
];
// @TODO loader function
