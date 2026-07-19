import  { IFileSystem, VirtualFile } from "@lopoly/engine/filesystem";

export class MockFileSystem extends IFileSystem {
  private files: Map<string, Uint8Array<ArrayBuffer>> = new Map();

  constructor(initialFiles?: Record<string, string | Uint8Array<ArrayBuffer>>) {
    super("mock");
    if (initialFiles) {
      for (const [path, content] of Object.entries(initialFiles)) {
        this.addFile(path, content);
      }
    }
  }

  /**
   * Add a file to the mock filesystem.
   * @param path The path of the file
   * @param content The content of the file
   */
  public addFile(path: string, content: string | Uint8Array<ArrayBuffer>): void {
    const bytes = typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content;
    this.files.set(path, bytes);
  }

  /**
   * Remove a file from the mock filesystem.
   * @param path The path of the file to remove
   */
  public removeFile(path: string): void {
    this.files.delete(path);
  }

  /**
   * Check if a file exists in the mock filesystem.
   * @param path The path of the file
   */
  public hasFile(path: string): boolean {
    return this.files.has(path);
  }

  /**
   * Clear all files from the mock filesystem.
   */
  public clear(): void {
    this.files.clear();
  }

  public getUrlForPath(path: string): string {
    return `${this.resolverProtocol}${path}`;
  }

  public readFile(path: string): Promise<VirtualFile> {
    const bytes = this.files.get(path);
    if (!bytes) {
      throw new Error(`File not found: ${path}`);
    }
    return Promise.resolve(new VirtualFile(bytes));
  }
}
