import * as fs from "node:fs";
import * as path from "node:path";
import { type FormatSpelling, findInputFormat, isSameFormat } from "./formats";
import type { ConvertSettings } from "./settings";

/** Why a Conversion won't run. */
export type SkipReason = "same-format" | "output-exists";

/** One source file turned into one output file, or skipped with a reason. See GLOSSARY.md. */
export type Conversion = {
  source: string;
  output: string;
  skip?: SkipReason;
};

/** Every Conversion in one run, worked out before any file is written. See GLOSSARY.md. */
export type ConversionPlan = {
  /** Whether the source is a directory. */
  batch: boolean;
  /** Where the outputs go. */
  outputDirectory: string;
  conversions: Conversion[];
};

/** Work out the Conversion Plan for complete settings. Writes nothing. */
export function planConversions(settings: ConvertSettings): ConversionPlan {
  return planBatch(settings);
}

function planBatch(settings: ConvertSettings): ConversionPlan {
  const { format, destination } = settings;
  const sources = listSources(settings.source);
  const conversions = sources.map((source): Conversion =>
    isSameFormat(source, format)
      ? { source, output: outputPath(destination, path.parse(source).name, format), skip: "same-format" }
      : { source, output: outputPath(destination, path.parse(source).name, format) },
  );

  // Sources that would share an output name keep their source extension: photo.png → photo.png.webp.
  const runnable = conversions.filter((conversion) => !conversion.skip);
  const counts = new Map<string, number>();
  for (const { output } of runnable) {
    counts.set(output, (counts.get(output) ?? 0) + 1);
  }
  for (const conversion of runnable) {
    if (counts.get(conversion.output)! > 1) {
      conversion.output = outputPath(destination, path.basename(conversion.source), format);
    }
  }

  return { batch: true, outputDirectory: destination, conversions };
}

function outputPath(directory: string, stem: string, format: FormatSpelling): string {
  return path.join(directory, `${stem}.${format}`);
}

/** The files directly inside `directory` whose Input Format the tool can read. */
function listSources(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directory, entry.name))
    .filter((filePath) => findInputFormat(filePath) !== undefined)
    .sort();
}
