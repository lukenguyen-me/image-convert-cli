import * as path from "node:path";
import { spawn } from "node:child_process";
import type { ConvertOptions } from "./types";
import { IPromptService, InteractivePromptService } from "./prompts";
import { convertImage, displayConversionResult, convertBatch, displayBatchResult } from "./converter";
import { getDefaultDestinationPath, isDirectory, getImageFilesFromDirectory } from "./utils/path";
import type { BatchConversionSettings } from "./types";
import packageJson from "../package.json" with { type: "json" };

const NPM_REGISTRY_URL = "https://registry.npmjs.org/image-convert-cli/latest";

export async function executeUpdate(): Promise<void> {
  return new Promise((resolve) => {
    console.log("Updating image-convert-cli...");

    const child = spawn("bun", ["add", "-g", "image-convert-cli"], {
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout?.on("data", (data) => {
      process.stdout.write(data);
    });

    child.stderr?.on("data", (data) => {
      process.stderr.write(data);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("Update completed successfully.");
      } else {
        console.error(`Update failed with exit code: ${code}`);
      }
      resolve();
    });

    child.on("error", (error) => {
      console.error(`Update failed: ${error.message}`);
      resolve();
    });
  });
}

export async function promptForUpdate(
  latestVersion: string,
  promptService?: IPromptService,
): Promise<boolean> {
  const prompts = promptService || new InteractivePromptService();
  return prompts.promptConfirm({
    sourcePath: "",
    targetFormat: "webp",
    destinationPath: "",
    compress: false,
  });
}

export async function handleUpdate(
  fetchVersion?: () => Promise<string>,
  currentVersion?: string,
  autoUpdate?: boolean,
  promptService?: IPromptService,
): Promise<void> {
  const fetcher = fetchVersion || (async () => {
    const response = await fetch(NPM_REGISTRY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch version: ${response.statusText}`);
    }
    const data = await response.json() as { version: string };
    return data.version;
  });

  const version = currentVersion || process.env.npm_package_version || packageJson.version;

  try {
    const latestVersion = await fetcher();

    if (latestVersion === version) {
      console.log(`You are running the latest version: ${version}`);
    } else {
      console.log(`Update available: ${version} -> ${latestVersion}`);

      if (autoUpdate) {
        await executeUpdate();
      } else {
        const shouldUpdate = await promptForUpdate(latestVersion, promptService);
        if (shouldUpdate) {
          await executeUpdate();
        } else {
          console.log("Update cancelled.");
        }
      }
    }
  } catch (error) {
    console.error(`Error checking for updates: ${(error as Error).message}`);
  }
}

export async function runCli(
  options: ConvertOptions,
  promptService?: IPromptService,
): Promise<void> {
  const prompts = promptService || new InteractivePromptService();

  if (options.help) {
    prompts.showHelp();
    return;
  }

  if (options.version) {
    const version = process.env.npm_package_version || packageJson.version;
    console.log(`image-convert-cli v${version}`);
    return;
  }

  if (options.yes && (!options.source || !options.format)) {
    console.error("Error: -y mode requires --source and --format arguments");
    prompts.showHelp();
    return;
  }

  console.log("Image Converter - Convert images to webp, jpeg, or jpg\n");

  const sourcePath = options.source || await prompts.promptSourceFile();

  const targetFormat =
    options.format || (await prompts.promptFormat());

  // Check if source is a directory (batch mode)
  const isBatchMode = isDirectory(sourcePath);

  if (isBatchMode) {
    await runBatchMode(sourcePath, targetFormat, options, prompts);
    return;
  }

  // Single file conversion
  const destinationPath =
    options.destination ||
    (await prompts.promptDestination(
      getDefaultDestinationPath(sourcePath, targetFormat),
    ));

  const compress =
    options.yes !== undefined ? options.yes : await prompts.promptCompress();

  const settings = {
    sourcePath,
    targetFormat,
    destinationPath,
    compress,
  };

  prompts.showSettings(settings);

  const shouldProceed =
    options.yes !== undefined ? options.yes : await prompts.promptConfirm(settings);

  if (!shouldProceed) {
    console.log("Conversion cancelled.");
    return;
  }

  const result = await convertImage(
    sourcePath,
    destinationPath,
    targetFormat,
    compress,
  );

  displayConversionResult(result);

  if (!result.success) {
    process.exit(1);
  }
}

async function runBatchMode(
  sourceDir: string,
  targetFormat: string,
  options: ConvertOptions,
  prompts: IPromptService,
): Promise<void> {
  const yesMode = options.yes === true;

  // Get destination directory - default to same as source
  const destinationDir = options.destination || (yesMode ? sourceDir : await prompts.promptBatchDestination(sourceDir));

  const compress = yesMode ? false : await prompts.promptCompress();

  // Count files to convert
  const files = getImageFilesFromDirectory(sourceDir);

  // In non-yes mode, show batch confirmation
  if (!yesMode) {
    const shouldProceed = await prompts.promptBatchConfirm(files.length);
    if (!shouldProceed) {
      console.log("Batch conversion cancelled.");
      return;
    }
  }

  const batchSettings: BatchConversionSettings = {
    sourceDir,
    targetFormat: targetFormat as any,
    destinationDir,
    compress,
    yesMode,
  };

  const result = await convertBatch(batchSettings);
  displayBatchResult(result);
}
