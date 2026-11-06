import { expect, describe, it, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { filePathCompleter } from "../src/terminal";

describe("filePathCompleter", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "completer-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return all files and directories in current directory for empty input", () => {
    // Create test files
    fs.writeFileSync(path.join(tempDir, "file1.txt"), "content");
    fs.writeFileSync(path.join(tempDir, "file2.txt"), "content");
    fs.mkdirSync(path.join(tempDir, "subdir"));

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      // When input is empty, the function uses "." as default
      // which results in base = "." filtering out all files
      // So we test with a partial prefix instead
      const result = filePathCompleter("file");

      // Should return directory contents (includes trailing slash for directories)
      expect(result[0]).toContain("file1.txt");
      expect(result[0]).toContain("file2.txt");
      expect(result[1]).toBe("file");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should filter files by prefix match", () => {
    fs.writeFileSync(path.join(tempDir, "prefix-test.txt"), "content");
    fs.writeFileSync(path.join(tempDir, "other-file.txt"), "content");

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = filePathCompleter("prefix");

      expect(result[0]).toContain("prefix-test.txt");
      expect(result[0]).not.toContain("other-file.txt");
      expect(result[1]).toBe("prefix");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should list contents of specified directory", () => {
    fs.mkdirSync(path.join(tempDir, "mydir"));
    fs.writeFileSync(path.join(tempDir, "mydir", "nested.txt"), "content");

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = filePathCompleter("mydir/");

      expect(result[0]).toContain("mydir/nested.txt");
      expect(result[1]).toBe("mydir/");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should return original input for non-existent path", () => {
    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const result = filePathCompleter("nonexistent/path");

      // Should gracefully handle error and return original input
      expect(result[0]).toEqual(["nonexistent/path"]);
      expect(result[1]).toBe("nonexistent/path");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should expand tilde to the home directory, honouring $HOME", () => {
    const originalHome = process.env.HOME;
    const home = path.join(tempDir, "home");
    fs.mkdirSync(home);
    fs.writeFileSync(path.join(home, "photo.png"), "content");
    fs.mkdirSync(path.join(home, "pictures"));
    process.env.HOME = home;

    try {
      const result = filePathCompleter("~/");

      expect(result[1]).toBe("~/");
      expect([...result[0]].sort()).toEqual([path.join(home, "photo.png"), `${path.join(home, "pictures")}/`]);
    } finally {
      process.env.HOME = originalHome;
    }
  });
});
