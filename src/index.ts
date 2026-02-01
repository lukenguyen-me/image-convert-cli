import { input, select, confirm } from "@inquirer/prompts";
import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";

type SupportedFormat = "webp" | "jpeg" | "jpg";

async function convertImage(): Promise<void> {
  console.log("Image Converter - Convert images to webp, jpeg, or jpg\n");

  // Step 1: Get source file path
  const sourcePath = await input({
    message: "Source file path:",
    validate: (input) => {
      if (!input.trim()) {
        return "Please enter a file path";
      }
      if (!fs.existsSync(input)) {
        return "File does not exist";
      }
      return true;
    },
  });

  // Step 2: Select target format
  const targetFormat = await select<SupportedFormat>({
    message: "Target format:",
    choices: [
      { value: "webp", description: "WebP format (recommended for web)" },
      { value: "jpeg", description: "JPEG format" },
      { value: "jpg", description: "JPG format" },
    ],
  });

  // Step 3: Get destination path
  const defaultDestName = getDefaultDestinationPath(sourcePath, targetFormat);
  const destinationPath = await input({
    message: "Destination path:",
    default: defaultDestName,
    validate: (input) => {
      if (!input.trim()) {
        return "Please enter a destination path";
      }
      const dir = path.dirname(input);
      if (dir !== "." && !fs.existsSync(dir)) {
        return "Destination directory does not exist";
      }
      return true;
    },
  });

  // Step 4: Ask if user wants compression
  const compress = await confirm({
    message: "Do you want to compress the image?",
    default: false,
  });

  // Confirm before proceeding
  console.log("\nConversion settings:");
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target format: ${targetFormat.toUpperCase()}`);
  console.log(`  Destination: ${destinationPath}`);
  console.log(`  Compression: ${compress ? "Yes" : "No"}`);

  const shouldProceed = await confirm({
    message: "Proceed with conversion?",
    default: true,
  });

  if (!shouldProceed) {
    console.log("Conversion cancelled.");
    return;
  }

  // Perform conversion
  await performConversion(sourcePath, destinationPath, targetFormat, compress);
}

async function performConversion(
  sourcePath: string,
  destinationPath: string,
  format: SupportedFormat,
  compress: boolean = false,
): Promise<void> {
  console.log("\nConverting...");

  const startTime = Date.now();

  try {
    // Determine output format for Sharp
    let sharpFormat: keyof sharp.FormatEnum;
    let options: sharp.JpegOptions | sharp.WebpOptions | sharp.OutputInfo;

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
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Perform the conversion
    await sharp(sourcePath)
      .toFormat(sharpFormat, options)
      .toFile(destinationPath);

    const elapsed = Date.now() - startTime;
    const size = fs.statSync(sourcePath).size;
    const outputSize = fs.statSync(destinationPath).size;

    console.log("\n✓ Conversion complete!");
    console.log(`  Time: ${elapsed}ms`);
    console.log(`  Original size: ${formatBytes(size)}`);
    console.log(`  Output size: ${formatBytes(outputSize)}`);
    console.log(`  Saved: ${(((size - outputSize) / size) * 100).toFixed(1)}%`);
    console.log(`\nOutput saved to: ${destinationPath}`);
  } catch (error) {
    console.error("\n✗ Conversion failed:", (error as Error).message);
    process.exit(1);
  }
}

function getDefaultDestinationPath(
  sourcePath: string,
  format: SupportedFormat,
): string {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}.${format}`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export { convertImage };
