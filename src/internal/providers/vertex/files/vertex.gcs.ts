export interface GcsLocation {
  bucket: string;
  prefix: string;
}

export function parseBucketUri(uri: string): GcsLocation {
  const { hostname, pathname } = new URL(uri);
  return { bucket: hostname, prefix: pathname.slice(1) };
}

export function buildGsUri(bucket: string, object: string): string {
  return `gs://${bucket}/${object}`;
}

export function parseGsUri(uri: string): { bucket: string; object: string } {
  const { hostname, pathname } = new URL(uri);
  return { bucket: hostname, object: pathname.slice(1) };
}
