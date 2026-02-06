#!/usr/bin/env bun

import { convertImage } from "../src/index";

type ConvertOptions = {
  help?: boolean;
  yes?: boolean;
  source?: string;
  format?: string;
  destination?: string;
  compress?: boolean;
};

const args = process.argv.slice(2);
const options: ConvertOptions = {};

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
    options.format = args[++i];
  } else if (arg === "--dest" || arg === "-d") {
    options.destination = args[++i];
  } else if (arg === "--compress" || arg === "-c") {
    options.compress = true;
  }
}

convertImage(options);
