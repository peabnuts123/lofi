import { VirtualFile } from "./VirtualFile";

export interface IFileSystem {
  readFile(path: string): Promise<VirtualFile>;
}
