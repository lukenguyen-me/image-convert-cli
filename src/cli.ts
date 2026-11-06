import * as fs from "node:fs";
import type { ConversionResult, RunSummary } from "./types";
import { PromptCancelled, type Terminal } from "./terminal";
import type { Updater } from "./updater";
import { ExitCode } from "./exit-codes";
import { convertImage } from "./converter";
import {
  type ConversionPlan,
  existingOutputs,
  planConversions,
  runnableConversions,
  skipExistingOutputs,
  skippedConversions,
} from "./plan";
import { HELP_TEXT, UsageError, parseCommand } from "./command";
import { type ConvertSettings, fillIn } from "./settings";
import {
  BANNER,
  batchResultText,
  conversionFailureText,
  conversionSkippedText,
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
      return runConvert(settings, terminal);
    }
  }
}

/** Plan → confirm → convert each → report, for a single-file run and a Batch alike. */
async function runConvert(settings: ConvertSettings, terminal: Terminal): Promise<ExitCode> {
  const startTime = Date.now();
  const plan = planConversions(settings);
  const style = plan.batch ? BATCH : SINGLE_FILE;
  style.intro(settings, terminal);

  // Existing outputs: --overwrite replaces them; otherwise ask once, or skip them in an Unattended Run.
  const existing = existingOutputs(plan);
  if (existing.length > 0 && !settings.overwrite) {
    const choice = settings.unattended
      ? "skip"
      : await terminal.askExistingOutputs(existing.map((conversion) => conversion.output));
    if (choice === "cancel") {
      terminal.say(style.cancelledText);
      return ExitCode.Cancelled;
    }
    if (choice === "skip") {
      skipExistingOutputs(plan);
    }
  }

  const toRun = runnableConversions(plan);

  if (!settings.unattended && toRun.length > 0) {
    if (!(await terminal.confirm(style.confirmQuestion(toRun.length), true))) {
      terminal.say(style.cancelledText);
      return ExitCode.Cancelled;
    }
  }

  style.prepare(plan);
  const results: ConversionResult[] = [];
  for (const conversion of toRun) {
    results.push(await convertImage(conversion, settings));
  }

  const summary: RunSummary = {
    format: settings.format,
    outputDirectory: plan.outputDirectory,
    totalFiles: plan.conversions.length,
    results,
    skipped: skippedConversions(plan),
    totalElapsed: Date.now() - startTime,
  };
  style.report(summary, terminal);
  return results.some((result) => !result.success) ? ExitCode.Failed : ExitCode.Success;
}

/** What differs between a single-file run and a Batch. Each run picks one, once. */
interface RunStyle {
  /** Say what is about to happen, once the plan is made. */
  intro(settings: ConvertSettings, terminal: Terminal): void;
  /** The confirmation asked before `count` Conversions run. */
  confirmQuestion(count: number): string;
  cancelledText: string;
  /** Make sure the outputs have somewhere to go. */
  prepare(plan: ConversionPlan): void;
  report(summary: RunSummary, terminal: Terminal): void;
}

const SINGLE_FILE: RunStyle = {
  intro: (settings, terminal) => terminal.say(settingsText(settings)),
  confirmQuestion: () => "Proceed with conversion?",
  cancelledText: "Conversion cancelled.",
  prepare: () => {},
  report(summary, terminal) {
    for (const result of summary.results) {
      if (result.success) {
        terminal.say(conversionSuccessText(result));
      } else {
        terminal.error(conversionFailureText(result));
      }
    }
    for (const conversion of summary.skipped) {
      terminal.say(conversionSkippedText(conversion, summary.format));
    }
  },
};

const BATCH: RunStyle = {
  intro: () => {},
  confirmQuestion: (count) => `Convert ${count} files?`,
  cancelledText: "Batch conversion cancelled.",
  prepare: (plan) => fs.mkdirSync(plan.outputDirectory, { recursive: true }),
  report: (summary, terminal) => terminal.say(batchResultText(summary)),
};

async function runUpdate(autoInstall: boolean, terminal: Terminal, updater: Updater): Promise<ExitCode> {
  const version = currentVersion();

  let latestVersion: string;
  try {
    latestVersion = await updater.latestVersion();
  } catch (error) {
    terminal.error(`Error checking for updates: ${(error as Error).message}`);
    return ExitCode.Failed;
  }

  if (latestVersion === version) {
    terminal.say(`You are running the latest version: ${version}`);
    return ExitCode.Success;
  }

  terminal.say(`Update available: ${version} -> ${latestVersion}`);

  const shouldUpdate = autoInstall || (await terminal.confirm(updatePromptText(version, latestVersion), true));
  if (!shouldUpdate) {
    terminal.say("Update cancelled.");
    return ExitCode.Cancelled;
  }

  return install(latestVersion, terminal, updater);
}

async function install(version: string, terminal: Terminal, updater: Updater): Promise<ExitCode> {
  terminal.say("Updating image-convert-cli...");
  const outcome = await updater.install(version, (chunk, stream) => terminal.relay(chunk, stream));
  if (outcome.status === "installed") {
    terminal.say("Update completed successfully.");
    return ExitCode.Success;
  }
  if (outcome.status === "exited") {
    terminal.error(`Update failed with exit code: ${outcome.exitCode}`);
  } else {
    terminal.error(`Update failed: ${outcome.message}`);
  }
  return ExitCode.Failed;
}

function currentVersion(): string {
  return process.env.npm_package_version || packageJson.version;
}
