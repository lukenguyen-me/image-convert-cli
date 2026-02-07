import { expect, describe, it } from "bun:test";
import { runCli } from "../src/cli";
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
});
