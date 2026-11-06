import type { BatchConversionSettings, ConvertOptions } from "./types";
import { type FormatSpelling, findInputFormat, isFormatSpelling } from "./formats";
import { PromptCancelled, type Terminal } from "./terminal";
import type { Updater } from "./updater";
import { ExitCode } from "./exit-codes";
import { convertBatch, convertImage } from "./converter";
import { getDefaultDestinationPath, getImageFilesFromDirectory, isDirectory } from "./utils/path";
import {
  BANNER,
  HELP_TEXT,
  batchResultText,
  conversionFailureText,
  conversionSuccessText,
  settingsText,
  unsupportedInputFormatText,
  updatePromptText,
} from "./messages";
import packageJson from "../package.json" with { type: "json" };

/**
 * Run `imgc` with the given arguments (without the executable and script path).
 * All asking and telling goes through `terminal`; all version lookups and installs
 * go through `updater`. Returns the process exit code (see `ExitCode`); never exits the process.
 */
export async function main(argv: string[], terminal: Terminal, updater: Updater): Promise<number> {
  try {
    return await run(argv, terminal, updater);
  } catch (error) {
    if (error instanceof PromptCancelled) {
      return ExitCode.Cancelled;
    }
    throw error;
  }
}

async function run(argv: string[], terminal: Terminal, updater: Updater): Promise<number> {
  if (argv[0] === "update") {
    const autoUpdate = argv.includes("--yes") || argv.includes("-y");
    return runUpdate(autoUpdate, terminal, updater);
  }

  const options = parseArgs(argv);

  if (options.help) {
    terminal.say(HELP_TEXT);
    return 0;
  }

  if (options.version) {
    terminal.say(`image-convert-cli v${currentVersion()}`);
    return 0;
  }

  if (options.yes && (!options.source || !options.format)) {
    terminal.error("Error: -y mode requires --source and --format arguments");
    terminal.say(HELP_TEXT);
    return 0;
  }

  return runConvert(options, terminal);
}

async function runConvert(options: ConvertOptions, terminal: Terminal): Promise<ExitCode> {
  terminal.say(BANNER);

  const sourcePath = options.source || (await terminal.askSourcePath());
  const sourceIsDirectory = isDirectory(sourcePath);

  if (!sourceIsDirectory && !findInputFormat(sourcePath)) {
    terminal.error(unsupportedInputFormatText(sourcePath));
    return ExitCode.ConversionFailed;
  }

  const targetFormat = options.format || (await terminal.askFormat());

  if (sourceIsDirectory) {
    return runBatch(sourcePath, targetFormat, options, terminal);
  }

  const destinationPath =
    options.destination ||
    (await terminal.askDestination(getDefaultDestinationPath(sourcePath, targetFormat)));

  const compress =
    options.yes !== undefined
      ? options.yes
      : await terminal.confirm("Do you want to compress the image?", false);

  const settings = { sourcePath, targetFormat, destinationPath, compress };

  terminal.say(settingsText(settings));

  const shouldProceed =
    options.yes !== undefined
      ? options.yes
      : await terminal.confirm("Proceed with conversion?", true);

  if (!shouldProceed) {
    terminal.say("Conversion cancelled.");
    return ExitCode.Cancelled;
  }

  const result = await convertImage(sourcePath, destinationPath, targetFormat, compress);

  if (result.success) {
    terminal.say(conversionSuccessText(result));
    return ExitCode.Success;
  }
  terminal.error(conversionFailureText(result));
  return ExitCode.ConversionFailed;
}

async function runBatch(
  sourceDir: string,
  targetFormat: FormatSpelling,
  options: ConvertOptions,
  terminal: Terminal,
): Promise<ExitCode> {
  const yesMode = options.yes === true;

  // Destination directory defaults to the source directory
  const destinationDir =
    options.destination || (yesMode ? sourceDir : await terminal.askOutputDirectory(sourceDir));

  const compress = yesMode
    ? false
    : await terminal.confirm("Do you want to compress the image?", false);

  if (!yesMode) {
    const files = getImageFilesFromDirectory(sourceDir);
    const shouldProceed = await terminal.confirm(`Convert ${files.length} files?`, true);
    if (!shouldProceed) {
      terminal.say("Batch conversion cancelled.");
      return ExitCode.Cancelled;
    }
  }

  const settings: BatchConversionSettings = {
    sourceDir,
    targetFormat,
    destinationDir,
    compress,
    yesMode,
  };

  const summary = await convertBatch(settings);
  terminal.say(batchResultText(summary));
  return summary.failureCount > 0 ? ExitCode.ConversionFailed : ExitCode.Success;
}

async function runUpdate(autoUpdate: boolean, terminal: Terminal, updater: Updater): Promise<ExitCode> {
  const version = currentVersion();

  let latestVersion: string;
  try {
    latestVersion = await updater.latestVersion();
  } catch (error) {
    terminal.error(`Error checking for updates: ${(error as Error).message}`);
    return ExitCode.Success;
  }

  if (latestVersion === version) {
    terminal.say(`You are running the latest version: ${version}`);
    return ExitCode.Success;
  }

  terminal.say(`Update available: ${version} -> ${latestVersion}`);

  const shouldUpdate = autoUpdate || (await terminal.confirm(updatePromptText(version, latestVersion), true));
  if (!shouldUpdate) {
    terminal.say("Update cancelled.");
    return ExitCode.Cancelled;
  }

  await install(latestVersion, terminal, updater);
  return ExitCode.Success;
}

async function install(version: string, terminal: Terminal, updater: Updater): Promise<void> {
  terminal.say("Updating image-convert-cli...");
  const outcome = await updater.install(version, (chunk, stream) => terminal.relay(chunk, stream));
  if (outcome.status === "installed") {
    terminal.say("Update completed successfully.");
  } else if (outcome.status === "exited") {
    terminal.error(`Update failed with exit code: ${outcome.exitCode}`);
  } else {
    terminal.error(`Update failed: ${outcome.message}`);
  }
}

function currentVersion(): string {
  return process.env.npm_package_version || packageJson.version;
}

function parseArgs(args: string[]): ConvertOptions {
  const options: ConvertOptions = {};

  // Check for version command (positional argument)
  if (args[0] === "version") {
    options.version = true;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else if (arg === "--yes" || arg === "-y") {
      options.yes = true;
    } else if (arg === "--source" || arg === "-s") {
      options.source = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      const format = args[++i];
      if (format && isFormatSpelling(format)) {
        options.format = format;
      }
    } else if (arg === "--dest" || arg === "-d") {
      options.destination = args[++i];
    } else if (arg === "--compress" || arg === "-c") {
      options.compress = true;
    }
  }

  return options;
}
