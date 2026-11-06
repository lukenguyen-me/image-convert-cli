import { expect, describe, it } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { main } from "../src/cli";
import { ScriptedTerminal } from "../src/scripted-terminal";
import { InMemoryUpdater } from "../src/updater";

const readme = fs.readFileSync(path.join(import.meta.dir, "..", "README.md"), "utf8");

async function helpText(): Promise<string> {
  const terminal = new ScriptedTerminal();
  await main(["--help"], terminal, new InMemoryUpdater());
  return terminal.stdout;
}

describe("README", () => {
  it("its Options table lists exactly the flags in `imgc --help`, with the same short forms", async () => {
    const help = await helpText();
    const helpFlags = [...help.matchAll(/^ {2}(--[a-z]+)(?:, (-[a-z]))?/gm)].map(([, long, short]) => [long, short ?? ""]);
    const readmeFlags = [...readme.matchAll(/^\| `(--[a-z]+)[^`]*` \| (?:`(-[a-z])`)? *\|/gm)].map(([, long, short]) => [
      long,
      short ?? "",
    ]);

    expect(readmeFlags).toEqual(helpFlags);
  });

  it("shows every example from `imgc --help`", async () => {
    const help = await helpText();
    const examples = help
      .slice(help.indexOf("Examples:"))
      .split("\n")
      .slice(1)
      .map((line) => line.replace(/#.*/, "").trim())
      .filter(Boolean);

    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      expect(readme).toContain(example);
    }
  });
});
