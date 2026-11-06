#!/usr/bin/env bun

import { main } from "../src/cli";
import { InteractiveTerminal } from "../src/terminal";
import { NpmUpdater } from "../src/updater";

const exitCode = await main(process.argv.slice(2), new InteractiveTerminal(), new NpmUpdater());
process.exit(exitCode);
