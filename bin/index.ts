#!/usr/bin/env bun

import { runCli, handleUpdate } from "../src/cli";
import type { ConvertOptions } from "../src/types";

const args = process.argv.slice(2);
const options: ConvertOptions = {};

// Check for update command (positional argument)
if (args[0] === "update") {
  await handleUpdate();
  process.exit(0);
}

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--help" || arg === "-h") {
    options.help = true;
  } else if (arg === "--yes" || arg === "-y") {
    options.yes = true;
  } else if (arg === "--source" || arg === "-s") {
    options.source = args[++i];
  } else if (arg === "--format" || arg === "-f") {
    const format = args[++i] as "webp" | "jpeg" | "jpg" | "png" | undefined;
    if (format && ["webp", "jpeg", "jpg", "png"].includes(format)) {
      options.format = format;
    }
  } else if (arg === "--dest" || arg === "-d") {
    options.destination = args[++i];
  } else if (arg === "--compress" || arg === "-c") {
    options.compress = true;
  }
}

runCli(options);
