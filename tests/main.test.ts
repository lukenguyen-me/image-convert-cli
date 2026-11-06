import { expect, describe, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { main } from "../src/cli";
import { CTRL_C, ScriptedTerminal } from "../src/scripted-terminal";
import { InMemoryUpdater } from "../src/updater";
import packageJson from "../package.json" with { type: "json" };

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

describe("main", () => {
  describe("--help", () => {
    it("prints the help text and exits 0", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["--help"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.stdout).toContain("Image Converter CLI");
      expect(terminal.stdout).toContain("imgc -y --source <path> --format <format>");
      expect(terminal.stdout).toContain("--format, -f     Target format: webp, jpeg, jpg, png, or ico");
      expect(terminal.stderr).toBe("");
      expect(terminal.asked).toEqual([]);
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

  describe("-y without --source and --format", () => {
    it("reports the error, prints help, asks nothing and exits 0", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", "photo.png"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.stderr).toBe("Error: -y mode requires --source and --format arguments\n");
      expect(terminal.stdout).toContain("Image Converter CLI");
      expect(terminal.asked).toEqual([]);
    });
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
        "Image Converter - Convert images between webp, jpeg, jpg, png, and svg\n\n" +
          "\nConversion settings:\n" +
          `  Source: ${source}\n` +
          "  Target format: WEBP\n" +
          `  Destination: ${destination}\n` +
          // Today -y turns compression on (spec #1 changes this).
          "  Compression: Yes\n",
      );
      expect(terminal.stdout).toContain("\n✓ Conversion complete!\n");
      expect(terminal.stdout).toContain(`\nOutput saved to: ${destination}\n`);
      expect(terminal.stderr).toBe("");
    });

    it("-y without --dest still asks for the destination, offering one next to the source", async () => {
      // Today's behaviour, kept by this prefactor (spec #1 changes this).
      const source = path.join(dir, "photo.png");
      const terminal = new ScriptedTerminal([""]);

      const code = await main(["-y", "-s", source, "-f", "webp"], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(terminal.asked).toEqual([`Destination path (${path.join(dir, "photo.webp")})`]);
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

    it("an Unattended Run honours --dest", async () => {
      const terminal = new ScriptedTerminal();

      const code = await main(["-y", "-s", source, "-f", "webp", "-d", output], terminal, new InMemoryUpdater());

      expect(code).toBe(0);
      expect(fs.existsSync(path.join(output, "photo.webp"))).toBe(true);
    });
  });
});
