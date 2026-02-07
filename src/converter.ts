import sharp from "sharp";
import * as fs from "node:fs";
import type { ConversionResult, SupportedFormat } from "./types";
import { formatBytes } from "./utils/format";

export async function convertImage(
  sourcePath: string,
  destinationPath: string,
  format: SupportedFormat,
  compress: boolean,
): Promise<ConversionResult> {
  const startTime = Date.now();

  try {
    const originalSize = fs.statSync(sourcePath).size;

    // Determine output format for Sharp
    let sharpFormat: keyof sharp.FormatEnum;
    let options: sharp.JpegOptions | sharp.WebpOptions | sharp.PngOptions | sharp.OutputInfo;

    switch (format) {
      case "webp":
        sharpFormat = "webp";
        options = compress
          ? { quality: 100, lossless: true }
          : { quality: 100 };
        break;
      case "jpeg":
      case "jpg":
        sharpFormat = "jpeg";
        options = compress ? { quality: 100, mozjpeg: true } : { quality: 100 };
        break;
      case "png":
        sharpFormat = "png";
        options = compress
          ? { compressionLevel: 9 }
          : { compressionLevel: 6 };
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Perform the conversion
    await sharp(sourcePath)
      .toFormat(sharpFormat, options)
      .toFile(destinationPath);

    const outputSize = fs.statSync(destinationPath).size;
    const elapsed = Date.now() - startTime;

    return {
      success: true,
      sourcePath,
      destinationPath,
      originalSize,
      outputSize,
      elapsed,
    };
  } catch (error) {
    return {
      success: false,
      sourcePath,
      destinationPath,
      originalSize: 0,
      outputSize: 0,
      elapsed: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

export function displayConversionResult(result: ConversionResult): void {
  if (result.success) {
    console.log("\n✓ Conversion complete!");
    console.log(`  Time: ${result.elapsed}ms`);
    console.log(`  Original size: ${formatBytes(result.originalSize)}`);
    console.log(`  Output size: ${formatBytes(result.outputSize)}`);
    console.log(
      `  Saved: ${(((result.originalSize - result.outputSize) / result.originalSize) * 100).toFixed(1)}%`,
    );
    console.log(`\nOutput saved to: ${result.destinationPath}`);
  } else {
    console.error("\n✗ Conversion failed:", result.error);
  }
}
