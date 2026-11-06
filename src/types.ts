import type { FormatSpelling } from "./formats";
import type { SkippedConversion } from "./plan";

/** The outcome of one Conversion that ran, in a single-file run or a Batch. */
export type ConversionResult = {
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  originalSize: number;
  outputSize: number;
  elapsed: number;
  error?: string;
};

/** What one run did: every Conversion that ran, and every one skipped with its reason. */
export type RunSummary = {
  format: FormatSpelling;
  outputDirectory: string;
  /** Every Conversion in the plan, run or skipped. */
  totalFiles: number;
  results: ConversionResult[];
  skipped: SkippedConversion[];
  totalElapsed: number;
};
