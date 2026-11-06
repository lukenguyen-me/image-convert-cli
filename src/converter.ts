import * as fs from "node:fs";
import { type EncodeOptions, encode } from "./formats";
import type { Conversion } from "./plan";
import type { ConversionResult } from "./types";

/** Run one Conversion: encode its source into its output and measure it. */
export async function convertImage(conversion: Conversion, options: EncodeOptions): Promise<ConversionResult> {
  const { source, output } = conversion;
  const startTime = Date.now();

  try {
    const originalSize = fs.statSync(source).size;

    await encode(source, output, options);

    return {
      success: true,
      source,
      output,
      originalSize,
      outputSize: fs.statSync(output).size,
      elapsed: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      source,
      output,
      originalSize: 0,
      outputSize: 0,
      elapsed: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}
