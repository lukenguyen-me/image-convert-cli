import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import { select, confirm } from "@inquirer/prompts";
import type { SupportedFormat, ConversionSettings } from "./types";
import { getDefaultDestinationPath } from "./utils/path";
import { displayConversionResult } from "./converter";

function filePathCompleter(line: string): readline.CompleterResult {
  const trimmed = line.trim();
  const input = trimmed.split(" ")[0] || ".";

  const isDirectoryInput = input.endsWith("/");
  const dir = isDirectoryInput ? input.slice(0, -1) || "." : path.dirname(input) || ".";
  const base = isDirectoryInput ? "" : (path.basename(input) || "");

  try {
    const files: fs.Dirent[] = fs.readdirSync(dir, { withFileTypes: true });

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
          inputWithPathCompletion(message, defaultValue, validate).then(resolve);
          return;
        }
      }

      resolve(result);
    });
  });
}

export interface IPromptService {
  promptSourceFile(validate?: (path: string) => string | true): Promise<string>;
  promptDestination(defaultPath: string, validate?: (path: string) => string | true): Promise<string>;
  promptFormat(): Promise<SupportedFormat>;
  promptCompress(): Promise<boolean>;
  promptConfirm(settings: ConversionSettings): Promise<boolean>;
  showHelp(): void;
  showSettings(settings: ConversionSettings): void;
  showResult(result: { success: boolean; destinationPath: string; elapsed: number; originalSize: number; outputSize: number; error?: string }): void;
}

export class InteractivePromptService implements IPromptService {
  async promptSourceFile(
    validate?: (path: string) => string | true,
  ): Promise<string> {
    return inputWithPathCompletion(
      "Source file path",
      undefined,
      validate ||
        ((input) => {
          if (!input.trim()) {
            return "Please enter a file path";
          }
          if (!fs.existsSync(input)) {
            return "File does not exist";
          }
          return true;
        }),
    );
  }

  async promptDestination(
    defaultPath: string,
    validate?: (path: string) => string | true,
  ): Promise<string> {
    return inputWithPathCompletion(
      "Destination path",
      defaultPath,
      validate ||
        ((input) => {
          if (!input.trim()) {
            return "Please enter a destination path";
          }
          const dir = path.dirname(input);
          if (dir !== "." && !fs.existsSync(dir)) {
            return "Destination directory does not exist";
          }
          return true;
        }),
    );
  }

  async promptFormat(): Promise<SupportedFormat> {
    return select<SupportedFormat>({
      message: "Target format:",
      choices: [
        { value: "webp", description: "WebP format (recommended for web)" },
        { value: "jpeg", description: "JPEG format" },
        { value: "jpg", description: "JPG format" },
      ],
    });
  }

  async promptCompress(): Promise<boolean> {
    return confirm({
      message: "Do you want to compress the image?",
      default: false,
    });
  }

  async promptConfirm(settings: ConversionSettings): Promise<boolean> {
    return confirm({
      message: "Proceed with conversion?",
      default: true,
    });
  }

  showHelp(): void {
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

  showSettings(settings: ConversionSettings): void {
    console.log("\nConversion settings:");
    console.log(`  Source: ${settings.sourcePath}`);
    console.log(`  Target format: ${settings.targetFormat.toUpperCase()}`);
    console.log(`  Destination: ${settings.destinationPath}`);
    console.log(`  Compression: ${settings.compress ? "Yes" : "No"}`);
  }

  showResult(result: { success: boolean; destinationPath: string; elapsed: number; originalSize: number; outputSize: number; error?: string }): void {
    displayConversionResult({
      success: result.success,
      sourcePath: "",
      destinationPath: result.destinationPath,
      originalSize: result.originalSize,
      outputSize: result.outputSize,
      elapsed: result.elapsed,
      error: result.error,
    });
  }
}

export class NoopPromptService implements IPromptService {
  private responses: {
    source?: string;
    destination?: string;
    format?: SupportedFormat;
    compress?: boolean;
    confirm?: boolean;
  };

  constructor(responses?: {
    source?: string;
    destination?: string;
    format?: SupportedFormat;
    compress?: boolean;
    confirm?: boolean;
  }) {
    this.responses = responses || {};
  }

  async promptSourceFile(): Promise<string> {
    return this.responses.source || "";
  }

  async promptDestination(defaultPath: string): Promise<string> {
    return this.responses.destination || defaultPath;
  }

  async promptFormat(): Promise<SupportedFormat> {
    return this.responses.format || "webp";
  }

  async promptCompress(): Promise<boolean> {
    return this.responses.compress ?? false;
  }

  async promptConfirm(): Promise<boolean> {
    return this.responses.confirm ?? true;
  }

  showHelp(): void {}
  showSettings(): void {}
  showResult(): void {}
}
