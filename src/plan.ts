import * as fs from "node:fs";
import * as path from "node:path";
import { type FormatSpelling, findInputFormat, isSameFormat } from "./formats";
import type { ConvertSettings } from "./settings";
import { UsageError } from "./command";

/** Why a Conversion won't run. */
export type SkipReason = "same-format" | "output-exists";

/** One source file turned into one output file, or skipped with a reason. See GLOSSARY.md. */
export type Conversion = {
  source: string;
  output: string;
  skip?: SkipReason;
  /** Whether a file is already at `output`. The run decides whether to replace it or skip. */
  outputExists?: boolean;
};

/** A Conversion that won't run, and why. */
export type SkippedConversion = Conversion & { skip: SkipReason };

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
  const plan = settings.sourceIsDirectory ? planBatch(settings) : planSingle(settings);
  for (const conversion of plan.conversions) {
    if (!conversion.skip && fs.existsSync(conversion.output)) {
      conversion.outputExists = true;
    }
  }
  return plan;
}

/** The Conversions that will run. */
export function runnableConversions(plan: ConversionPlan): Conversion[] {
  return plan.conversions.filter((conversion) => !conversion.skip);
}

/** The Conversions that won't run, each with its reason. */
export function skippedConversions(plan: ConversionPlan): SkippedConversion[] {
  return plan.conversions.filter((conversion): conversion is SkippedConversion => conversion.skip !== undefined);
}

/** The Conversions that will run but would replace an existing file. */
export function existingOutputs(plan: ConversionPlan): Conversion[] {
  return runnableConversions(plan).filter((conversion) => conversion.outputExists);
}

/** Skip every Conversion that would replace an existing file. */
export function skipExistingOutputs(plan: ConversionPlan): void {
  for (const conversion of existingOutputs(plan)) {
    conversion.skip = "output-exists";
  }
}

/**
 * The output path a single source gets unless the user names one: the source name with
 * the Output Format's extension, next to the source. It is never the source itself:
 * a same-format source gets `<name>.converted.<ext>`.
 */
export function defaultOutputPath(source: string, format: FormatSpelling): string {
  const { dir, name } = path.parse(source);
  const output = outputPath(dir, name, format);
  return isSamePath(output, source) ? outputPath(dir, `${name}.converted`, format) : output;
}

/** A single-file run: one Conversion, re-encoded even when already in the Output Format. */
function planSingle(settings: ConvertSettings): ConversionPlan {
  const { source, destination } = settings;
  if (isSamePath(destination, source)) {
    throw new UsageError(`the destination is the source file ${source}; choose another output path`);
  }
  if (isDirectory(destination)) {
    throw new UsageError(`the destination ${destination} is a directory; give an output file path`);
  }
  return { batch: false, outputDirectory: path.dirname(destination), conversions: [{ source, output: destination }] };
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
  // So does a source whose output would land on another source, such as a skipped photo.webp.
  const runnable = conversions.filter((conversion) => !conversion.skip);
  const counts = new Map<string, number>(sources.map((source) => [pathKey(source), 1]));
  for (const { output } of runnable) {
    counts.set(pathKey(output), (counts.get(pathKey(output)) ?? 0) + 1);
  }
  for (const conversion of runnable) {
    if (counts.get(pathKey(conversion.output))! > 1) {
      conversion.output = outputPath(destination, path.basename(conversion.source), format);
    }
  }

  return { batch: true, outputDirectory: destination, conversions };
}

function isDirectory(filePath: string): boolean {
  return fs.statSync(filePath, { throwIfNoEntry: false })?.isDirectory() ?? false;
}

function isSamePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b);
}

/**
 * What identifies a file for the source guard and collision checks. Case is ignored,
 * because the default macOS and Windows filesystems treat `Photo.png` and `photo.png`
 * as one file. On a case-sensitive filesystem this only errs on the safe side.
 */
function pathKey(filePath: string): string {
  return path.resolve(filePath).toLowerCase();
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
