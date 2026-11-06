import type { ConversionResult, RunSummary } from "./types";
import type { Conversion } from "./plan";
import type { ConvertSettings } from "./settings";
import { formatBytes } from "./utils/format";
import { type FormatSpelling, INPUT_FORMATS, OUTPUT_FORMATS, findOutputFormat } from "./formats";

/** "a, b, c" joined with a final conjunction: "a, b or c". */
function listWith(items: readonly string[], conjunction: string): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}

const inputLabels = INPUT_FORMATS.map((format) => format.label);
const outputLabels = OUTPUT_FORMATS.map((format) => format.label);
const inputExtensions = INPUT_FORMATS.flatMap((format) => format.extensions);

export const BANNER = `Image Converter - Convert ${listWith(inputLabels, "or")} images to ${listWith(outputLabels, "or")}\n`;

/** How the user can resolve Conversions whose output files already exist. */
export type ExistingOutputsChoice = "overwrite" | "skip" | "cancel";

/** The choices for existing output files, in the order they are offered. */
export const EXISTING_OUTPUTS_CHOICES: readonly { value: ExistingOutputsChoice; name: string }[] = [
  { value: "overwrite", name: "overwrite all" },
  { value: "skip", name: "skip them" },
  { value: "cancel", name: "cancel" },
];

/** The question asked once when the plan would replace `count` existing files, before the choices. */
export function existingOutputsQuestion(count: number): string {
  return count === 1 ? "1 file exists" : `${count} files exist`;
}

/** The problem with a single source that isn't a known Input Format. */
export function unsupportedInputFormatText(sourcePath: string): string {
  return `Unsupported input format: ${sourcePath}\nSupported input formats: ${inputExtensions.join(", ")}`;
}

/** The report for a usage error: the problem, then where to look for the right usage. */
export function usageErrorText(problem: string): string {
  return `Error: ${problem}\nRun 'imgc --help' for usage.`;
}

export function settingsText(settings: ConvertSettings): string {
  return [
    "\nConversion settings:",
    `  Source: ${settings.source}`,
    `  Target format: ${settings.format.toUpperCase()}`,
    `  Destination: ${settings.destination}`,
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

/** Why a Conversion was skipped, as shown in the result summary. */
function skipReasonText(conversion: Conversion, format: FormatSpelling): string {
  switch (conversion.skip) {
    case "same-format":
      return `already ${findOutputFormat(format)?.label ?? format.toUpperCase()}`;
    case "output-exists":
      return `${conversion.output} already exists`;
    default:
      return "not skipped";
  }
}

/** The report for a single-file Conversion that was skipped. */
export function conversionSkippedText(conversion: Conversion, format: FormatSpelling): string {
  return `\nSkipped ${conversion.source}: ${skipReasonText(conversion, format)}`;
}

/** The result summary of a Batch. */
export function batchResultText(summary: RunSummary): string {
  const converted = summary.results.filter((result) => result.success);
  const failed = summary.results.filter((result) => !result.success);
  const lines = [
    "\nBatch conversion complete!",
    `  Total files: ${summary.totalFiles}`,
    `  Converted: ${converted.length}`,
    `  Failed: ${failed.length}`,
    `  Skipped: ${summary.skipped.length}`,
    `  Time: ${summary.totalElapsed}ms`,
  ];

  const totalOriginal = converted.reduce((total, result) => total + result.originalSize, 0);
  const totalOutput = converted.reduce((total, result) => total + result.outputSize, 0);
  if (totalOriginal > 0) {
    lines.push(`  Saved: ${(((totalOriginal - totalOutput) / totalOriginal) * 100).toFixed(1)}%`);
  }

  lines.push(`\nOutput directory: ${summary.outputDirectory}`);

  if (failed.length > 0) {
    lines.push("\nFailed files:");
    for (const result of failed) {
      lines.push(`  - ${result.sourcePath}: ${result.error}`);
    }
  }

  if (summary.skipped.length > 0) {
    lines.push("\nSkipped files:");
    for (const conversion of summary.skipped) {
      lines.push(`  - ${conversion.source}: ${skipReasonText(conversion, summary.format)}`);
    }
  }

  return lines.join("\n");
}

/** The question asked before installing a newer version. */
export function updatePromptText(currentVersion: string, latestVersion: string): string {
  return `Update image-convert-cli ${currentVersion} → ${latestVersion}?`;
}
