import { expect, describe, it } from "bun:test";
import { convertImage, convertBatch, displayBatchResult } from "../src/converter";
import * as fs from "node:fs";
import * as path from "node:path";
import type { BatchConversionSummary } from "../src/types";

describe("convertImage", () => {
  it("should return success false for non-existent file", async () => {
    const result = await convertImage(
      "/non/existent/path.jpg",
      "/tmp/output.webp",
      "webp",
      false,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should convert jpeg to png successfully", async () => {
    // Create a test image if it doesn't exist
    const sourcePath = path.join(__dirname, "fixtures", "test.jpg");
    const destPath = path.join(__dirname, "fixtures", "test_output.png");

    // Create fixture directory and test image if needed
    const fixtureDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // Use example image if fixture doesn't exist
    const actualSource = fs.existsSync(sourcePath)
      ? sourcePath
      : path.join(__dirname, "..", "example", "picture-1.jpg");

    // Skip test if no source image available
    if (!fs.existsSync(actualSource)) {
      return;
    }

    const result = await convertImage(actualSource, destPath, "png", false);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(fs.existsSync(destPath)).toBe(true);

    // Cleanup
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }
  });

  it("should convert png to webp successfully", async () => {
    const sourcePath = path.join(__dirname, "fixtures", "test.png");
    const destPath = path.join(__dirname, "fixtures", "test_output.webp");

    const fixtureDir = path.join(__dirname, "fixtures");
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // Use example image if fixture doesn't exist
    const actualSource = fs.existsSync(sourcePath)
      ? sourcePath
      : path.join(__dirname, "..", "example", "picture-1.jpg");

    // Skip test if no source image available
    if (!fs.existsSync(actualSource)) {
      return;
    }

    // First create a PNG, then convert it
    const pngPath = path.join(__dirname, "fixtures", "temp_test.png");
    await convertImage(actualSource, pngPath, "png", false);

    const result = await convertImage(pngPath, destPath, "webp", false);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(fs.existsSync(destPath)).toBe(true);

    // Cleanup
    [destPath, pngPath].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });
});

describe("convertBatch", () => {
  // Helper to create a simple test PNG image
  async function createTestImage(savePath: string): Promise<void> {
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
      "base64",
    );
    fs.writeFileSync(savePath, onePixelPng);
  }

  it("should convert all images in directory", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_source");
    const destDir = path.join(__dirname, "fixtures", "batch_dest");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    // Create test images
    await createTestImage(path.join(sourceDir, "image1.jpg"));
    await createTestImage(path.join(sourceDir, "image2.png"));

    const result = await convertBatch({
      sourceDir,
      targetFormat: "webp",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);

    // Cleanup
    fs.rmSync(sourceDir, { recursive: true });
    fs.rmSync(destDir, { recursive: true });
  });

  it("should return correct successCount", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_source2");
    const destDir = path.join(__dirname, "fixtures", "batch_dest2");
    fs.mkdirSync(sourceDir, { recursive: true });

    await createTestImage(path.join(sourceDir, "image1.jpg"));

    const result = await convertBatch({
      sourceDir,
      targetFormat: "webp",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    expect(result.successCount).toBe(1);

    fs.rmSync(sourceDir, { recursive: true });
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
  });

  it("should skip files with target format", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_source3");
    const destDir = path.join(__dirname, "fixtures", "batch_dest3");
    fs.mkdirSync(sourceDir, { recursive: true });

    await createTestImage(path.join(sourceDir, "image1.jpg"));
    await createTestImage(path.join(sourceDir, "image2.webp")); // Already webp

    const result = await convertBatch({
      sourceDir,
      targetFormat: "webp",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    expect(result.skippedCount).toBe(1);
    expect(result.successCount).toBe(1);

    fs.rmSync(sourceDir, { recursive: true });
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true });
    }
  });

  it("should create output directory if not exists", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_source4");
    const destDir = path.join(__dirname, "fixtures", "batch_dest_nested", "nested");
    fs.mkdirSync(sourceDir, { recursive: true });

    await createTestImage(path.join(sourceDir, "image1.jpg"));

    await convertBatch({
      sourceDir,
      targetFormat: "webp",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    expect(fs.existsSync(destDir)).toBe(true);

    fs.rmSync(sourceDir, { recursive: true });
    fs.rmSync(path.join(__dirname, "fixtures", "batch_dest_nested"), {
      recursive: true,
    });
  });

  it("should place converted files in output directory", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_source5");
    const destDir = path.join(__dirname, "fixtures", "batch_dest5");
    fs.mkdirSync(sourceDir, { recursive: true });

    await createTestImage(path.join(sourceDir, "image1.jpg"));

    await convertBatch({
      sourceDir,
      targetFormat: "webp",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    const convertedFile = path.join(destDir, "image1.webp");
    expect(fs.existsSync(convertedFile)).toBe(true);

    fs.rmSync(sourceDir, { recursive: true });
    fs.rmSync(destDir, { recursive: true });
  });

  it("should skip existing files in yes mode", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_source6");
    const destDir = path.join(__dirname, "fixtures", "batch_dest6");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    await createTestImage(path.join(sourceDir, "image1.jpg"));

    // Create existing file in destination
    fs.writeFileSync(path.join(destDir, "image1.webp"), "existing");

    const result = await convertBatch({
      sourceDir,
      targetFormat: "webp",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    expect(result.skippedCount).toBe(1);
    // File should not be overwritten
    const content = fs.readFileSync(path.join(destDir, "image1.webp"), "utf-8");
    expect(content).toBe("existing");

    fs.rmSync(sourceDir, { recursive: true });
    fs.rmSync(destDir, { recursive: true });
  });

  it("should count skipped files in result", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_source7");
    const destDir = path.join(__dirname, "fixtures", "batch_dest7");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    await createTestImage(path.join(sourceDir, "image1.jpg"));
    await createTestImage(path.join(sourceDir, "image2.jpg"));

    // Create one existing file
    fs.writeFileSync(path.join(destDir, "image1.webp"), "existing");

    const result = await convertBatch({
      sourceDir,
      targetFormat: "webp",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    expect(result.skippedCount).toBe(1);
    expect(result.successCount).toBe(1);

    fs.rmSync(sourceDir, { recursive: true });
    fs.rmSync(destDir, { recursive: true });
  });
});

describe("displayBatchResult", () => {
  it("should display batch conversion results", () => {
    let logOutput = "";
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logOutput += args.join(" ") + "\n";
      originalLog(...args);
    };

    const summary: BatchConversionSummary = {
      totalFiles: 2,
      successCount: 1,
      failureCount: 1,
      skippedCount: 0,
      results: [],
      totalElapsed: 100,
    };

    displayBatchResult(summary);

    console.log = originalLog;

    expect(logOutput).toContain("Batch conversion complete");
    expect(logOutput).toContain("Total files: 2");
  });
});
