import { expect, describe, it, beforeAll, afterAll } from "bun:test";
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
  formatPromptChoices,
  INPUT_FORMATS,
  isSameFormat,
  OUTPUT_FORMATS,
} from "../src/formats";

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgc-formats-"));
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Write a solid-colour raster image of the given size and sharp output format; returns its path. */
async function makeImage(name: string, width = 40, height = 20): Promise<string> {
  const file = path.join(dir, name);
  const format = path.extname(name).slice(1) as keyof sharp.FormatEnum;
  await sharp({ create: { width, height, channels: 3, background: "#c33" } }).toFormat(format).toFile(file);
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
const OUTPUT_FORMAT_TABLE = [
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

      it("is found by each alias, in any case", () => {
        for (const spelling of [...row.aliases, row.name.toUpperCase()]) {
          expect(findOutputFormat(spelling)?.name).toBe(row.name);
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

          await encode(source, destination, row.name, { compress });

          expect(await decodedFormat(destination)).toBe(row.name);
        });
      }

      for (const alias of row.aliases) {
        it(`encodes identically when chosen as "${alias}"`, async () => {
          const source = await makeImage(`source-${row.name}-alias.png`);
          const byName = path.join(dir, `by-name.${row.name}`);
          const byAlias = path.join(dir, `by-alias.${alias}`);

          await encode(source, byName, row.name, { compress: false });
          await encode(source, byAlias, alias, { compress: false });

          expect(fs.readFileSync(byAlias).equals(fs.readFileSync(byName))).toBe(true);
        });
      }
    });
  }

  it("does not find an unknown spelling", () => {
    expect(findOutputFormat("bmp")).toBeUndefined();
    expect(findOutputFormat("svg")).toBeUndefined();
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
  const SVG_SIZES: Record<string, number[][]> = {
    webp: [[512, 256]],
    jpeg: [[512, 256]],
    png: [[512, 256]],
    ico: [[32, 32], [16, 16]],
  };

  it("has an expected SVG size for every Output Format", () => {
    expect(Object.keys(SVG_SIZES)).toEqual(OUTPUT_FORMATS.map((format) => format.name));
  });

  for (const [name, sizes] of Object.entries(SVG_SIZES)) {
    it(`rasterises SVG input to fit 512x512 when writing ${name}`, async () => {
      const source = writeSvg(`wide-${name}.svg`, 1000, 500);
      const destination = path.join(dir, `from-svg.${name}`);

      await encode(source, destination, name, { compress: false });

      expect(await decodedSizes(destination)).toEqual(sizes);
    });
  }

  it("keeps a raster source's own size", async () => {
    const source = await makeImage("raster-size.png", 1000, 500);
    const destination = path.join(dir, "raster-size.webp");

    await encode(source, destination, "webp", { compress: false });

    expect(await decodedSizes(destination)).toEqual([[1000, 500]]);
  });

  it("embeds 32 and 16 px images in an ICO", async () => {
    const source = await makeImage("square.png", 100, 100);
    const destination = path.join(dir, "square.ico");

    await encode(source, destination, "ico", { compress: false });

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
];

describe("Input Formats", () => {
  it("are exactly the formats in the table, in order", () => {
    expect(INPUT_FORMATS.map((format) => format.name)).toEqual(INPUT_FORMAT_TABLE.map((row) => row.name));
  });

  for (const row of INPUT_FORMAT_TABLE) {
    for (const extension of row.extensions) {
      it(`recognises a .${extension} source as ${row.label} and sharp can read it`, async () => {
        const source =
          row.name === "svg" ? writeSvg(`input.${extension}`, 30, 30) : await makeImage(`input-${row.name}.${extension}`);
        const destination = path.join(dir, `from-${extension}.png`);

        expect(findInputFormat(source)?.label).toBe(row.label);
        expect(findInputFormat(source.toUpperCase())?.label).toBe(row.label);

        await encode(source, destination, "png", { compress: false });
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

    await expect(encode(source, path.join(dir, "photo.webp"), "webp", { compress: false })).rejects.toThrow(
      "Unsupported input format",
    );
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
