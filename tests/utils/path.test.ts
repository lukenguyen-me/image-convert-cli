import { expect, describe, it } from "bun:test";
import {
  getDefaultDestinationPath,
  isDirectory,
  getExtension,
  isSameFormat,
  getImageFilesFromDirectory,
  ensureDirectoryExists,
} from "../../src/utils/path";
import * as fs from "node:fs";
import * as path from "node:path";

describe("getDefaultDestinationPath", () => {
  it("should replace extension with webp", () => {
    const result = getDefaultDestinationPath("/path/to/image.jpg", "webp");
    expect(result).toBe("/path/to/image.webp");
  });

  it("should replace extension with ico", () => {
    const result = getDefaultDestinationPath("/path/to/image.jpg", "ico");
    expect(result).toBe("/path/to/image.ico");
  });

  it("should handle jpeg to jpg conversion", () => {
    const result = getDefaultDestinationPath("/path/to/image.jpeg", "jpg");
    expect(result).toBe("/path/to/image.jpg");
  });

  it("should handle png to webp conversion", () => {
    const result = getDefaultDestinationPath("/images/photo.png", "webp");
    expect(result).toBe("/images/photo.webp");
  });

  it("should preserve directory structure", () => {
    const result = getDefaultDestinationPath("/a/b/c/d/image", "webp");
    expect(result).toBe("/a/b/c/d/image.webp");
  });

  it("should handle files without extension", () => {
    const result = getDefaultDestinationPath("/path/to/myfile", "webp");
    expect(result).toBe("/path/to/myfile.webp");
  });

  it("should handle relative paths", () => {
    const result = getDefaultDestinationPath("photo.jpg", "webp");
    expect(result).toBe("photo.webp");
  });

  it("should handle paths with multiple dots", () => {
    const result = getDefaultDestinationPath(
      "/path/to/image.v2.orig.png",
      "webp",
    );
    expect(result).toBe("/path/to/image.v2.orig.webp");
  });
});

describe("isDirectory", () => {
  it("should return true for directory path", () => {
    // Create a temporary directory for testing
    const testDir = path.join(__dirname, "fixtures", "test_is_dir");
    fs.mkdirSync(testDir, { recursive: true });

    try {
      expect(isDirectory(testDir)).toBe(true);
    } finally {
      fs.rmdirSync(testDir);
    }
  });

  it("should return false for file path", () => {
    const sourcePath = path.join(__dirname, "fixtures", "test.jpg");
    const fixtureDir = path.join(__dirname, "fixtures");

    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // Use example image if fixture doesn't exist
    const actualSource = fs.existsSync(sourcePath)
      ? sourcePath
      : path.join(__dirname, "..", "..", "example", "picture-1.jpg");

    if (fs.existsSync(actualSource)) {
      expect(isDirectory(actualSource)).toBe(false);
    }
  });

  it("should return false for non-existent path", () => {
    expect(isDirectory("/non/existent/path")).toBe(false);
  });
});

describe("getExtension", () => {
  it("should return lowercase extension without dot", () => {
    expect(getExtension("/path/to/image.jpg")).toBe("jpg");
  });

  it("should return empty string for no extension", () => {
    expect(getExtension("/path/to/myfile")).toBe("");
  });

  it("should handle uppercase extensions", () => {
    expect(getExtension("/path/to/image.PNG")).toBe("png");
  });

  it("should handle mixed case extensions", () => {
    expect(getExtension("/path/to/image.WebP")).toBe("webp");
  });
});

