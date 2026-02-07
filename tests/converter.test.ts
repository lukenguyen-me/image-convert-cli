import { expect, describe, it } from "bun:test";
import { convertImage } from "../src/converter";
import * as fs from "node:fs";
import * as path from "node:path";

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
