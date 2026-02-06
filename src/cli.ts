import type { ConvertOptions } from "./types";
import { IPromptService, InteractivePromptService } from "./prompts";
import { convertImage, displayConversionResult } from "./converter";
import { getDefaultDestinationPath } from "./utils/path";

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
