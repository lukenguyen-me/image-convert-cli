import { select, confirm } from "@inquirer/prompts";
import * as readline from "node:readline";
import sharp from "sharp";
import * as fs from "node:fs";
import * as path from "node:path";

type SupportedFormat = "webp" | "jpeg" | "jpg";

function filePathCompleter(line: string): readline.CompleterResult {
  const trimmed = line.trim();
  const input = trimmed.split(" ")[0] || ".";

  // Check if input ends with "/" - treat as directory
  const isDirectoryInput = input.endsWith("/");
  const dir = isDirectoryInput ? input.slice(0, -1) || "." : path.dirname(input) || ".";
  const base = isDirectoryInput ? "" : (path.basename(input) || "");

  try {
    const files: fs.Dirent[] = fs.readdirSync(dir, { withFileTypes: true });

    // If input is a directory (ends with /), show all files; otherwise filter by base
    const filtered = base
      ? files.filter((dirent) => dirent.name.startsWith(base))
      : files;

    const completions = filtered.map((dirent) => {
      const fullPath = dir === "." ? dirent.name : `${dir}/${dirent.name}`;
      return dirent.isDirectory() ? `${fullPath}/` : fullPath;
    });

    return [completions.length ? completions : [input], input];
  } catch (error) {
    return [[input], input];
  }
}

/**
 * Input prompt with tab completion for file paths
 */
async function inputWithPathCompletion(
  message: string,
  defaultValue?: string,
  validate?: (input: string) => string | true,
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: filePathCompleter,
  });

  const question = defaultValue
    ? `${message} (${defaultValue}): `
    : `${message}: `;

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      const result = answer.trim() || defaultValue || "";
      rl.close();

      if (validate) {
        const validationResult = validate(result);
        if (validationResult !== true) {
          console.log(`\nError: ${validationResult}`);
          inputWithPathCompletion(message, defaultValue, validate).then(
            resolve,
          );
          return;
        }
      }

      resolve(result);
    });
  });
}

type ConvertOptions = {
  help?: boolean;
  yes?: boolean;
  source?: string;
  format?: SupportedFormat;
  destination?: string;
  compress?: boolean;
};

function showHelp(): void {
  console.log(`Image Converter CLI

Usage:
  imgc [options]
  imgc --source <path> --format <format> [options]
  imgc -y --source <path> --format <format>

Options:
  --help, -h       Show this help message
  --yes, -y        Non-interactive mode (use defaults for optional prompts)
  --source, -s     Source file path (required with -y)
  --format, -f     Target format: webp, jpeg, or jpg (required with -y)
  --dest, -d       Destination path (optional, auto-generated if not provided)
  --compress, -c  Enable compression (optional, default: false)

Examples:
  imgc                           # Interactive mode
  imgc --help                    # Show help
  imgc -y --source photo.png --format webp
  imgc -y --source photo.jpg --format jpeg --compress
`);
}

async function convertImage(options: ConvertOptions = {}): Promise<void> {
  // Show help and exit if --help is passed
  if (options.help) {
    showHelp();
    return;
  }

  // Validate required options in -y mode
  if (options.yes && (!options.source || !options.format)) {
    console.error("Error: -y mode requires --source and --format arguments");
    showHelp();
    return;
  }

  console.log("Image Converter - Convert images to webp, jpeg, or jpg\n");

  // Step 1: Get source file path (always required)
  const sourcePath = options.source || await inputWithPathCompletion(
    "Source file path",
    undefined,
    (input) => {
      if (!input.trim()) {
        return "Please enter a file path";
      }
      if (!fs.existsSync(input)) {
        return "File does not exist";
      }
      return true;
    },
  );

  // Step 2: Select target format (required)
  const targetFormat = options.format || await select<SupportedFormat>({
    message: "Target format:",
    choices: [
      { value: "webp", description: "WebP format (recommended for web)" },
      { value: "jpeg", description: "JPEG format" },
      { value: "jpg", description: "JPG format" },
    ],
  });

  // Step 3: Get destination path (optional)
  const defaultDestName = getDefaultDestinationPath(sourcePath, targetFormat);
  const destinationPath = options.destination || await inputWithPathCompletion(
    "Destination path",
    defaultDestName,
    (input) => {
      if (!input.trim()) {
        return "Please enter a destination path";
      }
      const dir = path.dirname(input);
      if (dir !== "." && !fs.existsSync(dir)) {
        return "Destination directory does not exist";
      }
      return true;
    },
  );

  // Step 4: Ask if user wants compression (skipped in -y mode)
  const compress = options.yes ? false : await confirm({
    message: "Do you want to compress the image?",
    default: false,
  });

  // Step 5: Confirm before proceeding (skipped in -y mode)
  console.log("\nConversion settings:");
  console.log(`  Source: ${sourcePath}`);
  console.log(`  Target format: ${targetFormat.toUpperCase()}`);
  console.log(`  Destination: ${destinationPath}`);
  console.log(`  Compression: ${compress ? "Yes" : "No"}`);

  const shouldProceed = options.yes ? true : await confirm({
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
