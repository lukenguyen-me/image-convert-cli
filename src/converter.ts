import sharp from "sharp";
import * as fs from "node:fs";
import type {
  ConversionResult,
  SupportedFormat,
  BatchConversionSettings,
  BatchConversionSummary,
  BatchConversionResult,
} from "./types";
import { formatBytes } from "./utils/format";
import {
  getImageFilesFromDirectory,
  isSameFormat,
  ensureDirectoryExists,
  getExtension,
} from "./utils/path";

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
    let sharpInstance = sharp(sourcePath);

    // For SVG input, resize to get proper output dimensions
    if (getExtension(sourcePath) === "svg") {
      sharpInstance = sharpInstance.resize(512, 512, { fit: "inside" });
    }

    await sharpInstance
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

export async function convertBatch(
  settings: BatchConversionSettings,
): Promise<BatchConversionSummary> {
  const startTime = Date.now();
  const files = getImageFilesFromDirectory(settings.sourceDir);

  await ensureDirectoryExists(settings.destinationDir);

  const results: BatchConversionResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const sourcePath of files) {
    const fileName = require("node:path").basename(sourcePath);
    const destPath = require("node:path").join(
      settings.destinationDir,
      `${require("node:path").parse(fileName).name}.${settings.targetFormat}`,
    );

    // Skip files already in target format
    if (isSameFormat(sourcePath, settings.targetFormat)) {
      skippedCount++;
      continue;
    }

    // Skip existing files in yes mode
    if (settings.yesMode && fs.existsSync(destPath)) {
      skippedCount++;
      continue;
    }

    const result = await convertImage(
      sourcePath,
      destPath,
      settings.targetFormat,
      settings.compress,
    );

    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return {
    totalFiles: files.length,
    successCount,
    failureCount,
    skippedCount,
    results,
    totalElapsed: Date.now() - startTime,
  };
}

export function displayBatchResult(summary: BatchConversionSummary): void {
  console.log("\nBatch conversion complete!");
  console.log(`  Total files: ${summary.totalFiles}`);
  console.log(`  Converted: ${summary.successCount}`);
  console.log(`  Failed: ${summary.failureCount}`);
  console.log(`  Skipped: ${summary.skippedCount}`);
  console.log(`  Time: ${summary.totalElapsed}ms`);

  if (summary.successCount > 0) {
    let totalOriginal = 0;
    let totalOutput = 0;

    for (const result of summary.results) {
      if (result.success) {
        totalOriginal += result.originalSize;
        totalOutput += result.outputSize;
      }
    }

    if (totalOriginal > 0) {
      console.log(
        `  Saved: ${(((totalOriginal - totalOutput) / totalOriginal) * 100).toFixed(1)}%`,
      );
    }
  }

  console.log(`\nOutput directory: ${summary.results[0]?.destinationPath ? require("node:path").dirname(summary.results[0].destinationPath) : "N/A"}`);

  if (summary.failureCount > 0) {
    console.log("\nFailed files:");
    for (const result of summary.results) {
      if (!result.success) {
        console.log(`  - ${result.sourcePath}: ${result.error}`);
      }
    }
  }
}
