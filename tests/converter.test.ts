import { test, expect, describe, it } from "bun:test";
import { convertImage } from "../src/converter";

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
});
