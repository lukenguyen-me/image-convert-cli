export type SupportedFormat = "webp" | "jpeg" | "jpg" | "png";

export type ConvertOptions = {
  help?: boolean;
  version?: boolean;
  yes?: boolean;
  source?: string;
  format?: SupportedFormat;
  destination?: string;
  compress?: boolean;
};

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
  targetFormat: SupportedFormat;
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
  targetFormat: SupportedFormat;
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
