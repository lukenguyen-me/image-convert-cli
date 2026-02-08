import { expect, describe, it } from "bun:test";
import { runCli, handleUpdate } from "../src/cli";
import { NoopPromptService } from "../src/prompts";
import * as fs from "node:fs";
import * as path from "node:path";

describe("cli", () => {
  describe("runCli", () => {
    it("should handle --help flag", async () => {
      let helpShown = false;

      const prompts = new NoopPromptService();

      // Mock console.log to capture help output
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        if (
          args[0] &&
          typeof args[0] === "string" &&
          args[0].includes("Image Converter CLI")
        ) {
          helpShown = true;
        }
        originalLog(...args);
      };

      await runCli({ help: true }, prompts);

      console.log = originalLog;
    });

    it("should show error for -y mode without required args", async () => {
      let errorShown = false;

      const prompts = new NoopPromptService();

      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        if (
          args[0] &&
          typeof args[0] === "string" &&
          args[0].includes("Error")
        ) {
          errorShown = true;
        }
        originalError(...args);
      };

      await runCli({ yes: true }, prompts);

      console.error = originalError;

      expect(errorShown).toBe(true);
    });
  });

  describe("handleUpdate", () => {
    it("should show update available when newer version exists", async () => {
      const logs: string[] = [];

      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        if (args[0] && typeof args[0] === "string") {
          logs.push(args[0]);
        }
        originalLog(...args);
      };

      // Mock fetcher returning a newer version
      await handleUpdate(async () => "2.0.0", "1.0.0");

      console.log = originalLog;

      expect(logs.some(msg => msg.includes("1.0.0") && msg.includes("2.0.0"))).toBe(true);
    });

    it("should show up-to-date message when versions match", async () => {
      const logs: string[] = [];

      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        if (args[0] && typeof args[0] === "string") {
          logs.push(args[0]);
        }
        originalLog(...args);
      };

      await handleUpdate(async () => "1.0.0", "1.0.0");

      console.log = originalLog;

      expect(logs.some(msg => msg.includes("latest version"))).toBe(true);
    });

    it("should handle fetch errors gracefully", async () => {
      const errors: string[] = [];

      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        if (args[0] && typeof args[0] === "string") {
          errors.push(args[0]);
        }
        originalError(...args);
      };

      await handleUpdate(async () => {
        throw new Error("Network error");
      }, "1.0.0");

      console.error = originalError;

      expect(errors.some(msg => msg.includes("Error"))).toBe(true);
    });
  });

  describe("version", () => {
    it("should display version when version option is true", async () => {
      let versionOutput = "";

      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        if (args[0] && typeof args[0] === "string" && args[0].includes("image-convert-cli v")) {
          versionOutput = args[0];
        }
        originalLog(...args);
      };

      await runCli({ version: true }, new NoopPromptService());

      console.log = originalLog;

      expect(versionOutput).toContain("image-convert-cli v");
    });

    it("should include version number in output", async () => {
      let versionOutput = "";

      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        if (args[0] && typeof args[0] === "string") {
          versionOutput = args[0];
        }
        originalLog(...args);
      };

      await runCli({ version: true }, new NoopPromptService());

      console.log = originalLog;

      // Should contain a version pattern like v1.0.0
      expect(versionOutput).toMatch(/image-convert-cli v\d+\.\d+\.\d+/);
    });
  });

  describe("batch mode", () => {
    it("should detect source is directory", async () => {
      const testDir = path.join(__dirname, "fixtures", "batch_cli_test");
      fs.mkdirSync(testDir, { recursive: true });

      try {
        const prompts = new NoopPromptService({
          source: testDir,
          format: "webp",
          batchDestination: path.join(__dirname, "fixtures", "batch_cli_output"),
          batchConfirm: false,
        });

        let batchModeTriggered = false;
        const originalLog = console.log;
        console.log = (...args: unknown[]) => {
          if (args[0] && typeof args[0] === "string" && args[0].includes("Image Converter")) {
            batchModeTriggered = true;
          }
          originalLog(...args);
        };

        await runCli({ source: testDir, format: "webp" }, prompts);

        console.log = originalLog;
        // Should show help because batchConfirm is false (cancelled)
        expect(batchModeTriggered).toBe(true);
      } finally {
        fs.rmSync(testDir, { recursive: true });
        const outputDir = path.join(__dirname, "fixtures", "batch_cli_output");
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true });
        }
      }
    });

    it("should handle batch mode with prompts", async () => {
      const testDir = path.join(__dirname, "fixtures", "batch_cli_test2");
      fs.mkdirSync(testDir, { recursive: true });

      // Create a test file
      const onePixelPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
        "base64",
      );
      fs.writeFileSync(path.join(testDir, "test.png"), onePixelPng);

      const outputDir = path.join(__dirname, "fixtures", "batch_cli_output2");
      fs.mkdirSync(outputDir, { recursive: true });

      try {
        const prompts = new NoopPromptService({
          source: testDir,
          format: "webp",
          batchDestination: outputDir,
          batchConfirm: true,
          compress: false,
        });

        await runCli({ source: testDir, format: "webp" }, prompts);

        // Check that output was created
        const outputFile = path.join(outputDir, "test.webp");
        expect(fs.existsSync(outputFile)).toBe(true);
      } finally {
        fs.rmSync(testDir, { recursive: true });
        fs.rmSync(outputDir, { recursive: true });
      }
    });

    it("should skip prompts in yes mode", async () => {
      const testDir = path.join(__dirname, "fixtures", "batch_cli_test3");
      fs.mkdirSync(testDir, { recursive: true });

      // Create a test file
      const onePixelPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
        "base64",
      );
      fs.writeFileSync(path.join(testDir, "test.png"), onePixelPng);

      const outputDir = path.join(__dirname, "fixtures", "batch_cli_output3");
      fs.mkdirSync(outputDir, { recursive: true });

      try {
        // In yes mode, should not need prompts for batchDestination or batchConfirm
        const prompts = new NoopPromptService();

        await runCli({ source: testDir, format: "webp", yes: true, destination: outputDir }, prompts);

        // Check that output was created
        const outputFile = path.join(outputDir, "test.webp");
        expect(fs.existsSync(outputFile)).toBe(true);
      } finally {
        fs.rmSync(testDir, { recursive: true });
        fs.rmSync(outputDir, { recursive: true });
      }
    });

    it("should use same directory as destination by default in yes mode", async () => {
      const testDir = path.join(__dirname, "fixtures", "batch_cli_test4");
      fs.mkdirSync(testDir, { recursive: true });

      // Create a test file
      const onePixelPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
        "base64",
      );
      fs.writeFileSync(path.join(testDir, "test.png"), onePixelPng);

      try {
        const prompts = new NoopPromptService();

        // No destination provided - should default to same as source
        await runCli({ source: testDir, format: "webp", yes: true }, prompts);

        // Check that output was created in the same directory as source
        const outputFile = path.join(testDir, "test.webp");
        expect(fs.existsSync(outputFile)).toBe(true);
        // Original file should still exist
        expect(fs.existsSync(path.join(testDir, "test.png"))).toBe(true);
      } finally {
        fs.rmSync(testDir, { recursive: true });
      }
    });
  });
});
