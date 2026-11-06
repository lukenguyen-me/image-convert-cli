import type { FormatSpelling } from "./formats";

export type { FormatSpelling } from "./formats";

export type ConversionResult = {
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  originalSize: number;
  outputSize: number;
  elapsed: number;
  error?: string;
};

export type ConversionSettings = {
  sourcePath: string;
  targetFormat: FormatSpelling;
  destinationPath: string;
  compress: boolean;
};

export type BatchConversionResult = {
  success: boolean;
  sourcePath: string;
  destinationPath: string;
  originalSize: number;
  outputSize: number;
  elapsed: number;
  error?: string;
};

export type BatchConversionSettings = {
  sourceDir: string;
  targetFormat: FormatSpelling;
  destinationDir: string;
  compress: boolean;
  yesMode: boolean;
};

export type BatchConversionSummary = {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: BatchConversionResult[];
  totalElapsed: number;
};
