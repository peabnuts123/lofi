/**
 * Strip the protocol component from a URI. e.g. `http://foo.bar` => `foo.bar`.
 * NOTE: It is assumed `uri` is a roughly valid URI, so anything preceding `://` will be naively stripped.
 * @param uri URI from which the protocol is to be stripped.
 */
export function stripProtocolFromUri(uri: string): string {
  return uri.replace(/^.*:\/\//, '');
}

/**
 * Canonicalise a given path string. e.g. `/models/../textures/asphalt.png` => `/textures/asphalt.png`
 * @param path A path string. Can be absolute or relative.
 * @param stripProtocol Whether the path needs to have a protocol stripped from it first (e.g. `http://`)
 * @returns Canonicalised string. Whether `path` was absolute or relative will be respected in the result.
 */
export function canonicalisePath(path: string, stripProtocol: boolean = false): string {
  if (stripProtocol) {
    path = stripProtocolFromUri(path);
  }

  // @NOTE lo-fi canonicalisation hack
  const canonical = decodeURIComponent(
    new URL(path, 'http://foo.bar').pathname,
  );

  // Trim leading slash if path was relative
  if (path.startsWith('/')) {
    return canonical;
  } else {
    return canonical.replace(/^\//, '');
  }
}
