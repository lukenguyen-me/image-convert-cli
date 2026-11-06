import * as path from "node:path";
import sharp, { type Sharp } from "sharp";
import ico from "sharp-ico";
import { openHeic } from "./heic";

/** An image format the tool can write. See GLOSSARY.md. */
export interface OutputFormat {
  /** Canonical name, also the extension it writes when chosen by name. */
  readonly name: string;
  /** Display name, such as "JPEG". */
  readonly label: string;
  /** Format Aliases: other spellings that pick the extension but never change the encoding. */
  readonly aliases: readonly string[];
  /** The spelling the interactive prompt picks for this format, which sets the extension it writes. */
  readonly promptSpelling: string;
  /** One line shown beside the format in the interactive prompt. */
  readonly description: string;
}

/** An Output Format plus its encode recipe, which stays inside this module. */
interface OutputFormatDefinition extends OutputFormat {
  /** Write `image` to `destinationPath`. What Compress means is up to each format. */
  write(image: Sharp, destinationPath: string, compress: boolean): Promise<unknown>;
}

const OUTPUT_FORMAT_TABLE = [
  {
    name: "webp",
    label: "WebP",
    aliases: [],
    promptSpelling: "webp",
    description: "WebP format (recommended for web)",
    write: (image, destinationPath, compress) =>
      image.webp(compress ? { quality: 100, lossless: true } : { quality: 100 }).toFile(destinationPath),
  },
  {
    name: "jpeg",
    label: "JPEG",
    aliases: ["jpg"],
    promptSpelling: "jpg",
    description: "JPEG format, written as .jpg",
    write: (image, destinationPath, compress) =>
      image.jpeg(compress ? { quality: 100, mozjpeg: true } : { quality: 100 }).toFile(destinationPath),
  },
  {
    name: "png",
    label: "PNG",
    aliases: [],
    promptSpelling: "png",
    description: "PNG format (lossless)",
    write: (image, destinationPath, compress) =>
      image.png({ compressionLevel: compress ? 9 : 6 }).toFile(destinationPath),
  },
  {
    name: "ico",
    label: "ICO",
    aliases: [],
    promptSpelling: "ico",
    description: "ICO format (favicon, embeds 32x32 and 16x16)",
    // Compress is ignored: an ICO always embeds 32 and 16 px images.
    write: (image, destinationPath) => ico.sharpsToIco([image], destinationPath, { sizes: [32, 16] }),
  },
] as const satisfies readonly OutputFormatDefinition[];

type OutputFormatRow = (typeof OUTPUT_FORMAT_TABLE)[number];

/** A spelling of an Output Format: its canonical name or one of its Format Aliases. */
export type FormatSpelling = OutputFormatRow["name"] | OutputFormatRow["aliases"][number];

/** Every Output Format, in the order the tool offers them. */
export const OUTPUT_FORMATS: readonly OutputFormat[] = OUTPUT_FORMAT_TABLE;

/** Every spelling a user may type for an Output Format: each name followed by its Format Aliases. */
export const FORMAT_SPELLINGS: readonly FormatSpelling[] = OUTPUT_FORMAT_TABLE.flatMap(
  (format): FormatSpelling[] => [format.name, ...format.aliases],
);

/** Whether `spelling` is exactly one of the FORMAT_SPELLINGS. */
export function isFormatSpelling(spelling: string): spelling is FormatSpelling {
  return (FORMAT_SPELLINGS as readonly string[]).includes(spelling);
}

/** A choice in the interactive format prompt. */
export interface FormatPromptChoice {
  readonly spelling: FormatSpelling;
  readonly label: string;
  readonly description: string;
}

/** The interactive prompt's choices: one per Output Format, in order. */
export function formatPromptChoices(): FormatPromptChoice[] {
  return OUTPUT_FORMAT_TABLE.map((format) => ({
    spelling: format.promptSpelling,
    label: format.label,
    description: format.description,
  }));
}

/** The Output Format a spelling (its name or a Format Alias) refers to. */
export function findOutputFormat(spelling: FormatSpelling): OutputFormat {
  return definitionOf(spelling);
}

/** How to encode: the Output Format (by the spelling the user chose) and whether to Compress. */
export interface EncodeOptions {
  readonly format: FormatSpelling;
  readonly compress: boolean;
}

/**
 * Encode the image at `source` into `options.format`, writing `output`.
 * A Format Alias encodes exactly as the canonical name does.
 */
export async function encode(source: string, output: string, options: EncodeOptions): Promise<void> {
  const format = definitionOf(options.format);
  const inputFormat = inputDefinitionOf(source);
  if (!inputFormat) {
    throw new Error(`Unsupported input format: ${path.basename(source)}`);
  }
  await format.write(await inputFormat.open(source), output, options.compress);
}

/** The Output Format with its encode recipe. Every FormatSpelling names exactly one. */
function definitionOf(spelling: FormatSpelling): OutputFormatDefinition {
  return OUTPUT_FORMAT_TABLE.find(
    (format: OutputFormatDefinition) => format.name === spelling || format.aliases.includes(spelling),
  )!;
}

/** An image format the tool can read. See GLOSSARY.md. */
export interface InputFormat {
  readonly name: string;
  readonly label: string;
  /** File extensions (lower case, no dot) that mark a source as this format. */
  readonly extensions: readonly string[];
}

/** An Input Format plus its decode recipe, which stays inside this module. */
interface InputFormatDefinition extends InputFormat {
  /** Open `source` for encoding, as a sharp image. */
  open(source: string): Sharp | Promise<Sharp>;
}

const openWithSharp = (source: string) => sharp(source);

const INPUT_FORMAT_TABLE: readonly InputFormatDefinition[] = [
  { name: "jpeg", label: "JPEG", extensions: ["jpeg", "jpg"], open: openWithSharp },
  { name: "png", label: "PNG", extensions: ["png"], open: openWithSharp },
  { name: "webp", label: "WebP", extensions: ["webp"], open: openWithSharp },
  { name: "gif", label: "GIF", extensions: ["gif"], open: openWithSharp },
  { name: "tiff", label: "TIFF", extensions: ["tiff", "tif"], open: openWithSharp },
  { name: "avif", label: "AVIF", extensions: ["avif"], open: openWithSharp },
  {
    name: "svg",
    label: "SVG",
    extensions: ["svg"],
    // SVG has no pixel size of its own worth keeping: rasterise it to fit 512x512.
    open: (source) => sharp(source).resize(512, 512, { fit: "inside" }),
  },
  { name: "heic", label: "HEIC", extensions: ["heic", "heif"], open: openHeic },
];

/** Every Input Format. Single-file runs and Batches both read exactly these. */
export const INPUT_FORMATS: readonly InputFormat[] = INPUT_FORMAT_TABLE;

/** The Input Format of a source file, judged by its extension, or undefined if the tool can't read it. */
export function findInputFormat(sourcePath: string): InputFormat | undefined {
  return inputDefinitionOf(sourcePath);
}

/** The Input Format of a source file with its decode recipe, judged by its extension. */
function inputDefinitionOf(sourcePath: string): InputFormatDefinition | undefined {
  const extension = extensionOf(sourcePath);
  return INPUT_FORMAT_TABLE.find((format) => format.extensions.includes(extension));
}

/** Whether the source file is already in the Output Format that `spelling` refers to. */
export function isSameFormat(sourcePath: string, spelling: FormatSpelling): boolean {
  const extension = extensionOf(sourcePath);
  return isFormatSpelling(extension) && definitionOf(extension) === definitionOf(spelling);
}

function extensionOf(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}
