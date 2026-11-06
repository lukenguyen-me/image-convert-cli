import * as readline from "node:readline";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { select, confirm } from "@inquirer/prompts";
import { type FormatSpelling, formatPromptChoices } from "./formats";

export type OutputStream = "stdout" | "stderr";

/** Thrown by any Terminal question when the user presses Ctrl-C instead of answering. */
export class PromptCancelled extends Error {
  constructor() {
    super("Prompt cancelled by the user");
    this.name = "PromptCancelled";
  }
}

/**
 * The one place the CLI asks the user for something and tells the user something.
 * Every prompt and every line of console output goes through a Terminal.
 * Every `ask*` method and `confirm` reject with `PromptCancelled` on Ctrl-C.
 */
export interface Terminal {
  /** Ask for the source file or directory. */
  askSourcePath(): Promise<string>;
  /** Ask which Output Format to convert to. */
  askFormat(): Promise<FormatSpelling>;
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

  return new Promise((resolve, reject) => {
    rl.on("SIGINT", () => {
      rl.close();
      process.stdout.write("\n");
      reject(new PromptCancelled());
    });
    rl.question(question, (answer) => {
      const result = answer.trim() || defaultValue || "";
      rl.close();

      const validationResult = validate(result);
      if (validationResult !== true) {
        console.log(`\nError: ${validationResult}`);
        inputWithPathCompletion(message, defaultValue, validate).then(resolve, reject);
        return;
      }

      resolve(result);
    });
  });
}

/** Turn inquirer's Ctrl-C error into the Terminal's `PromptCancelled`. */
async function cancellable<T>(prompt: Promise<T>): Promise<T> {
  try {
    return await prompt;
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      throw new PromptCancelled();
    }
    throw error;
  }
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

  async askFormat(): Promise<FormatSpelling> {
    return cancellable(select<FormatSpelling>({
      message: "Target format:",
      choices: formatPromptChoices().map((choice) => ({
        value: choice.spelling,
        name: choice.label,
        description: choice.description,
      })),
    }));
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
    return cancellable(confirm({ message: question, default: defaultAnswer }));
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
