import * as path from "node:path";
import type { BatchConversionSummary, ConversionResult, ConversionSettings } from "./types";
import { formatBytes } from "./utils/format";
import { FORMAT_SPELLINGS, INPUT_FORMATS, OUTPUT_FORMATS } from "./formats";

/** "a, b, c" joined with a final conjunction: "a, b or c". */
function listWith(items: readonly string[], conjunction: string): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

const inputLabels = INPUT_FORMATS.map((format) => format.label);
const outputLabels = OUTPUT_FORMATS.map((format) => format.label);
const inputExtensions = INPUT_FORMATS.flatMap((format) => format.extensions);

export const BANNER = `Image Converter - Convert ${listWith(inputLabels, "or")} images to ${listWith(outputLabels, "or")}\n`;

export const HELP_TEXT = `Image Converter CLI

Usage:
  imgc [options]
  imgc --source <path> --format <format> [options]
  imgc -y --source <path> --format <format>
  imgc update                     # Check for updates
  imgc version                    # Show version

Options:
  --help, -h       Show this help message
  --version, -v    Show version number
  --yes, -y        Non-interactive mode (use defaults for optional prompts)
  --source, -s     Source file path (required with -y)
  --format, -f     Target format: ${FORMAT_SPELLINGS.slice(0, -1).join(", ")}, or ${FORMAT_SPELLINGS.at(-1)} (required with -y)
                   Input formats: ${inputExtensions.join(", ")}
  --dest, -d       Destination path (optional, auto-generated if not provided)
  --compress, -c   Enable compression (optional, default: false)

Commands:
  update              Check for the latest version on npm
  version             Show version number

Examples:
  imgc                           # Interactive mode
  imgc --help                    # Show help
  imgc --version                 # Show version
  imgc -y --source photo.png --format webp
  imgc -y --source photo.jpg --format jpeg --compress
  imgc update                    # Check for updates
`;

/** The error for a single source that isn't a known Input Format. */
export function unsupportedInputFormatText(sourcePath: string): string {
  return `Error: Unsupported input format: ${sourcePath}\nSupported input formats: ${inputExtensions.join(", ")}`;
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
  return [
    "\n✓ Conversion complete!",
    `  Time: ${result.elapsed}ms`,
    `  Original size: ${formatBytes(result.originalSize)}`,
    `  Output size: ${formatBytes(result.outputSize)}`,
    `  Saved: ${(((result.originalSize - result.outputSize) / result.originalSize) * 100).toFixed(1)}%`,
    `\nOutput saved to: ${result.destinationPath}`,
  ].join("\n");
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
