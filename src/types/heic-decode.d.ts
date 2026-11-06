// heic-decode ships no type declarations; this covers the one call the tool makes.
declare module "heic-decode" {
  /** Decode the primary image of a HEIC/HEIF file into 8-bit RGBA pixels. */
  export default function decode(input: { buffer: Uint8Array }): Promise<{
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }>;
}
