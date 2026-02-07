import { expect, describe, it } from "bun:test";
import { getDefaultDestinationPath } from "../../src/utils/path";

describe("getDefaultDestinationPath", () => {
  it("should replace extension with webp", () => {
    const result = getDefaultDestinationPath("/path/to/image.jpg", "webp");
    expect(result).toBe("/path/to/image.webp");
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