describe("isSameFormat", () => {
  it("should return true for matching extensions", () => {
    expect(isSameFormat("/path/to/image.jpg", "jpg")).toBe(true);
    expect(isSameFormat("/path/to/image.png", "png")).toBe(true);
    expect(isSameFormat("/path/to/image.webp", "webp")).toBe(true);
  });

  it("should return true for ico format", () => {
    expect(isSameFormat("/path/to/image.ico", "ico")).toBe(true);
  });

  it("should return false when ico source targets different format", () => {
    expect(isSameFormat("/path/to/image.ico", "png")).toBe(false);
  });

  it("should return true for jpeg/jpg equivalence", () => {
    expect(isSameFormat("/path/to/image.jpeg", "jpg")).toBe(true);
    expect(isSameFormat("/path/to/image.jpg", "jpeg")).toBe(true);
  });

  it("should return false for different formats", () => {
    expect(isSameFormat("/path/to/image.jpg", "png")).toBe(false);
    expect(isSameFormat("/path/to/image.png", "webp")).toBe(false);
  });
});

describe("getImageFilesFromDirectory", () => {
  it("should return all image files in directory", () => {
    const testDir = path.join(__dirname, "fixtures", "test_images");
    fs.mkdirSync(testDir, { recursive: true });

    // Create test files
    fs.writeFileSync(path.join(testDir, "image1.jpg"), "");
    fs.writeFileSync(path.join(testDir, "image2.png"), "");
    fs.writeFileSync(path.join(testDir, "image3.webp"), "");

    try {
      const files = getImageFilesFromDirectory(testDir);
      expect(files.length).toBe(3);
      expect(files.map(f => path.basename(f)).sort()).toEqual([
        "image1.jpg",
        "image2.png",
        "image3.webp",
      ]);
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("should filter by supported formats only", () => {
    const testDir = path.join(__dirname, "fixtures", "test_images2");
    fs.mkdirSync(testDir, { recursive: true });

    // Create test files - only image formats should be returned
    fs.writeFileSync(path.join(testDir, "image1.jpg"), "");
    fs.writeFileSync(path.join(testDir, "image2.png"), "");
    fs.writeFileSync(path.join(testDir, "document.txt"), "");
    fs.writeFileSync(path.join(testDir, "archive.zip"), "");

    try {
      const files = getImageFilesFromDirectory(testDir);
      expect(files.length).toBe(2);
      expect(files.map(f => path.basename(f)).sort()).toEqual([
        "image1.jpg",
        "image2.png",
      ]);
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it("should return empty array for non-existent directory", () => {
    const files = getImageFilesFromDirectory("/non/existent/directory");
    expect(files).toEqual([]);
  });

  it("should not include subdirectories", () => {
    const testDir = path.join(__dirname, "fixtures", "test_images3");
    const subDir = path.join(testDir, "subdir");
    fs.mkdirSync(subDir, { recursive: true });

    fs.writeFileSync(path.join(testDir, "image1.jpg"), "");
    fs.writeFileSync(path.join(subDir, "image2.png"), "");

    try {
      const files = getImageFilesFromDirectory(testDir);
      expect(files.length).toBe(1);
      expect(files[0]).toBe(path.join(testDir, "image1.jpg"));
    } finally {
      fs.rmSync(testDir, { recursive: true });
    }
  });
});

describe("ensureDirectoryExists", () => {
  it("should create directory recursively", async () => {
    const testDir = path.join(
      __dirname,
      "fixtures",
      "test_ensure",
      "nested",
      "deep",
    );

    // Make sure it doesn't exist
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }

    await ensureDirectoryExists(testDir);

    expect(fs.existsSync(testDir)).toBe(true);

    // Cleanup
    fs.rmSync(path.join(__dirname, "fixtures", "test_ensure"), {
      recursive: true,
    });
  });

  it("should do nothing if directory exists", async () => {
    const testDir = path.join(__dirname, "fixtures", "test_ensure2");
    fs.mkdirSync(testDir, { recursive: true });

    const originalStat = fs.statSync(testDir);

    await ensureDirectoryExists(testDir);

    const newStat = fs.statSync(testDir);
    expect(newStat.ino).toBe(originalStat.ino);

    // Cleanup
    fs.rmdirSync(testDir);
  });
});
