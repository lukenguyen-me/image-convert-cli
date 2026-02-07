import { expect, describe, it } from "bun:test";
import { runCli, handleUpdate } from "../src/cli";
import { NoopPromptService } from "../src/prompts";

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
});
