import * as os from "node:os";
import * as path from "node:path";
import { type ConvertRequest, UsageError } from "./command";
import { type FormatSpelling, findInputFormat } from "./formats";
import type { Terminal } from "./terminal";
import { unsupportedInputFormatText } from "./messages";
import { getDefaultDestinationPath, isDirectory } from "./utils/path";

/** Complete convert settings: every field the run needs, after the fill-in step. */
export type ConvertSettings = {
  source: string;
  /** Whether the source is a directory, i.e. the run is a Batch. */
  sourceIsDirectory: boolean;
  format: FormatSpelling;
  /** The output file, or for a Batch the output directory. */
  destination: string;
  compress: boolean;
  unattended: boolean;
};

/**
 * Complete the parser's partial settings. Every field follows one rule: use the flag;
 * otherwise prompt, unless this is an Unattended Run; otherwise use the default;
 * otherwise it's a usage error. `~` is expanded in every path, flag or typed.
 */
export async function fillIn(request: ConvertRequest, terminal: Terminal): Promise<ConvertSettings> {
  const ask = <T>(field: string, prompt: () => Promise<T>, fallback?: () => T): Promise<T> | T => {
    if (!request.unattended) {
      return prompt();
    }
    if (fallback) {
      return fallback();
    }
    throw new UsageError(`${field} is required with -y`);
  };

  const source = expandHome(request.source ?? (await ask("--source", () => terminal.askSourcePath())));
  const sourceIsDirectory = isDirectory(source);
  if (!sourceIsDirectory && !findInputFormat(source)) {
    throw new UsageError(unsupportedInputFormatText(source));
  }

  const format = request.format ?? (await ask("--format", () => terminal.askFormat()));

  const defaultDestination = sourceIsDirectory ? source : getDefaultDestinationPath(source, format);
  const destination = expandHome(
    request.destination ??
      (await ask(
        "--dest",
        () =>
          sourceIsDirectory
            ? terminal.askOutputDirectory(defaultDestination)
            : terminal.askDestination(defaultDestination),
        () => defaultDestination,
      )),
  );

  const compress =
    request.compress ??
    (await ask("--compress", () => terminal.confirm("Do you want to compress the image?", false), () => false));

  return { source, sourceIsDirectory, format, destination, compress, unattended: request.unattended };
}

/**
 * Expand a leading `~` to the home directory, as a shell would.
 * `$HOME` wins over the OS account's home directory, as it does in a shell.
 */
export function expandHome(filePath: string): string {
  if (filePath !== "~" && !filePath.startsWith("~/")) {
    return filePath;
  }
  const home = process.env.HOME || os.homedir();
  return path.join(home, filePath.slice(1));
}
