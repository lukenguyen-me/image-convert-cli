import { parseArgs } from "node:util";
import { FORMAT_SPELLINGS, INPUT_FORMATS, type FormatSpelling, isFormatSpelling } from "./formats";

/** A bad command line: the run stops with exit code 2 and the message names the problem. */
export class UsageError extends Error {
  constructor(problem: string) {
    super(problem);
    this.name = "UsageError";
  }
}

/**
 * The convert settings as given on the command line. Any field left out is
 * completed later by the fill-in step (see `fillIn`).
 */
export type ConvertRequest = {
  source?: string;
  format?: FormatSpelling;
  destination?: string;
  /** `true` when -c was given; undefined means "not given", not "off". */
  compress?: true;
  /** -y: an Unattended Run, which never prompts. */
  unattended: boolean;
  /** --overwrite: replace existing output files without asking. */
  overwrite: boolean;
};

/** What one `imgc` invocation asks for. */
export type Command =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "update"; autoInstall: boolean }
  | { kind: "convert"; request: ConvertRequest };

/** Every flag `imgc` accepts. The parser and the help text are both built from this table. */
const FLAGS = {
  help: { type: "boolean", short: "h", help: ["Show this help message"] },
  version: { type: "boolean", short: "v", help: ["Show the version number"] },
  source: {
    type: "string",
    short: "s",
    value: "path",
    help: [
      "Source file, or a directory to convert every image in (required with -y)",
      `Input Formats: ${INPUT_FORMATS.flatMap((format) => format.extensions).join(", ")}`,
    ],
  },
  format: {
    type: "string",
    short: "f",
    value: "format",
    help: [`Output Format: ${FORMAT_SPELLINGS.join(", ")} (required with -y)`],
  },
  dest: {
    type: "string",
    short: "d",
    value: "path",
    help: ["Output file, or output directory for a directory source", "(default: next to the source)"],
  },
  compress: { type: "boolean", short: "c", help: ["Compress the output (default: off)"] },
  yes: {
    type: "boolean",
    short: "y",
    help: ["Unattended Run: never prompt; settings not given take their defaults"],
  },
  overwrite: {
    type: "boolean",
    help: ["Replace output files that already exist (default: ask, or skip them with -y)"],
  },
} as const satisfies Record<
  string,
  { type: "string" | "boolean"; short?: string; value?: string; help: readonly string[] }
>;

type FlagName = keyof typeof FLAGS;

function flagUsage(name: FlagName): string {
  const flag = FLAGS[name] as { short?: string; value?: string };
  return `--${name}${flag.short ? `, -${flag.short}` : ""}${flag.value ? ` <${flag.value}>` : ""}`;
}

function optionsHelp(): string {
  const names = Object.keys(FLAGS) as FlagName[];
  const width = Math.max(...names.map((name) => flagUsage(name).length)) + 2;
  return names
    .flatMap((name) =>
      FLAGS[name].help.map((line, index) => `  ${(index === 0 ? flagUsage(name) : "").padEnd(width)}${line}`),
    )
    .join("\n");
}

export const HELP_TEXT = `Image Converter CLI

Usage:
  imgc [options]
  imgc --source <path> --format <format> [options]
  imgc -y --source <path> --format <format> [options]
  imgc update [-y]                # Check for updates; -y installs without asking
  imgc version                    # Show version

Options:
${optionsHelp()}

Commands:
  update              Check for the latest version on npm
  version             Show the version number

Examples:
  imgc                           # Interactive mode
  imgc --help                    # Show help
  imgc --version                 # Show version
  imgc -y --source photo.png --format webp
  imgc -y --source photo.jpg --format jpeg --compress
  imgc update                    # Check for updates
`;

/** Turn the arguments after `imgc` into one Command, or throw a `UsageError`. */
export function parseCommand(argv: string[]): Command {
  const { values, positionals } = parseStrict(argv);

  for (const name of ["source", "format", "dest"] as const) {
    if (values[name] === "") {
      throw new UsageError(`--${name} needs a value`);
    }
  }

  const [command, ...extra] = positionals;
  const unexpected = extra[0] ?? (command === "version" || command === "update" ? undefined : command);
  if (unexpected !== undefined) {
    throw new UsageError(`unexpected argument '${unexpected}'`);
  }

  if (values.help) {
    return { kind: "help" };
  }
  if (values.version || command === "version") {
    rejectFlagsOtherThan(values, "version", ["version"]);
    return { kind: "version" };
  }
  if (command === "update") {
    rejectFlagsOtherThan(values, "update", ["yes"]);
    return { kind: "update", autoInstall: values.yes === true };
  }

  // Any case is accepted; the lower-cased spelling is the output extension.
  const format = values.format?.toLowerCase();
  if (format !== undefined && !isFormatSpelling(format)) {
    throw new UsageError(`--format '${values.format}' is not an Output Format; use one of ${FORMAT_SPELLINGS.join(", ")}`);
  }

  return {
    kind: "convert",
    request: {
      source: values.source,
      format,
      destination: values.dest,
      compress: values.compress ? true : undefined,
      unattended: values.yes === true,
      overwrite: values.overwrite === true,
    },
  };
}

/** A command other than convert takes only its own flags; a conversion flag there is a mistake, not a no-op. */
function rejectFlagsOtherThan(
  values: Partial<Record<FlagName, unknown>>,
  command: "version" | "update",
  allowed: readonly FlagName[],
): void {
  const stray = (Object.keys(FLAGS) as FlagName[]).find((name) => values[name] !== undefined && !allowed.includes(name));
  if (stray !== undefined) {
    throw new UsageError(`--${stray} does not apply to 'imgc ${command}'`);
  }
}

function parseStrict(argv: string[]) {
  try {
    return parseArgs({ args: argv, options: FLAGS, strict: true, allowPositionals: true });
  } catch (error) {
    throw toUsageError(error as Error & { code?: string });
  }
}

/** Reword the runtime parser's errors so each names the flag in the form the help text uses. */
function toUsageError(error: Error & { code?: string }): Error {
  if (error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") {
    const option = error.message.match(/'([^']+)'/)?.[1];
    return new UsageError(`unknown option '${option}'`);
  }
  if (error.code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") {
    const quoted = error.message.match(/'([^']+)'/)?.[1] ?? "";
    const name = (Object.keys(FLAGS) as FlagName[]).find((flag) => {
      const short: string | undefined = (FLAGS[flag] as { short?: string }).short;
      return quoted.split(/[\s,]+/).some((token) => token === `--${flag}` || (short && token === `-${short}`));
    });
    return new UsageError(name ? `--${name} needs a value` : error.message);
  }
  return error;
}
