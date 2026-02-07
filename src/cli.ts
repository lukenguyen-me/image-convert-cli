import type { ConvertOptions } from "./types";
import { IPromptService, InteractivePromptService } from "./prompts";
import { convertImage, displayConversionResult } from "./converter";
import { getDefaultDestinationPath } from "./utils/path";

const NPM_REGISTRY_URL = "https://registry.npmjs.org/image-convert-cli/latest";

export async function handleUpdate(
  fetchVersion?: () => Promise<string>,
  currentVersion?: string,
): Promise<void> {
  const fetcher = fetchVersion || (async () => {
    const response = await fetch(NPM_REGISTRY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch version: ${response.statusText}`);
    }
    const data = await response.json() as { version: string };
    return data.version;
  });

  const version = currentVersion || process.env.npm_package_version || "1.1.0";

  try {
    const latestVersion = await fetcher();

    if (latestVersion === version) {
      console.log(`You are running the latest version: ${version}`);
    } else {
      console.log(`Update available: ${version} -> ${latestVersion}`);
      console.log("Run: bun update to upgrade");
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

  if (options.yes && (!options.source || !options.format)) {
    console.error("Error: -y mode requires --source and --format arguments");
    prompts.showHelp();
    return;
  }

  console.log("Image Converter - Convert images to webp, jpeg, or jpg\n");

  const sourcePath = options.source || await prompts.promptSourceFile();

  const targetFormat =
    options.format || (await prompts.promptFormat());

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
