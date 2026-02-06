export type SupportedFormat = "webp" | "jpeg" | "jpg";

export type ConvertOptions = {
  help?: boolean;
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
