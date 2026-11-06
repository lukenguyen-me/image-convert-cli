import * as path from "node:path";
import * as fs from "node:fs";
import { type FormatSpelling, findInputFormat } from "../formats";

export function getDefaultDestinationPath(
  sourcePath: string,
  format: FormatSpelling,
): string {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}.${format}`);
}

export function isDirectory(sourcePath: string): boolean {
  try {
    return fs.statSync(sourcePath).isDirectory();
  } catch {
    return false;
  }
}

export function getImageFilesFromDirectory(dirPath: string): string[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(dirPath, entry.name))
      .filter((filePath) => findInputFormat(filePath) !== undefined);
  } catch {
    return [];
  }
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
