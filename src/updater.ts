import { spawn } from "node:child_process";
import type { OutputStream } from "./terminal";

export const PACKAGE_NAME = "image-convert-cli";
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

export type InstallOutcome =
  | { status: "installed" }
  | { status: "exited"; exitCode: number | null }
  | { status: "error"; message: string };

/** Passes the installer's own output through to the user. */
export type InstallOutput = (chunk: string | Uint8Array, stream: OutputStream) => void;

/** Looks up and installs published versions of the tool. */
export interface Updater {
  /** The latest published version. Throws if it can't be looked up. */
  latestVersion(): Promise<string>;
  /** Install `version` globally. Never throws; the outcome says what happened. */
  install(version: string, output: InstallOutput): Promise<InstallOutcome>;
}

/** The production Updater: the npm registry and `bun add -g`. */
export class NpmUpdater implements Updater {
  async latestVersion(): Promise<string> {
    const response = await fetch(NPM_REGISTRY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch version: ${response.statusText}`);
    }
    const data = (await response.json()) as { version: string };
    return data.version;
  }

  install(version: string, output: InstallOutput): Promise<InstallOutcome> {
    return new Promise((resolve) => {
      const child = spawn("bun", ["add", "-g", `${PACKAGE_NAME}@${version}`], {
        stdio: ["inherit", "pipe", "pipe"],
      });

      child.stdout?.on("data", (data) => output(data, "stdout"));
      child.stderr?.on("data", (data) => output(data, "stderr"));

      child.on("close", (code) => {
        resolve(code === 0 ? { status: "installed" } : { status: "exited", exitCode: code });
      });

      child.on("error", (error) => {
        resolve({ status: "error", message: error.message });
      });
    });
  }
}

/** An Updater for tests: a fixed latest version, and a record of installs. */
export class InMemoryUpdater implements Updater {
  readonly installed: string[] = [];
  private readonly latest: string | Error;
  private readonly outcome: InstallOutcome;

  constructor(options: { latest?: string | Error; installOutcome?: InstallOutcome } = {}) {
    this.latest = options.latest ?? new Error("InMemoryUpdater: no latest version configured");
    this.outcome = options.installOutcome ?? { status: "installed" };
  }

  async latestVersion(): Promise<string> {
    if (this.latest instanceof Error) {
      throw this.latest;
    }
    return this.latest;
  }

  async install(version: string, _output: InstallOutput): Promise<InstallOutcome> {
    this.installed.push(version);
    return this.outcome;
  }
}
