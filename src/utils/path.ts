import * as path from "node:path";
import * as fs from "node:fs";
import type { SupportedFormat } from "../types";

export function getDefaultDestinationPath(
  sourcePath: string,
  format: SupportedFormat,
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

export function getExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.length > 0 ? ext.slice(1).toLowerCase() : "";
}

export function isSameFormat(sourcePath: string, targetFormat: SupportedFormat): boolean {
  const ext = getExtension(sourcePath);
  if (ext === targetFormat) return true;
  // Handle jpeg/jpg equivalence
  if ((ext === "jpeg" || ext === "jpg") && (targetFormat === "jpeg" || targetFormat === "jpg")) {
    return true;
  }
  return false;
}

const SUPPORTED_FORMATS = ["webp", "jpeg", "jpg", "png"];

export function getImageFilesFromDirectory(dirPath: string): string[] {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(dirPath, entry.name))
      .filter((filePath) => SUPPORTED_FORMATS.includes(getExtension(filePath)));
  } catch {
    return [];
  }
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
