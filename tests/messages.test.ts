import { expect, describe, it } from "bun:test";
import { conversionSuccessText } from "../src/messages";

// A zero-byte original can't convert through real sharp, so this case can't be
// reached through the entry point; the result summary is checked directly.
describe("conversionSuccessText", () => {
  it("shows the share of bytes saved", () => {
    const text = conversionSuccessText({
      success: true,
      source: "photo.png",
      output: "photo.webp",
      originalSize: 2000,
      outputSize: 500,
      elapsed: 12,
    });

    expect(text).toContain("  Saved: 75.0%\n");
  });

  it("leaves out \"Saved\" when the original is zero bytes, rather than showing NaN", () => {
    const text = conversionSuccessText({
      success: true,
      source: "empty.svg",
      output: "empty.png",
      originalSize: 0,
      outputSize: 120,
      elapsed: 3,
    });

    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
    expect(text).not.toContain("Saved:");
    expect(text).toContain("  Original size: 0 B\n  Output size: 120 B\n");
  });
});
