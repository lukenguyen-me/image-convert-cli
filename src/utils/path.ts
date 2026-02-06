import * as path from "node:path";
import type { SupportedFormat } from "../types";

export function getDefaultDestinationPath(
  sourcePath: string,
  format: SupportedFormat,
): string {
  const parsed = path.parse(sourcePath);
  return path.join(parsed.dir, `${parsed.name}.${format}`);
}
