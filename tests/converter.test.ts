import { expect, describe, it } from "bun:test";
import { convertBatch } from "../src/converter";
import * as fs from "node:fs";
import * as path from "node:path";

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

  it("should include svg files in batch conversion", async () => {
    const sourceDir = path.join(__dirname, "fixtures", "batch_with_svg");
    const destDir = path.join(__dirname, "fixtures", "batch_with_svg_dest");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    // Create test SVG file
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';
    fs.writeFileSync(path.join(sourceDir, "image.svg"), svgContent);

    const result = await convertBatch({
      sourceDir,
      targetFormat: "png",
      destinationDir: destDir,
      compress: false,
      yesMode: true,
    });

    expect(result.successCount).toBe(1);

    // Cleanup
    fs.rmSync(sourceDir, { recursive: true });
    fs.rmSync(destDir, { recursive: true });
  });
});
