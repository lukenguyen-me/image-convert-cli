import * as fs from "node:fs";
import type { ConversionResult, RunSummary } from "./types";
import { PromptCancelled, type Terminal } from "./terminal";
import type { Updater } from "./updater";
import { ExitCode } from "./exit-codes";
import { convertImage } from "./converter";
import { planConversions } from "./plan";
import { HELP_TEXT, UsageError, parseCommand } from "./command";
import { type ConvertSettings, fillIn } from "./settings";
import {
  BANNER,
  batchResultText,
  conversionFailureText,
  conversionSuccessText,
  settingsText,
  updatePromptText,
  usageErrorText,
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
    if (error instanceof UsageError) {
      terminal.error(usageErrorText(error.message));
      return ExitCode.UsageError;
    }
    throw error;
  }
}

async function run(argv: string[], terminal: Terminal, updater: Updater): Promise<number> {
  const command = parseCommand(argv);

  switch (command.kind) {
    case "help":
      terminal.say(HELP_TEXT);
      return ExitCode.Success;
    case "version":
      terminal.say(`image-convert-cli v${currentVersion()}`);
      return ExitCode.Success;
    case "update":
      return runUpdate(command.autoInstall, terminal, updater);
    case "convert": {
      terminal.say(BANNER);
      const settings = await fillIn(command.request, terminal);
      return settings.sourceIsDirectory ? runBatch(settings, terminal) : runConvert(settings, terminal);
    }
  }
}

async function runConvert(settings: ConvertSettings, terminal: Terminal): Promise<ExitCode> {
  const { source, format, destination, compress } = settings;

  terminal.say(settingsText(settings));

  const shouldProceed = settings.unattended || (await terminal.confirm("Proceed with conversion?", true));

  if (!shouldProceed) {
    terminal.say("Conversion cancelled.");
    return ExitCode.Cancelled;
  }

  const result = await convertImage(source, destination, format, compress);

  if (result.success) {
    terminal.say(conversionSuccessText(result));
    return ExitCode.Success;
  }
  terminal.error(conversionFailureText(result));
  return ExitCode.ConversionFailed;
}

async function runBatch(settings: ConvertSettings, terminal: Terminal): Promise<ExitCode> {
  const startTime = Date.now();
  const plan = planConversions(settings);

  if (settings.unattended) {
    for (const conversion of plan.conversions) {
      if (!conversion.skip && fs.existsSync(conversion.output)) {
        conversion.skip = "output-exists";
      }
    }
  }

  const toRun = plan.conversions.filter((conversion) => !conversion.skip);

  if (!settings.unattended) {
    const shouldProceed = await terminal.confirm(`Convert ${plan.conversions.length} files?`, true);
    if (!shouldProceed) {
      terminal.say("Batch conversion cancelled.");
      return ExitCode.Cancelled;
    }
  }

  fs.mkdirSync(plan.outputDirectory, { recursive: true });
  const results: ConversionResult[] = [];
  for (const conversion of toRun) {
    results.push(await convertImage(conversion.source, conversion.output, settings.format, settings.compress));
  }

  const summary: RunSummary = {
    format: settings.format,
    outputDirectory: plan.outputDirectory,
    totalFiles: plan.conversions.length,
    results,
    skipped: plan.conversions.filter((conversion) => conversion.skip),
    totalElapsed: Date.now() - startTime,
  };
  terminal.say(batchResultText(summary));
  return results.some((result) => !result.success) ? ExitCode.ConversionFailed : ExitCode.Success;
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
