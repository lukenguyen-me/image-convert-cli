import * as readline from "node:readline";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { select, confirm } from "@inquirer/prompts";
import type { SupportedFormat } from "./types";

export type OutputStream = "stdout" | "stderr";

/**
 * The one place the CLI asks the user for something and tells the user something.
 * Every prompt and every line of console output goes through a Terminal.
 */
export interface Terminal {
  /** Ask for the source file or directory. */
  askSourcePath(): Promise<string>;
  /** Ask which Output Format to convert to. */
  askFormat(): Promise<SupportedFormat>;
  /** Ask for the output file path; an empty answer takes `defaultPath`. */
  askDestination(defaultPath: string): Promise<string>;
  /** Ask for the output directory of a Batch; an empty answer takes `defaultDir`. */
  askOutputDirectory(defaultDir: string): Promise<string>;
  /** Ask a yes/no question. */
  confirm(question: string, defaultAnswer: boolean): Promise<boolean>;

  /** Tell the user something (stdout, one line or block, newline appended). */
  say(text: string): void;
  /** Tell the user about an error (stderr, newline appended). */
  error(text: string): void;
  /** Pass raw output from a child process straight through, unchanged. */
  relay(chunk: string | Uint8Array, stream: OutputStream): void;
}

export function filePathCompleter(line: string): readline.CompleterResult {
  const trimmed = line.trim();
  const input = trimmed.split(" ")[0] || ".";

  const isDirectoryInput = input.endsWith("/");
  let dir = isDirectoryInput
    ? input.slice(0, -1) || "."
    : path.dirname(input) || ".";

  // Expand tilde to home directory
  if (dir === "~" || dir.startsWith("~/")) {
    const homeDir = os.homedir();
    dir = dir === "~" ? homeDir : homeDir + dir.slice(1);
  }

  const base = isDirectoryInput ? "" : path.basename(input) || "";

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
  defaultValue: string | undefined,
  validate: (input: string) => string | true,
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

      const validationResult = validate(result);
      if (validationResult !== true) {
        console.log(`\nError: ${validationResult}`);
        inputWithPathCompletion(message, defaultValue, validate).then(resolve);
        return;
      }

      resolve(result);
    });
  });
}

/** The production Terminal: inquirer prompts, readline Tab completion and the console. */
export class InteractiveTerminal implements Terminal {
  async askSourcePath(): Promise<string> {
    return inputWithPathCompletion("Source file path", undefined, (input) => {
      if (!input.trim()) {
        return "Please enter a file path";
      }
      if (!fs.existsSync(input)) {
        return "File does not exist";
      }
      return true;
    });
  }

  async askFormat(): Promise<SupportedFormat> {
    return select<SupportedFormat>({
      message: "Target format:",
      choices: [
        { value: "webp", description: "WebP format (recommended for web)" },
        { value: "jpeg", description: "JPEG format" },
        { value: "jpg", description: "JPG format" },
        { value: "png", description: "PNG format (lossless)" },
        { value: "ico", description: "ICO format (favicon, embeds 32x32 and 16x16)" },
      ],
    });
  }

  async askDestination(defaultPath: string): Promise<string> {
    return inputWithPathCompletion("Destination path", defaultPath, (input) => {
      if (!input.trim()) {
        return "Please enter a destination path";
      }
      const dir = path.dirname(input);
      if (dir !== "." && !fs.existsSync(dir)) {
        return "Destination directory does not exist";
      }
      return true;
    });
  }

  async askOutputDirectory(defaultDir: string): Promise<string> {
    return inputWithPathCompletion("Output directory", defaultDir, (input) => {
      if (!input.trim()) {
        return "Please enter an output directory";
      }
      if (!fs.existsSync(input)) {
        return "Output directory does not exist";
      }
      return true;
    });
  }

  async confirm(question: string, defaultAnswer: boolean): Promise<boolean> {
    return confirm({ message: question, default: defaultAnswer });
  }

  say(text: string): void {
    console.log(text);
  }

  error(text: string): void {
    console.error(text);
  }

  relay(chunk: string | Uint8Array, stream: OutputStream): void {
    (stream === "stdout" ? process.stdout : process.stderr).write(chunk);
  }
}
