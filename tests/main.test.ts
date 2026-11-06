import { expect, describe, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { main } from "../src/cli";
import { CTRL_C, ScriptedTerminal } from "../src/scripted-terminal";
import { InMemoryUpdater } from "../src/updater";
import { encode } from "../src/formats";
import sharp from "sharp";
import packageJson from "../package.json" with { type: "json" };

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

/** A 16×16 colour gradient: detailed enough that compressed and plain WebP differ. */
async function writeGradientPng(filePath: string): Promise<void> {
  const size = 16;
  const pixels = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    pixels.set([(i * 7) % 256, (i * 13) % 256, (i * 29) % 256], i * 3);
  }
  await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toFile(filePath);
}

describe("main", () => {
  describe("--help", () => {
    it("prints the help text and exits 0", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["--help"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.stdout).toContain("Image Converter CLI");
      expect(terminal.stdout).toContain("imgc -y --source <path> --format <format>");
      expect(terminal.stdout).toMatch(/--format, -f <format> +Output Format: webp, jpeg, jpg, png, ico \(required with -y\)\n/);
      expect(terminal.stdout).toContain("Input Formats: jpeg, jpg, png, webp, gif, tiff, tif, avif, svg\n");
      expect(terminal.stdout).toMatch(/--compress, -c +Compress the output \(default: off\)\n/);
      expect(terminal.stderr).toBe("");
      expect(terminal.asked).toEqual([]);
    });

    it("lists only flags the parser accepts, in both long and short form", async () => {
      const help = new ScriptedTerminal();
      await main(["--help"], help, new InMemoryUpdater());
      const listed = [...help.stdout.matchAll(/^ {2}(--[a-z]+)(?:, (-[a-z]))?(?: <[a-z]+>)?/gm)];

      expect(listed.map(([, long]) => long)).toEqual([
        "--help", "--version", "--source", "--format", "--dest", "--compress", "--yes", "--overwrite",
      ]);
      for (const [usage, long, short] of listed) {
        for (const flag of short ? [long!, short] : [long!]) {
          // --help comes first so each flag is only parsed, never acted on.
          const argv = usage.includes("<") ? ["--help", flag, "webp"] : ["--help", flag];
          const terminal = new ScriptedTerminal();

          const code = await main(argv, terminal, new InMemoryUpdater());

          expect({ flag, code, stderr: terminal.stderr }).toEqual({ flag, code: 0, stderr: "" });
        }
      }
    });
  });

  describe("version", () => {
    for (const argv of [["version"], ["--version"], ["-v"]]) {
      it(`\`imgc ${argv.join(" ")}\` prints the version and exits 0`, async () => {
        const terminal = new ScriptedTerminal();

        const code = await main(argv, terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(terminal.stdout).toBe(`image-convert-cli v${packageJson.version}\n`);
        expect(terminal.asked).toEqual([]);
      });
    }
  });

  describe("usage errors", () => {
    // argv → a fragment the error must contain, naming the problem.
    const cases: [argv: string[], names: string][] = [
      [["-s", "photo.png", "--format", "gif"], "--format 'gif'"],
      [["-s", "photo.png", "-f", "WEBP"], "--format 'WEBP'"],
      [["--fromat", "webp"], "'--fromat'"],
      [["-x"], "'-x'"],
      [["--source"], "--source needs a value"],
      [["-s"], "--source needs a value"],
      [["--source", "-f", "webp"], "--source needs a value"],
      [["-s", "", "-f", "webp"], "--source needs a value"],
      [["-s", "photo.png", "--format"], "--format needs a value"],
      [["-s", "photo.png", "-f", "webp", "--dest"], "--dest needs a value"],
      [["-y", "-s", "photo.png"], "--format is required with -y"],
      [["-y", "-f", "webp"], "--source is required with -y"],
      [["-y"], "--source is required with -y"],
      [["convert", "-s", "photo.png"], "'convert'"],
      [["update", "--fromat"], "'--fromat'"],
    ];

    for (const [argv, names] of cases) {
      it(`\`imgc ${argv.join(" ")}\` exits 2 naming ${names} and pointing to --help`, async () => {
        const terminal = new ScriptedTerminal();
        const updater = new InMemoryUpdater({ latest: "999.0.0" });

        const code = await main(argv, terminal, updater);

        expect(code).toBe(2);
        expect(terminal.stderr).toContain(names);
        expect(terminal.stderr).toEndWith("Run 'imgc --help' for usage.\n");
        expect(terminal.asked).toEqual([]);
        expect(updater.installed).toEqual([]);
      });
    }
  });

  describe("update", () => {
    const current = packageJson.version;

    it("says so when already on the latest version, installs nothing and exits 0", async () => {
      const terminal = new ScriptedTerminal();
      const updater = new InMemoryUpdater({ latest: current });

      const code = await main(["update"], terminal, updater);

      expect(code).toBe(0);
      expect(terminal.stdout).toBe(`You are running the latest version: ${current}\n`);
      expect(terminal.asked).toEqual([]);
      expect(updater.installed).toEqual([]);
    });

    it("asks before installing a newer version, then installs it", async () => {
      const terminal = new ScriptedTerminal([true]);
      const updater = new InMemoryUpdater({ latest: "999.0.0" });

      const code = await main(["update"], terminal, updater);

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([`Update image-convert-cli ${current} → 999.0.0?`]);
      expect(updater.installed).toEqual(["999.0.0"]);
      expect(terminal.stdout).toBe(
        `Update available: ${current} -> 999.0.0\n` +
          "Updating image-convert-cli...\n" +
          "Update completed successfully.\n",
      );
    });

    it("installs nothing and exits 130 when the user declines", async () => {
      const terminal = new ScriptedTerminal([false]);
      const updater = new InMemoryUpdater({ latest: "999.0.0" });

      const code = await main(["update"], terminal, updater);

      expect(code).toBe(130);
      expect(updater.installed).toEqual([]);
      expect(terminal.stdout).toBe(`Update available: ${current} -> 999.0.0\nUpdate cancelled.\n`);
    });

    it("installs nothing and exits 130 when the user presses Ctrl-C at the prompt", async () => {
      const terminal = new ScriptedTerminal([CTRL_C]);
      const updater = new InMemoryUpdater({ latest: "999.0.0" });

      const code = await main(["update"], terminal, updater);

      expect(code).toBe(130);
      expect(updater.installed).toEqual([]);
    });

    for (const flag of ["-y", "--yes"]) {
      it(`\`imgc update ${flag}\` installs without asking`, async () => {
        const terminal = new ScriptedTerminal();
        const updater = new InMemoryUpdater({ latest: "999.0.0" });

        const code = await main(["update", flag], terminal, updater);

        expect(code).toBe(0);
        expect(terminal.asked).toEqual([]);
        expect(updater.installed).toEqual(["999.0.0"]);
      });
    }

    it("reports a failed version lookup and still exits 0", async () => {
      const terminal = new ScriptedTerminal();
      const updater = new InMemoryUpdater({ latest: new Error("Network error") });

      const code = await main(["update"], terminal, updater);

      expect(code).toBe(0);
      expect(terminal.stderr).toBe("Error checking for updates: Network error\n");
      expect(updater.installed).toEqual([]);
    });

    it("reports an installer that exits non-zero and still exits 0", async () => {
      const terminal = new ScriptedTerminal();
      const updater = new InMemoryUpdater({
        latest: "999.0.0",
        installOutcome: { status: "exited", exitCode: 1 },
      });

      const code = await main(["update", "-y"], terminal, updater);

      expect(code).toBe(0);
      expect(terminal.stderr).toBe("Update failed with exit code: 1\n");
      expect(terminal.stdout).not.toContain("Update completed successfully.");
    });

    it("reports an installer that could not start and still exits 0", async () => {
      const terminal = new ScriptedTerminal();
      const updater = new InMemoryUpdater({
        latest: "999.0.0",
        installOutcome: { status: "error", message: "spawn bun ENOENT" },
      });

      const code = await main(["update", "-y"], terminal, updater);

      expect(code).toBe(0);
      expect(terminal.stderr).toBe("Update failed: spawn bun ENOENT\n");
    });
  });

  describe("single-file conversion", () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgc-main-"));
      fs.writeFileSync(path.join(dir, "photo.png"), ONE_PIXEL_PNG);
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("-y with --source, --format and --dest converts, asks nothing and exits 0", async () => {
      const terminal = new ScriptedTerminal();
      const source = path.join(dir, "photo.png");
      const destination = path.join(dir, "out.webp");

      const code = await main(
        ["-y", "-s", source, "-f", "webp", "-d", destination],
        terminal,
        new InMemoryUpdater(),
      );

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([]);
      expect(fs.existsSync(destination)).toBe(true);
      expect(terminal.stdout).toStartWith(
        "Image Converter - Convert JPEG, PNG, WebP, GIF, TIFF, AVIF or SVG images to WebP, JPEG, PNG or ICO\n\n" +
          "\nConversion settings:\n" +
          `  Source: ${source}\n` +
          "  Target format: WEBP\n" +
          `  Destination: ${destination}\n` +
          // -y only skips prompts; it never turns on Compress.
          "  Compression: No\n",
      );
      expect(terminal.stdout).toContain("\n✓ Conversion complete!\n");
      expect(terminal.stdout).toContain(`\nOutput saved to: ${destination}\n`);
      expect(terminal.stderr).toBe("");
    });

    it("-y without --dest writes next to the source and asks nothing", async () => {
      const source = path.join(dir, "photo.png");
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([]);
      expect(fs.existsSync(path.join(dir, "photo.webp"))).toBe(true);
    });

    it("with no arguments, asks for every setting in order, then converts", async () => {
      const source = path.join(dir, "photo.png");
      const destination = path.join(dir, "asked.jpeg");
      const terminal = new ScriptedTerminal([source, "jpeg", destination, false, true]);

      const code = await main([], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([
        "Source file path",
        "Target format",
        `Destination path (${path.join(dir, "photo.jpeg")})`,
        "Do you want to compress the image?",
        "Proceed with conversion?",
      ]);
      expect(fs.existsSync(destination)).toBe(true);
      expect(terminal.stdout).toContain("  Compression: No\n");
    });

    it("writes nothing and exits 130 when the user declines to proceed", async () => {
      const source = path.join(dir, "photo.png");
      const destination = path.join(dir, "declined.webp");
      const terminal = new ScriptedTerminal([false, false]);

      const code = await main(["-s", source, "-f", "webp", "-d", destination], terminal, new InMemoryUpdater());

      expect(code).toBe(130);
      expect(fs.existsSync(destination)).toBe(false);
      expect(terminal.stdout).toEndWith("Conversion cancelled.\n");
    });

    for (const spelling of ["jpeg", "jpg"]) {
      it(`--format ${spelling} offers a .${spelling} destination and writes it`, async () => {
        const source = path.join(dir, "photo.png");
        const terminal = new ScriptedTerminal(["", false, true]);

        const code = await main(["-s", source, "-f", spelling], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(terminal.asked[0]).toBe(`Destination path (${path.join(dir, `photo.${spelling}`)})`);
        expect((await sharp(path.join(dir, `photo.${spelling}`)).metadata()).format).toBe("jpeg");
      });
    }

    it("a source that is not a known Input Format is a usage error", async () => {
      const source = path.join(dir, "photo.bmp");
      fs.copyFileSync(path.join(dir, "photo.png"), source);
      const destination = path.join(dir, "photo.webp");
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "webp", "-d", destination], terminal, new InMemoryUpdater());

      expect(code).toBe(2);
      expect(terminal.stderr).toContain(`Unsupported input format: ${source}`);
      expect(terminal.asked).toEqual([]);
      expect(fs.existsSync(destination)).toBe(false);
    });

    it("writes nothing and exits 130 when the user presses Ctrl-C at a prompt", async () => {
      const source = path.join(dir, "photo.png");
      const terminal = new ScriptedTerminal([source, "webp", CTRL_C]);

      const code = await main([], terminal, new InMemoryUpdater());

      expect(code).toBe(130);
      expect(terminal.asked).toEqual([
        "Source file path",
        "Target format",
        `Destination path (${path.join(dir, "photo.webp")})`,
      ]);
      expect(fs.readdirSync(dir)).toEqual(["photo.png"]);
      expect(terminal.stderr).toBe("");
    });

    it("reports a failed Conversion on stderr and exits 1", async () => {
      const source = path.join(dir, "missing.png");
      const destination = path.join(dir, "missing.webp");
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "webp", "-d", destination], terminal, new InMemoryUpdater());

      expect(code).toBe(1);
      expect(terminal.stderr).toStartWith("\n✗ Conversion failed: ");
      expect(terminal.stdout).not.toContain("Conversion complete");
    });
  });

  describe("Batch", () => {
    let source: string;
    let output: string;

    beforeEach(() => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "imgc-batch-"));
      source = path.join(root, "in");
      output = path.join(root, "out");
      fs.mkdirSync(source);
      fs.mkdirSync(output);
      fs.writeFileSync(path.join(source, "photo.png"), ONE_PIXEL_PNG);
    });

    afterEach(() => {
      fs.rmSync(path.dirname(source), { recursive: true, force: true });
    });

    it("asks for the output directory, compression and confirmation, then converts", async () => {
      const terminal = new ScriptedTerminal([output, false, true]);

      const code = await main(["-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([
        `Output directory (${source})`,
        "Do you want to compress the image?",
        "Convert 1 files?",
      ]);
      expect(fs.existsSync(path.join(output, "photo.webp"))).toBe(true);
      expect(terminal.stdout).toContain("\nBatch conversion complete!\n  Total files: 1\n  Converted: 1\n");
      expect(terminal.stdout).toContain(`\nOutput directory: ${output}\n`);
    });

    it("writes nothing and exits 130 when the user declines", async () => {
      const terminal = new ScriptedTerminal([output, false, false]);

      const code = await main(["-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(130);
      expect(fs.readdirSync(output)).toEqual([]);
      expect(terminal.stdout).toEndWith("Batch conversion cancelled.\n");
    });

    it("writes nothing and exits 130 when the user presses Ctrl-C at the confirmation", async () => {
      const terminal = new ScriptedTerminal([output, false, CTRL_C]);

      const code = await main(["-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(130);
      expect(terminal.asked).toEqual([`Output directory (${source})`, "Do you want to compress the image?", "Convert 1 files?"]);
      expect(fs.readdirSync(output)).toEqual([]);
    });

    it("an Unattended Run writes next to the sources and asks nothing", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([]);
      expect(fs.existsSync(path.join(source, "photo.webp"))).toBe(true);
      expect(fs.existsSync(path.join(source, "photo.png"))).toBe(true);
    });

    it("lists failed files in the summary and exits 1 when any Conversion fails", async () => {
      const broken = path.join(source, "broken.png");
      fs.writeFileSync(broken, "not an image");
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "webp", "-d", output], terminal, new InMemoryUpdater());

      expect(code).toBe(1);
      expect(terminal.stdout).toContain("  Total files: 2\n  Converted: 1\n  Failed: 1\n");
      expect(terminal.stdout).toContain(`\nFailed files:\n  - ${broken}: `);
    });

    it("converts GIF, TIFF and AVIF sources", async () => {
      for (const name of ["anim.gif", "scan.tif", "photo2.avif"]) {
        const format = path.extname(name).slice(1) as keyof sharp.FormatEnum;
        await sharp({ create: { width: 4, height: 4, channels: 3, background: "#3c3" } })
          .toFormat(format)
          .toFile(path.join(source, name));
      }
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "png", "-d", output], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readdirSync(output).sort()).toEqual(["anim.png", "photo2.png", "scan.png"]);
    });

    it("creates a --dest directory that doesn't exist yet", async () => {
      const missing = path.join(output, "new", "dir");

      const code = await main(["-y", "-s", source, "-f", "webp", "-d", missing], new ScriptedTerminal(), new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readdirSync(missing)).toEqual(["photo.webp"]);
    });

    it("rasterises SVG sources", async () => {
      fs.writeFileSync(
        path.join(source, "logo.svg"),
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
      );

      const code = await main(["-y", "-s", source, "-f", "png", "-d", output], new ScriptedTerminal(), new InMemoryUpdater());

      expect(code).toBe(0);
      expect((await sharp(path.join(output, "logo.png")).metadata()).format).toBe("png");
    });

    it("an Unattended Run honours --dest", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "webp", "-d", output], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.existsSync(path.join(output, "photo.webp"))).toBe(true);
    });
  });

  describe("~ in paths", () => {
    let home: string;
    const originalHome = process.env.HOME;

    beforeEach(() => {
      home = fs.mkdtempSync(path.join(os.tmpdir(), "imgc-home-"));
      process.env.HOME = home;
      fs.writeFileSync(path.join(home, "x.png"), ONE_PIXEL_PNG);
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      fs.rmSync(home, { recursive: true, force: true });
    });

    it("--source ~/x.png resolves to the home directory", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "--source", "~/x.png", "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.stdout).toContain(`  Source: ${path.join(home, "x.png")}\n`);
      expect(fs.existsSync(path.join(home, "x.webp"))).toBe(true);
    });

    it("a typed ~/x.png at the source prompt resolves to the home directory", async () => {
      const terminal = new ScriptedTerminal(["~/x.png", "webp", "", false, true]);

      const code = await main([], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked[2]).toBe(`Destination path (${path.join(home, "x.webp")})`);
      expect(fs.existsSync(path.join(home, "x.webp"))).toBe(true);
    });

    it("--dest ~/out.webp and a typed ~/typed.webp destination resolve to the home directory", async () => {
      const flagged = await main(
        ["-y", "-s", path.join(home, "x.png"), "-f", "webp", "--dest", "~/out.webp"],
        new ScriptedTerminal(),
        new InMemoryUpdater(),
      );
      const typed = await main(
        ["-s", path.join(home, "x.png"), "-f", "webp"],
        new ScriptedTerminal(["~/typed.webp", false, true]),
        new InMemoryUpdater(),
      );

      expect([flagged, typed]).toEqual([0, 0]);
      expect(fs.existsSync(path.join(home, "out.webp"))).toBe(true);
      expect(fs.existsSync(path.join(home, "typed.webp"))).toBe(true);
    });

    it("a Batch accepts ~ in --source and --dest", async () => {
      fs.mkdirSync(path.join(home, "out"));

      const code = await main(["-y", "-s", "~", "-f", "webp", "-d", "~/out"], new ScriptedTerminal(), new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.existsSync(path.join(home, "out", "x.webp"))).toBe(true);
    });
  });

  describe("Compress", () => {
    let dir: string;
    let compressed: Buffer;
    let plain: Buffer;

    beforeEach(async () => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgc-compress-"));
      fs.mkdirSync(path.join(dir, "in"));
      fs.mkdirSync(path.join(dir, "ref"));
      for (const name of ["a.png", "b.png"]) {
        await writeGradientPng(path.join(dir, "in", name));
      }
      // Reference outputs, made by the Output Format module's own WebP recipe.
      await encode(path.join(dir, "in", "a.png"), path.join(dir, "ref", "compressed.webp"), "webp", { compress: true });
      await encode(path.join(dir, "in", "a.png"), path.join(dir, "ref", "plain.webp"), "webp", { compress: false });
      compressed = fs.readFileSync(path.join(dir, "ref", "compressed.webp"));
      plain = fs.readFileSync(path.join(dir, "ref", "plain.webp"));
      expect(compressed.equals(plain)).toBe(false);
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("`-y -s a.png -f webp -c` writes compressed output", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", path.join(dir, "in", "a.png"), "-f", "webp", "-c"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.stdout).toContain("  Compression: Yes\n");
      expect(fs.readFileSync(path.join(dir, "in", "a.webp"))).toEqual(compressed);
    });

    it("`-y -s a.png -f webp` writes uncompressed output", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", path.join(dir, "in", "a.png"), "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readFileSync(path.join(dir, "in", "a.webp"))).toEqual(plain);
    });

    it("an interactive run with -c compresses without asking about it", async () => {
      const terminal = new ScriptedTerminal(["", true]);

      const code = await main(["-s", path.join(dir, "in", "a.png"), "-f", "webp", "--compress"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([`Destination path (${path.join(dir, "in", "a.webp")})`, "Proceed with conversion?"]);
      expect(fs.readFileSync(path.join(dir, "in", "a.webp"))).toEqual(compressed);
    });

    it("a Batch with `-y -c` compresses every Conversion", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-c", "-s", path.join(dir, "in"), "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readFileSync(path.join(dir, "in", "a.webp"))).toEqual(compressed);
      expect(fs.readFileSync(path.join(dir, "in", "b.webp"))).toEqual(compressed);
    });

    it("a Batch with `-y` alone compresses nothing", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", path.join(dir, "in"), "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readFileSync(path.join(dir, "in", "a.webp"))).toEqual(plain);
      expect(fs.readFileSync(path.join(dir, "in", "b.webp"))).toEqual(plain);
    });
  });

  describe("Conversion Plan", () => {
    let dir: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgc-plan-"));
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    /** Write a small real image in the format its extension names. */
    async function writeImage(name: string): Promise<string> {
      const filePath = path.join(dir, name);
      const format = path.extname(name).slice(1).toLowerCase().replace("jpg", "jpeg") as keyof sharp.FormatEnum;
      await sharp({ create: { width: 4, height: 4, channels: 3, background: "#36c" } })
        .toFormat(format)
        .toFile(filePath);
      return filePath;
    }

    async function formatOf(filePath: string): Promise<string | undefined> {
      return (await sharp(filePath).metadata()).format;
    }

    it("a Batch keeps the source extension only for sources whose output names collide", async () => {
      await writeImage("photo.png");
      await writeImage("photo.jpg");
      await writeImage("other.png");
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", dir, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readdirSync(dir).sort()).toEqual([
        "other.png", "other.webp", "photo.jpg", "photo.jpg.webp", "photo.png", "photo.png.webp",
      ]);
      expect(await formatOf(path.join(dir, "photo.png.webp"))).toBe("webp");
      expect(await formatOf(path.join(dir, "photo.jpg.webp"))).toBe("webp");
    });

    it("a Batch skips sources already in the Output Format and reports why", async () => {
      await writeImage("a.png");
      const already = await writeImage("b.webp");
      const before = fs.readFileSync(already);
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", dir, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readdirSync(dir).sort()).toEqual(["a.png", "a.webp", "b.webp"]);
      expect(fs.readFileSync(already)).toEqual(before);
      expect(terminal.stdout).toContain("  Converted: 1\n  Failed: 0\n  Skipped: 1\n");
      expect(terminal.stdout).toContain(`\nSkipped files:\n  - ${already}: already WebP\n`);
    });

    it("a Batch never writes over one of its own sources, even with --overwrite", async () => {
      await writeImage("photo.png");
      const already = await writeImage("photo.webp");
      const before = fs.readFileSync(already);

      const code = await main(["-y", "--overwrite", "-s", dir, "-f", "webp"], new ScriptedTerminal(), new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readFileSync(already)).toEqual(before);
      expect(fs.readdirSync(dir).sort()).toEqual(["photo.png", "photo.png.webp", "photo.webp"]);
    });

    describe("existing outputs in an Unattended Run", () => {
      it("a Batch skips them and reports them as skipped", async () => {
        await writeImage("a.png");
        await writeImage("b.png");
        const out = path.join(dir, "out");
        fs.mkdirSync(out);
        fs.writeFileSync(path.join(out, "b.webp"), "old");
        const terminal = new ScriptedTerminal();

        const code = await main(["-y", "-s", dir, "-f", "webp", "-d", out], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(fs.readFileSync(path.join(out, "b.webp"), "utf8")).toBe("old");
        expect(await formatOf(path.join(out, "a.webp"))).toBe("webp");
        expect(terminal.stdout).toContain("  Converted: 1\n  Failed: 0\n  Skipped: 1\n");
        expect(terminal.stdout).toContain(
          `\nSkipped files:\n  - ${path.join(dir, "b.png")}: ${path.join(out, "b.webp")} already exists\n`,
        );
      });

      it("a Batch with --overwrite replaces them", async () => {
        await writeImage("b.png");
        const out = path.join(dir, "out");
        fs.mkdirSync(out);
        fs.writeFileSync(path.join(out, "b.webp"), "old");
        const terminal = new ScriptedTerminal();

        const code = await main(["-y", "--overwrite", "-s", dir, "-f", "webp", "-d", out], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(await formatOf(path.join(out, "b.webp"))).toBe("webp");
        expect(terminal.stdout).toContain("  Converted: 1\n  Failed: 0\n  Skipped: 0\n");
      });

      it("a single-file run skips it, says so and exits 0", async () => {
        const source = await writeImage("photo.png");
        fs.writeFileSync(path.join(dir, "photo.webp"), "old");
        const terminal = new ScriptedTerminal();

        const code = await main(["-y", "-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(fs.readFileSync(path.join(dir, "photo.webp"), "utf8")).toBe("old");
        expect(terminal.stdout).toEndWith(`\nSkipped ${source}: ${path.join(dir, "photo.webp")} already exists\n`);
        expect(terminal.stdout).not.toContain("Conversion complete");
      });

      it("a single-file run with --overwrite replaces it", async () => {
        const source = await writeImage("photo.png");
        fs.writeFileSync(path.join(dir, "photo.webp"), "old");
        const terminal = new ScriptedTerminal();

        const code = await main(["-y", "--overwrite", "-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(await formatOf(path.join(dir, "photo.webp"))).toBe("webp");
        expect(terminal.stdout).toContain("\n✓ Conversion complete!\n");
      });
    });

    describe("existing outputs in an interactive run", () => {
      let out: string;

      beforeEach(async () => {
        for (const name of ["a.png", "b.png", "c.png"]) {
          await writeImage(name);
        }
        out = path.join(dir, "out");
        fs.mkdirSync(out);
        fs.writeFileSync(path.join(out, "a.webp"), "old");
        fs.writeFileSync(path.join(out, "b.webp"), "old");
      });

      const question = "2 files exist: overwrite all / skip them / cancel";

      it("asks once; \"skip them\" skips exactly those and the confirmation counts the rest", async () => {
        const terminal = new ScriptedTerminal([false, "skip", true]);

        const code = await main(["-s", dir, "-f", "webp", "-d", out], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(terminal.asked).toEqual(["Do you want to compress the image?", question, "Convert 1 files?"]);
        expect(fs.readFileSync(path.join(out, "a.webp"), "utf8")).toBe("old");
        expect(fs.readFileSync(path.join(out, "b.webp"), "utf8")).toBe("old");
        expect(await formatOf(path.join(out, "c.webp"))).toBe("webp");
        expect(terminal.stdout).toContain("  Converted: 1\n  Failed: 0\n  Skipped: 2\n");
      });

      it("\"overwrite all\" replaces them", async () => {
        const terminal = new ScriptedTerminal([false, "overwrite", true]);

        const code = await main(["-s", dir, "-f", "webp", "-d", out], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(terminal.asked).toEqual(["Do you want to compress the image?", question, "Convert 3 files?"]);
        for (const name of ["a.webp", "b.webp", "c.webp"]) {
          expect(await formatOf(path.join(out, name))).toBe("webp");
        }
      });

      it("\"cancel\" writes nothing and exits 130", async () => {
        const terminal = new ScriptedTerminal([false, "cancel"]);

        const code = await main(["-s", dir, "-f", "webp", "-d", out], terminal, new InMemoryUpdater());

        expect(code).toBe(130);
        expect(terminal.asked).toEqual(["Do you want to compress the image?", question]);
        expect(fs.readdirSync(out).sort()).toEqual(["a.webp", "b.webp"]);
        expect(fs.readFileSync(path.join(out, "a.webp"), "utf8")).toBe("old");
      });

      it("Ctrl-C at the question writes nothing and exits 130", async () => {
        const terminal = new ScriptedTerminal([false, CTRL_C]);

        const code = await main(["-s", dir, "-f", "webp", "-d", out], terminal, new InMemoryUpdater());

        expect(code).toBe(130);
        expect(fs.readdirSync(out).sort()).toEqual(["a.webp", "b.webp"]);
      });

      it("--overwrite answers the question, so it isn't asked", async () => {
        const terminal = new ScriptedTerminal([false, true]);

        const code = await main(["--overwrite", "-s", dir, "-f", "webp", "-d", out], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(terminal.asked).toEqual(["Do you want to compress the image?", "Convert 3 files?"]);
        expect(await formatOf(path.join(out, "a.webp"))).toBe("webp");
      });

      it("a single-file run gets the same question", async () => {
        const source = path.join(dir, "a.png");
        const destination = path.join(out, "a.webp");

        const skipped = new ScriptedTerminal([false, "skip"]);
        const skipCode = await main(["-s", source, "-f", "webp", "-d", destination], skipped, new InMemoryUpdater());

        expect(skipCode).toBe(0);
        expect(skipped.asked).toEqual(["Do you want to compress the image?", "1 file exists: overwrite all / skip them / cancel"]);
        expect(fs.readFileSync(destination, "utf8")).toBe("old");
        expect(skipped.stdout).toEndWith(`\nSkipped ${source}: ${destination} already exists\n`);

        const replaced = new ScriptedTerminal([false, "overwrite", true]);
        const replaceCode = await main(["-s", source, "-f", "webp", "-d", destination], replaced, new InMemoryUpdater());

        expect(replaceCode).toBe(0);
        expect(replaced.asked.at(-1)).toBe("Proceed with conversion?");
        expect(await formatOf(destination)).toBe("webp");
      });
    });

    it("a single-file run re-encodes a same-format source to <name>.converted.<ext>, never over the source", async () => {
      const source = await writeImage("photo.png");
      const before = fs.readFileSync(source);
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "png", "-c"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.readFileSync(source)).toEqual(before);
      expect(await formatOf(path.join(dir, "photo.converted.png"))).toBe("png");
      expect(terminal.stdout).toContain(`\nOutput saved to: ${path.join(dir, "photo.converted.png")}\n`);
    });

    describe("paths that differ only in case name the same file", () => {
      for (const flags of [[], ["--overwrite"]]) {
        it(`a same-format source with an upper-case extension writes <name>.converted.<ext> (${flags.join(" ") || "no flags"})`, async () => {
          const source = await writeImage("single.PNG");
          const before = fs.readFileSync(source);
          const terminal = new ScriptedTerminal();

          const code = await main(["-y", ...flags, "-s", source, "-f", "png", "-c"], terminal, new InMemoryUpdater());

          expect(code).toBe(0);
          expect(fs.readFileSync(source)).toEqual(before);
          expect(fs.readdirSync(dir).sort()).toEqual(["single.PNG", "single.converted.png"]);
          expect(terminal.stdout).toContain(`\nOutput saved to: ${path.join(dir, "single.converted.png")}\n`);
        });
      }

      it("--dest differing from the source only in case is refused with exit 2", async () => {
        const source = await writeImage("photo.png");
        const before = fs.readFileSync(source);
        const terminal = new ScriptedTerminal();

        const code = await main(
          ["-y", "--overwrite", "-s", source, "-f", "png", "-d", path.join(dir, "PHOTO.PNG")],
          terminal,
          new InMemoryUpdater(),
        );

        expect(code).toBe(2);
        expect(terminal.stderr).toContain(`the destination is the source file ${source}`);
        expect(fs.readFileSync(source)).toEqual(before);
      });

      it("a Batch treats output names that differ only in case as a collision", async () => {
        await writeImage("Photo.png");
        await writeImage("photo.jpg");
        const terminal = new ScriptedTerminal();

        const code = await main(["-y", "-s", dir, "-f", "webp"], terminal, new InMemoryUpdater());

        expect(code).toBe(0);
        expect(fs.readdirSync(dir).sort()).toEqual(["Photo.png", "Photo.png.webp", "photo.jpg", "photo.jpg.webp"]);
        expect(terminal.stdout).toContain("  Converted: 2\n  Failed: 0\n  Skipped: 0\n");
      });

      it("a Batch never writes over a source whose name differs only in case", async () => {
        await writeImage("photo.png");
        const already = await writeImage("PHOTO.WEBP");
        const before = fs.readFileSync(already);

        const code = await main(["-y", "--overwrite", "-s", dir, "-f", "webp"], new ScriptedTerminal(), new InMemoryUpdater());

        expect(code).toBe(0);
        expect(fs.readFileSync(already)).toEqual(before);
        expect(fs.readdirSync(dir).sort()).toEqual(["PHOTO.WEBP", "photo.png", "photo.png.webp"]);
      });
    });

    it("an interactive same-format run offers <name>.converted.<ext> as the destination", async () => {
      const source = await writeImage("photo.jpg");
      const terminal = new ScriptedTerminal(["", false, true]);

      const code = await main(["-s", source, "-f", "jpg"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked[0]).toBe(`Destination path (${path.join(dir, "photo.converted.jpg")})`);
      expect(fs.readdirSync(dir).sort()).toEqual(["photo.converted.jpg", "photo.jpg"]);
    });

    for (const destination of ["photo.png", "./photo.png"]) {
      it(`--dest equal to the source (${destination}) is refused with exit 2`, async () => {
        const source = await writeImage("photo.png");
        const before = fs.readFileSync(source);
        const terminal = new ScriptedTerminal();

        const code = await main(
          ["-y", "-s", source, "-f", "png", "-d", path.join(dir, destination)],
          terminal,
          new InMemoryUpdater(),
        );

        expect(code).toBe(2);
        expect(terminal.stderr).toContain(`the destination is the source file ${source}; choose another output path`);
        expect(terminal.stderr).toEndWith("Run 'imgc --help' for usage.\n");
        expect(fs.readFileSync(source)).toEqual(before);
        expect(fs.readdirSync(dir)).toEqual(["photo.png"]);
      });
    }
  });
});
