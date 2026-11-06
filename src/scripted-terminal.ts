import { PromptCancelled, type OutputStream, type Terminal } from "./terminal";
import type { FormatSpelling } from "./formats";

/** Queue this in place of an answer to press Ctrl-C at that question. */
export const CTRL_C = Symbol("Ctrl-C");

export type ScriptedAnswer = string | boolean | typeof CTRL_C;

/**
 * A Terminal for tests: answers come from a queue, output is recorded.
 *
 * - Each question takes the next queued answer, in order. Asking with no answer
 *   left, or getting an answer of the wrong type, throws.
 * - An empty-string answer to a path question takes the offered default,
 *   as pressing Enter does in the interactive Terminal.
 * - A `CTRL_C` answer makes that question reject with `PromptCancelled`.
 * - `asked` lists every question in order; `stdout` and `stderr` hold the output.
 */
export class ScriptedTerminal implements Terminal {
  readonly asked: string[] = [];
  stdout = "";
  stderr = "";
  private readonly answers: ScriptedAnswer[];

  constructor(answers: ScriptedAnswer[] = []) {
    this.answers = [...answers];
  }

  /** Answers queued but never asked for. */
  get unusedAnswers(): ScriptedAnswer[] {
    return [...this.answers];
  }

  async askSourcePath(): Promise<string> {
    return this.nextString("Source file path");
  }

  async askFormat(): Promise<FormatSpelling> {
    return this.nextString("Target format") as FormatSpelling;
  }

  async askDestination(defaultPath: string): Promise<string> {
    return this.nextString(`Destination path (${defaultPath})`) || defaultPath;
  }

  async askOutputDirectory(defaultDir: string): Promise<string> {
    return this.nextString(`Output directory (${defaultDir})`) || defaultDir;
  }

  async confirm(question: string, _defaultAnswer: boolean): Promise<boolean> {
    const answer = this.next(question);
    if (typeof answer !== "boolean") {
      throw new Error(`ScriptedTerminal: expected a yes/no answer for "${question}", got ${JSON.stringify(answer)}`);
    }
    return answer;
  }

  say(text: string): void {
    this.stdout += `${text}\n`;
  }

  error(text: string): void {
    this.stderr += `${text}\n`;
  }

  relay(chunk: string | Uint8Array, stream: OutputStream): void {
    const text = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    if (stream === "stdout") {
      this.stdout += text;
    } else {
      this.stderr += text;
    }
  }

  private next(question: string): ScriptedAnswer {
    this.asked.push(question);
    if (this.answers.length === 0) {
      throw new Error(`ScriptedTerminal: no answer queued for "${question}"`);
    }
    const answer = this.answers.shift()!;
    if (answer === CTRL_C) {
      throw new PromptCancelled();
    }
    return answer;
  }

  private nextString(question: string): string {
    const answer = this.next(question);
    if (typeof answer !== "string") {
      throw new Error(`ScriptedTerminal: expected a text answer for "${question}", got ${JSON.stringify(answer)}`);
    }
    return answer;
  }
}
