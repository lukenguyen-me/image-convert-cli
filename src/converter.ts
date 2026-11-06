import * as fs from "node:fs";
import * as path from "node:path";
import { type FormatSpelling, encode, isSameFormat } from "./formats";
import type {
  ConversionResult,
  BatchConversionSettings,
  BatchConversionSummary,
  BatchConversionResult,
} from "./types";
import { getImageFilesFromDirectory, ensureDirectoryExists } from "./utils/path";

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
    const destPath = path.join(
      settings.destinationDir,
      `${path.parse(sourcePath).name}.${settings.targetFormat}`,
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
