import { expect, describe, it } from "bun:test";
import {
  InteractivePromptService,
  NoopPromptService,
} from "../src/prompts";

describe("NoopPromptService", () => {
  it("should return default values for all prompts", async () => {
    const prompts = new NoopPromptService();

    await expect(prompts.promptSourceFile()).resolves.toBe("");
    await expect(prompts.promptDestination("/default")).resolves.toBe("/default");
    await expect(prompts.promptFormat()).resolves.toBe("webp");
    await expect(prompts.promptCompress()).resolves.toBe(false);
    await expect(prompts.promptConfirm()).resolves.toBe(true);
    await expect(prompts.promptForOverwrite("file")).resolves.toBe(false);
    await expect(prompts.promptBatchDestination("/default")).resolves.toBe("/default");
    await expect(prompts.promptBatchConfirm()).resolves.toBe(true);
  });

  it("should return configured responses", async () => {
    const prompts = new NoopPromptService({
      source: "/path/to/file.jpg",
      destination: "/output",
      format: "png",
      compress: true,
      confirm: false,
      overwrite: true,
      batchDestination: "/batch/output",
      batchConfirm: false,
    });

    await expect(prompts.promptSourceFile()).resolves.toBe("/path/to/file.jpg");
    await expect(prompts.promptDestination("/default")).resolves.toBe("/output");
    await expect(prompts.promptFormat()).resolves.toBe("png");
    await expect(prompts.promptCompress()).resolves.toBe(true);
    await expect(prompts.promptConfirm()).resolves.toBe(false);
    await expect(prompts.promptForOverwrite("file")).resolves.toBe(true);
    await expect(prompts.promptBatchDestination("/default")).resolves.toBe("/batch/output");
    await expect(prompts.promptBatchConfirm()).resolves.toBe(false);
  });

  it("should not throw for show methods", () => {
    const prompts = new NoopPromptService();
    prompts.showHelp();
    prompts.showSettings({} as any);
    prompts.showResult({} as any);
  });
});

describe("InteractivePromptService", () => {
  // Note: InteractivePromptService tests require user interaction
  // These tests verify the interface exists and can be instantiated
  it("should be instantiable", () => {
    const prompts = new InteractivePromptService();
    expect(prompts).toBeDefined();
  });
});
