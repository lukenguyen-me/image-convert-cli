import { expect, describe, it } from "bun:test";
import { formatBytes } from "../../src/utils/format";

describe("formatBytes", () => {
  it("should return 0 B for 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("should format bytes correctly", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("should format kilobytes correctly", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 10)).toBe("10 KB");
    expect(formatBytes(1024 * 100)).toBe("100 KB");
  });

  it("should format megabytes correctly", () => {
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB");
    expect(formatBytes(1024 * 1024 * 100)).toBe("100 MB");
  });

  it("should format gigabytes correctly", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe("2.5 GB");
  });

  it("should round to 2 decimal places", () => {
    expect(formatBytes(1337)).toBe("1.31 KB");
    expect(formatBytes(1024 * 1024 + 512 * 1024)).toBe("1.5 MB");
  });
});
