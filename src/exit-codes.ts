/**
 * The exit codes `imgc` returns. Scripts depend on these, so they never change meaning.
 */
export const ExitCode = {
  /** Every Conversion ran or was skipped (or a non-conversion command succeeded). */
  Success: 0,
  /** Any Conversion failed, in a single-file run or a Batch. */
  ConversionFailed: 1,
  /** The command line was wrong: an unknown flag, a missing value, a missing setting. */
  UsageError: 2,
  /** The user declined a confirmation or pressed Ctrl-C at a prompt (128 + SIGINT). */
  Cancelled: 130,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
