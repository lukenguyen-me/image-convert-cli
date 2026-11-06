import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as zlib from "node:zlib";
import decodeHeic from "heic-decode";
import sharp, { type Sharp } from "sharp";

/**
 * Open a HEIC or HEIF source for encoding.
 *
 * sharp reads the container but its prebuilt libvips can't decode HEVC, the codec iPhones and most cameras use.
 * HEVC images are decoded by libheif (as WASM) instead; anything else (an AV1-coded HEIF, or a file whose
 * extension is wrong) goes straight to sharp.
 */
export async function openHeic(source: string): Promise<Sharp> {
  const metadata = await sharp(source).metadata().catch(cantRead(source));
  if (metadata.format !== "heif" || metadata.compression !== "hevc") {
    return sharp(source);
  }

  const decoded = await decodeHeic({ buffer: await fs.readFile(source) }).catch(cantRead(source));
  const raw = sharp(decoded.data, { raw: { width: decoded.width, height: decoded.height, channels: 4 } });
  // libheif always gives RGBA; keep the alpha channel only when the image has one.
  const png = await (metadata.hasAlpha ? raw : raw.removeAlpha()).png({ compressionLevel: 0 }).toBuffer();

  // Raw pixels carry no colour profile. Re-attach the source's (Display P3 on iPhones) so sharp converts
  // to sRGB as it does for any tagged image; withIccProfile() would instead transform the pixels into it.
  return sharp(metadata.icc ? withIccProfile(png, metadata.icc) : png);
}

/**
 * A rejection handler that rethrows as one line naming `source`. libvips repeats a "bad seek" line per
 * attempt before its real reason, and libheif's reasons ("HEIF processing error") never name the file.
 */
function cantRead(source: string): (error: Error) => never {
  return (error) => {
    const reason = error.message.trim().split("\n").at(-1);
    throw new Error(`Can't read ${path.basename(source)}: ${reason}`);
  };
}

/** `png` with `icc` embedded as its colour profile, the pixels untouched. */
function withIccProfile(png: Buffer, icc: Buffer): Buffer {
  // An iCCP chunk: profile name, a NUL, compression method 0 (deflate), then the deflated profile.
  const iccp = pngChunk("iCCP", Buffer.concat([Buffer.from("icc\0\0", "latin1"), zlib.deflateSync(icc)]));
  // It must come before the image data; right after the 8-byte signature and the 25-byte IHDR chunk will do.
  const afterHeader = 8 + 25;
  return Buffer.concat([png.subarray(0, afterHeader), iccp, png.subarray(afterHeader)]);
}

function pngChunk(type: string, body: Buffer): Buffer {
  const typeAndBody = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(typeAndBody));
  return Buffer.concat([length, typeAndBody, crc]);
}
