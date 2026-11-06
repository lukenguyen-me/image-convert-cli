import * as path from "node:path";
import type { BatchConversionSummary, ConversionResult, ConversionSettings } from "./types";
import { formatBytes } from "./utils/format";
import { INPUT_FORMATS, OUTPUT_FORMATS } from "./formats";

/** "a, b, c" joined with a final conjunction: "a, b or c". */
function listWith(items: readonly string[], conjunction: string): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

const inputLabels = INPUT_FORMATS.map((format) => format.label);
const outputLabels = OUTPUT_FORMATS.map((format) => format.label);
const inputExtensions = INPUT_FORMATS.flatMap((format) => format.extensions);

export const BANNER = `Image Converter - Convert ${listWith(inputLabels, "or")} images to ${listWith(outputLabels, "or")}\n`;

/** The problem with a single source that isn't a known Input Format. */
export function unsupportedInputFormatText(sourcePath: string): string {
  return `Unsupported input format: ${sourcePath}\nSupported input formats: ${inputExtensions.join(", ")}`;
}

/** The report for a usage error: the problem, then where to look for the right usage. */
export function usageErrorText(problem: string): string {
  return `Error: ${problem}\nRun 'imgc --help' for usage.`;
}

export function settingsText(settings: ConversionSettings): string {
  return [
    "\nConversion settings:",
    `  Source: ${settings.sourcePath}`,
    `  Target format: ${settings.targetFormat.toUpperCase()}`,
    `  Destination: ${settings.destinationPath}`,
    `  Compression: ${settings.compress ? "Yes" : "No"}`,
  ].join("\n");
}

/** The report for a successful single-file Conversion. */
export function conversionSuccessText(result: ConversionResult): string {
  const lines = [
    "\n✓ Conversion complete!",
    `  Time: ${result.elapsed}ms`,
    `  Original size: ${formatBytes(result.originalSize)}`,
    `  Output size: ${formatBytes(result.outputSize)}`,
  ];
  // A share of zero bytes is meaningless, so leave the line out (as the Batch summary does).
  if (result.originalSize > 0) {
    lines.push(
      `  Saved: ${(((result.originalSize - result.outputSize) / result.originalSize) * 100).toFixed(1)}%`,
    );
  }
  lines.push(`\nOutput saved to: ${result.destinationPath}`);
  return lines.join("\n");
}

/** The report for a failed single-file Conversion. */
export function conversionFailureText(result: ConversionResult): string {
  return `\n✗ Conversion failed: ${result.error}`;
}

export function batchResultText(summary: BatchConversionSummary): string {
  const lines = [
    "\nBatch conversion complete!",
    `  Total files: ${summary.totalFiles}`,
    `  Converted: ${summary.successCount}`,
    `  Failed: ${summary.failureCount}`,
    `  Skipped: ${summary.skippedCount}`,
    `  Time: ${summary.totalElapsed}ms`,
  ];

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
      lines.push(
        `  Saved: ${(((totalOriginal - totalOutput) / totalOriginal) * 100).toFixed(1)}%`,
      );
    }
  }

  lines.push(
    `\nOutput directory: ${summary.results[0]?.destinationPath ? path.dirname(summary.results[0].destinationPath) : "N/A"}`,
  );

  if (summary.failureCount > 0) {
    lines.push("\nFailed files:");
    for (const result of summary.results) {
      if (!result.success) {
        lines.push(`  - ${result.sourcePath}: ${result.error}`);
      }
    }
  }

  return lines.join("\n");
}

/** The question asked before installing a newer version. */
export function updatePromptText(currentVersion: string, latestVersion: string): string {
  return `Update image-convert-cli ${currentVersion} → ${latestVersion}?`;
}
