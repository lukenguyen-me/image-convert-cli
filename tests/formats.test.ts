import { expect, describe, it, beforeEach, afterEach, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import sharp from "sharp";
import ico from "sharp-ico";
import {
  encode,
  findInputFormat,
  findOutputFormat,
  FORMAT_SPELLINGS,
  type FormatSpelling,
  formatPromptChoices,
  INPUT_FORMATS,
  isFormatSpelling,
  isSameFormat,
  OUTPUT_FORMATS,
} from "../src/formats";

// A fresh temp directory per test, removed even when an assertion fails.
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgc-formats-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Write a solid-colour raster image of the given size and sharp output format; returns its path. */
async function makeImage(name: string, width = 40, height = 20): Promise<string> {
  const file = path.join(dir, name);
  const format = path.extname(name).slice(1) as keyof sharp.FormatEnum;
  await sharp({ create: { width, height, channels: 3, background: "#c33" } }).toFormat(format).toFile(file);
  return file;
}

/** A 40x20 solid #c33 HEIC (HEVC-coded, as an iPhone writes): sharp cannot make one, so it is a fixture. */
const HEIC_FIXTURE = path.join(import.meta.dir, "fixtures", "test.heic");

/** An 8x8 HEIC of sRGB pure red (255, 0, 0), converted by macOS to Display P3 as iPhones write it. */
const DISPLAY_P3_HEIC_FIXTURE = path.join(import.meta.dir, "fixtures", "display-p3.heic");

/** Copy a fixture into the test's directory as `name`; returns its path. */
function copyFixture(fixture: string, name: string): string {
  const file = path.join(dir, name);
  fs.copyFileSync(fixture, file);
  return file;
}

function writeSvg(name: string, width: number, height: number): string {
  const file = path.join(dir, name);
  fs.writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="blue"/></svg>`,
  );
  return file;
}

/** The format a written file actually decodes as. ICO is read with sharp-ico; the rest with sharp. */
async function decodedFormat(file: string): Promise<string | undefined> {
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) {
    return ico.decode(bytes).length > 0 ? "ico" : undefined;
  }
  return (await sharp(bytes).metadata()).format;
}

/** One row per Output Format. Adding an Output Format means adding a row here. */
const OUTPUT_FORMAT_TABLE: {
  name: FormatSpelling;
  label: string;
  aliases: FormatSpelling[];
  sameAs: string[];
  differentFrom: string[];
}[] = [
  { name: "webp", label: "WebP", aliases: [], sameAs: ["a.webp", "A.WEBP"], differentFrom: ["a.png", "a.jpg"] },
  { name: "jpeg", label: "JPEG", aliases: ["jpg"], sameAs: ["a.jpeg", "a.jpg", "a.JPG"], differentFrom: ["a.png", "a.webp"] },
  { name: "png", label: "PNG", aliases: [], sameAs: ["a.png"], differentFrom: ["a.jpg", "a.ico"] },
  { name: "ico", label: "ICO", aliases: [], sameAs: ["a.ico"], differentFrom: ["a.png", "a.webp"] },
];

describe("Output Formats", () => {
  it("are exactly the formats in the table, in order", () => {
    expect(OUTPUT_FORMATS.map((format) => format.name)).toEqual(OUTPUT_FORMAT_TABLE.map((row) => row.name));
  });

  for (const row of OUTPUT_FORMAT_TABLE) {
    describe(row.label, () => {
      it(`has canonical name "${row.name}" and aliases [${row.aliases.join(", ")}]`, () => {
        const format = findOutputFormat(row.name);
        expect(format?.name).toBe(row.name);
        expect(format?.label).toBe(row.label);
        expect(format?.aliases).toEqual(row.aliases);
      });

      it("is found by each alias", () => {
        for (const spelling of row.aliases) {
          expect(findOutputFormat(spelling).name).toBe(row.name);
        }
      });

      it("treats sources with its name or an alias as the same format", () => {
        for (const spelling of [row.name, ...row.aliases]) {
          for (const source of row.sameAs) expect(isSameFormat(source, spelling)).toBe(true);
          for (const source of row.differentFrom) expect(isSameFormat(source, spelling)).toBe(false);
        }
      });

      for (const compress of [false, true]) {
        it(`encodes a decodable ${row.label} file (compress: ${compress})`, async () => {
          const source = await makeImage(`source-${row.name}-${compress}.png`);
          const destination = path.join(dir, `out-${row.name}-${compress}.${row.name}`);

          await encode(source, destination, { format: row.name, compress });

          expect(await decodedFormat(destination)).toBe(row.name);
        });
      }

      for (const alias of row.aliases) {
        it(`encodes identically when chosen as "${alias}"`, async () => {
          const source = await makeImage(`source-${row.name}-alias.png`);
          const byName = path.join(dir, `by-name.${row.name}`);
          const byAlias = path.join(dir, `by-alias.${alias}`);

          await encode(source, byName, { format: row.name, compress: false });
          await encode(source, byAlias, { format: alias, compress: false });

          expect(fs.readFileSync(byAlias).equals(fs.readFileSync(byName))).toBe(true);
        });
      }
    });
  }

  it("does not accept an unknown spelling", () => {
    expect(isFormatSpelling("bmp")).toBe(false);
    expect(isFormatSpelling("svg")).toBe(false);
  });
});

/** Width and height of every image in a written file: one for most formats, one per embedded size for ICO. */
async function decodedSizes(file: string): Promise<number[][]> {
  const bytes = fs.readFileSync(file);
  if ((await decodedFormat(file)) === "ico") {
    return ico.decode(bytes).map((image) => [image.width, image.height]);
  }
  const { width, height } = await sharp(bytes).metadata();
  return [[width, height]];
}

describe("sizes", () => {
  /** What a 1000x500 SVG becomes in each Output Format: rasterised to fit 512x512 (ICO then embeds its own sizes). */
  const SVG_SIZES: Partial<Record<FormatSpelling, number[][]>> = {
    webp: [[512, 256]],
    jpeg: [[512, 256]],
    png: [[512, 256]],
    ico: [[32, 32], [16, 16]],
  };

  it("has an expected SVG size for every Output Format", () => {
    expect(Object.keys(SVG_SIZES)).toEqual(OUTPUT_FORMATS.map((format) => format.name));
  });

  for (const [name, sizes] of Object.entries(SVG_SIZES) as [FormatSpelling, number[][]][]) {
    it(`rasterises SVG input to fit 512x512 when writing ${name}`, async () => {
      const source = writeSvg(`wide-${name}.svg`, 1000, 500);
      const destination = path.join(dir, `from-svg.${name}`);

      await encode(source, destination, { format: name, compress: false });

      expect(await decodedSizes(destination)).toEqual(sizes);
    });
  }

  it("keeps a raster source's own size", async () => {
    const source = await makeImage("raster-size.png", 1000, 500);
    const destination = path.join(dir, "raster-size.webp");

    await encode(source, destination, { format: "webp", compress: false });

    expect(await decodedSizes(destination)).toEqual([[1000, 500]]);
  });

  it("keeps a HEIC source's own size and colour", async () => {
    const source = copyFixture(HEIC_FIXTURE, "photo.heic");
    const destination = path.join(dir, "photo.png");

    await encode(source, destination, { format: "png", compress: false });

    expect(await decodedSizes(destination)).toEqual([[40, 20]]);
    const [red, green, blue] = (await sharp(destination).stats()).channels.map((channel) => channel.mean);
    // #c33 is (204, 51, 51); HEVC is lossy, so allow a little drift.
    for (const [actual, expected] of [[red, 204], [green, 51], [blue, 51]] as const) {
      expect(Math.abs(actual! - expected)).toBeLessThan(8);
    }
  });

  it("embeds 32 and 16 px images in an ICO", async () => {
    const source = await makeImage("square.png", 100, 100);
    const destination = path.join(dir, "square.ico");

    await encode(source, destination, { format: "ico", compress: false });

    expect(await decodedSizes(destination)).toEqual([[32, 32], [16, 16]]);
  });
});

/** One row per Input Format, with every extension it is recognised by. */
const INPUT_FORMAT_TABLE = [
  { name: "jpeg", label: "JPEG", extensions: ["jpeg", "jpg"] },
  { name: "png", label: "PNG", extensions: ["png"] },
  { name: "webp", label: "WebP", extensions: ["webp"] },
  { name: "gif", label: "GIF", extensions: ["gif"] },
  { name: "tiff", label: "TIFF", extensions: ["tiff", "tif"] },
  { name: "avif", label: "AVIF", extensions: ["avif"] },
  { name: "svg", label: "SVG", extensions: ["svg"] },
  { name: "heic", label: "HEIC", extensions: ["heic", "heif"] },
];

/** Write a source of the given Input Format, named `input-<name>.<extension>`; returns its path. */
async function makeSource(name: string, extension: string): Promise<string> {
  if (name === "svg") return writeSvg(`input-svg.${extension}`, 30, 30);
  if (name === "heic") return copyFixture(HEIC_FIXTURE, `input-heic.${extension}`);
  return makeImage(`input-${name}.${extension}`);
}

describe("Input Formats", () => {
  it("are exactly the formats in the table, in order", () => {
    expect(INPUT_FORMATS.map((format) => format.name)).toEqual(INPUT_FORMAT_TABLE.map((row) => row.name));
  });

  for (const row of INPUT_FORMAT_TABLE) {
    for (const extension of row.extensions) {
      it(`recognises a .${extension} source as ${row.label} and can read it`, async () => {
        const source = await makeSource(row.name, extension);
        const destination = path.join(dir, `from-${extension}.png`);

        expect(findInputFormat(source)?.label).toBe(row.label);
        expect(findInputFormat(source.toUpperCase())?.label).toBe(row.label);

        await encode(source, destination, { format: "png", compress: false });
        expect(await decodedFormat(destination)).toBe("png");
      });
    }
  }

  it("does not recognise an unknown source", () => {
    expect(findInputFormat("photo.bmp")).toBeUndefined();
    expect(findInputFormat("photo")).toBeUndefined();
    expect(findInputFormat("icon.ico")).toBeUndefined();
  });

  it("refuses to encode a source that is not a known Input Format", async () => {
    const source = path.join(dir, "photo.bmp");
    fs.copyFileSync(await makeImage("real.png"), source);

    await expect(encode(source, path.join(dir, "photo.webp"), { format: "webp", compress: false })).rejects.toThrow(
      "Unsupported input format",
    );
  });
});

describe("HEIC sources", () => {
  it("keep their colour when tagged Display P3, as iPhone photos are", async () => {
    const source = copyFixture(DISPLAY_P3_HEIC_FIXTURE, "iphone.heic");
    const destination = path.join(dir, "iphone.png");

    await encode(source, destination, { format: "png", compress: false });

    // Read as plain sRGB, the P3 pixels would come out near (234, 50, 35).
    const [red, green, blue] = (await sharp(destination).stats()).channels.map((channel) => channel.mean);
    expect(red).toBeGreaterThan(245);
    expect(green).toBeLessThan(15);
    expect(blue).toBeLessThan(15);
  });

  it("gain no alpha channel when opaque", async () => {
    const source = copyFixture(HEIC_FIXTURE, "opaque.heic");
    const destination = path.join(dir, "opaque.png");

    await encode(source, destination, { format: "png", compress: false });

    expect((await sharp(destination).metadata()).channels).toBe(3);
  });

  it("can be AV1-coded .heif files", async () => {
    const source = path.join(dir, "camera.heif");
    await sharp({ create: { width: 40, height: 20, channels: 3, background: "#c33" } })
      .heif({ compression: "av1" })
      .toFile(source);
    const destination = path.join(dir, "camera.png");

    await encode(source, destination, { format: "png", compress: false });

    expect(await decodedSizes(destination)).toEqual([[40, 20]]);
  });

  it("that are corrupt fail with a one-line message naming the file, and print nothing", async () => {
    const source = path.join(dir, "broken.heic");
    fs.writeFileSync(source, fs.readFileSync(HEIC_FIXTURE).subarray(0, 400));
    const printed = [spyOn(console, "log"), spyOn(console, "warn"), spyOn(console, "error")];

    try {
      const error = await encode(source, path.join(dir, "broken.png"), { format: "png", compress: false }).catch(
        (thrown: Error) => thrown,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toStartWith("Can't read broken.heic: ");
      expect((error as Error).message).not.toContain("\n");
      for (const spy of printed) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of printed) spy.mockRestore();
    }
  });
});

describe("format choices", () => {
  it("the prompt offers WebP, JPEG, PNG and ICO, and JPEG writes .jpg", () => {
    const choices = formatPromptChoices();

    expect(choices.map((choice) => choice.label)).toEqual(["WebP", "JPEG", "PNG", "ICO"]);
    expect(choices.map((choice) => choice.spelling)).toEqual(["webp", "jpg", "png", "ico"]);
    for (const choice of choices) {
      expect(findOutputFormat(choice.spelling)?.label).toBe(choice.label);
      expect(choice.description.length).toBeGreaterThan(0);
    }
  });

  it("every name and Format Alias can be typed", () => {
    expect(FORMAT_SPELLINGS).toEqual(["webp", "jpeg", "jpg", "png", "ico"]);
  });
});
