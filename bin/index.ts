#!/usr/bin/env bun

import { runCli, handleUpdate } from "../src/cli";
import type { ConvertOptions, SupportedFormat } from "../src/types";

const args = process.argv.slice(2);
const options: ConvertOptions = {};

// Check for update command (positional argument)
if (args[0] === "update") {
  const autoUpdate = args.includes("--yes") || args.includes("-y");
  await handleUpdate(undefined, undefined, autoUpdate);
  process.exit(0);
}

// Check for version command (positional argument)
if (args[0] === "version") {
  options.version = true;
}

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--help" || arg === "-h") {
    options.help = true;
  } else if (arg === "--version" || arg === "-v") {
    options.version = true;
  } else if (arg === "--yes" || arg === "-y") {
    options.yes = true;
  } else if (arg === "--source" || arg === "-s") {
    options.source = args[++i];
  } else if (arg === "--format" || arg === "-f") {
    const format = args[++i] as SupportedFormat | undefined;
    if (format && ["webp", "jpeg", "jpg", "png", "ico"].includes(format)) {
      options.format = format;
    }
  } else if (arg === "--dest" || arg === "-d") {
    options.destination = args[++i];
  } else if (arg === "--compress" || arg === "-c") {
    options.compress = true;
  }
}

runCli(options);
