import { IFileSystem } from "./IFileSystem";
import { VirtualFile } from "./VirtualFile";

export class WebFileSystem extends IFileSystem {
  private fileSystemPrefix: string | undefined;

  public constructor(prefix?: string) {
    super(`webfs`);
    this.fileSystemPrefix = prefix;
  }

  public getUrlForPath(path: string): string {
    if (this.fileSystemPrefix) {
      return `${this.fileSystemPrefix}/${path}`;
    } else {
      return path;
    }
  }

  public async readFile(path: string): Promise<VirtualFile> {
    const url = this.getUrlForPath(path);
    console.log(`[WebFileSystem] (readFile) (url='${url}')`);
    const result = await fetch(url);
    const fileBytes = await result.arrayBuffer();
    return new VirtualFile(
      new Uint8Array(fileBytes),
    );
  }
}
