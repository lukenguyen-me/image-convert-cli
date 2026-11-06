import * as fs from "node:fs";
import { type FormatSpelling, encode } from "./formats";
import type { ConversionResult } from "./types";

/** Run one Conversion: encode `sourcePath` into `destinationPath` and measure it. */
export async function convertImage(
  sourcePath: string,
  destinationPath: string,
  format: FormatSpelling,
  compress: boolean,
): Promise<ConversionResult> {
  const startTime = Date.now();

  try {
    const originalSize = fs.statSync(sourcePath).size;

    await encode(sourcePath, destinationPath, format, { compress });

    return {
      success: true,
      sourcePath,
      destinationPath,
      originalSize,
      outputSize: fs.statSync(destinationPath).size,
      elapsed: Date.now() - startTime,
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
