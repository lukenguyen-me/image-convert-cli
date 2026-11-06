# image-convert-cli

> A fast, interactive CLI tool that converts JPEG, PNG, WebP, GIF, TIFF, AVIF and SVG images to WebP, JPEG, PNG or ICO

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Demo

[![Demo Video](https://github.com/user-attachments/assets/f3df2efc-5db7-4201-9092-1aa309880380)](https://github.com/user-attachments/assets/f3df2efc-5db7-4201-9092-1aa309880380)

## Quick Start

```bash
# Install (any package manager)
npm install -g image-convert-cli  # or pnpm/yarn/bun

# Run
imgc --source photo.png --format webp
```

Or run directly without installing:

```bash
bun bin/index.ts --source photo.png --format webp --dest photo.webp
```

## Installation

### Install via npm/pnpm/yarn/bun

```bash
# npm
npm install -g image-convert-cli

# pnpm
pnpm add -g image-convert-cli

# yarn
yarn global add image-convert-cli

# bun
bun install -g image-convert-cli
```

### From Source

```bash
git clone https://github.com/lukenguyen-me/image-convert-cli
cd image-convert-cli
npm install  # or pnpm/yarn/bun install
npm link     # or equivalent for your package manager
```

## Usage

```
imgc [options]
imgc --source <path> --format <format> [options]
imgc -y --source <path> --format <format> [options]
imgc update [-y]                # Check for updates; -y installs without asking
imgc version                    # Show version
```

### Interactive Mode

Run without arguments and answer the prompts:

```bash
imgc
```

Any flag you pass answers its prompt, so `imgc -s photo.png -f webp -c` asks only for the destination and confirmation.

### Unattended Run

With `-y` the tool never prompts. `--source` and `--format` are required; every other setting takes its default (output next to the source, no compression):

```bash
imgc -y -s photo.png -f webp
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show the help message |
| `--version` | `-v` | Show the version number |
| `--source <path>` | `-s` | Source file, or a directory to convert every image in (required with `-y`). Input Formats: jpeg, jpg, png, webp, gif, tiff, tif, avif, svg |
| `--format <format>` | `-f` | Output Format: webp, jpeg, jpg, png, ico (required with `-y`) |
| `--dest <path>` | `-d` | Output file, or output directory for a directory source (default: next to the source) |
| `--compress` | `-c` | Compress the output (default: off) |
| `--yes` | `-y` | Unattended Run: never prompt; settings not given take their defaults |
| `--overwrite` | | Replace output files that already exist (default: ask, or skip them with `-y`) |

### Commands

| Command | Description |
|---------|-------------|
| `imgc update` | Check npm for the latest version and ask before installing it (`-y` installs without asking) |
| `imgc version` | Show the version number |

### Output names

- The spelling you pass to `--format` picks the extension: `-f jpg` writes `photo.jpg`, `-f jpeg` writes `photo.jpeg`. Any case works, and the extension is lower case: `-f JPG` writes `photo.jpg`. The interactive JPEG choice writes `.jpg`.
- Converting a file to its own format writes `<name>.converted.<ext>` (for example `photo.converted.png`). The tool never writes over the source; a `--dest` equal to the source is an error.
- For a single file, `--dest` names the output file; an existing directory there is an error.
- In a Batch (a directory source), files already in the Output Format are skipped. Sources whose output names would collide keep their extension: `photo.png` and `photo.jpg` become `photo.png.webp` and `photo.jpg.webp`. A Batch output never lands on another source, even with `--overwrite`.
- Names that differ only in case count as the same file, so `photo.PNG` to png writes `photo.converted.png`.

### Existing output files

- Without `--overwrite`, an interactive run asks once: overwrite all, skip them, or cancel.
- Without `--overwrite`, an Unattended Run skips them and reports each one as skipped.
- With `--overwrite`, they are replaced.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success (including runs where files were skipped) |
| 1 | A Conversion failed, or any file in a Batch failed |
| 2 | Usage error: a bad or unknown flag or value, a missing required flag with `-y`, or an unsupported source |
| 130 | Cancelled: you declined a confirmation or pressed Ctrl-C |

## Examples

```bash
imgc                                       # Interactive mode
imgc --help                                # Show help
imgc --version                             # Show version
imgc -y --source photo.png --format webp   # Writes photo.webp next to the source
imgc -y --source photo.jpg --format jpeg --compress
imgc -y -s ./images -f webp -d ./out       # Convert every image in a directory
imgc -y -s ./images -f webp --overwrite    # Replace outputs that already exist
imgc update                                # Check for updates
```

## Quality Settings

Without `--compress` every format is written at its highest quality. What `--compress` changes depends on the Output Format:

| Format | Default | With `--compress` |
|--------|---------|-------------------|
| WebP   | quality 100 | quality 100, lossless |
| JPEG   | quality 100 | quality 100, mozjpeg |
| PNG    | compression level 6 | compression level 9 |
| ICO    | embeds 32x32 and 16x16 | ignored |

---

# Development

> For contributors who want to extend or contribute to the project

## Prerequisites

- [Bun](https://bun.sh/) v1.3 or later (or Node.js v18+ for alternative runtimes)
- Any Node.js compatible package manager (npm, pnpm, yarn, bun)

## Getting Started

```bash
git clone <repo>
cd image-convert-cli
bun install
bun test    # Run tests
bun start   # Run CLI interactively
```

## Project Structure

```
bin/index.ts            # Entry point: wires the real Terminal and Updater, exits
src/
├── cli.ts              # main(): runs a command and returns its exit code
├── command.ts          # Flag table, strict parser, help text, UsageError
├── settings.ts         # Fills in missing settings by prompting or defaults
├── plan.ts             # Conversion Plan: output paths and skip rules
├── converter.ts        # Runs one Conversion and measures it
├── formats.ts          # Output Formats, Input Formats and encode recipes
├── messages.ts         # All user-facing wording
├── exit-codes.ts       # Exit codes 0/1/2/130
├── terminal.ts         # Terminal interface and the interactive implementation
├── scripted-terminal.ts # Terminal test double with queued answers
├── updater.ts          # Updater interface, npm implementation and test double
├── types.ts            # ConversionResult and RunSummary
└── utils/format.ts     # Byte formatting
tests/                  # Tests
```

## Available Commands

| Command | Description |
|---------|-------------|
| `bun start` | Run CLI in interactive mode |
| `bun test` | Run all unit tests |
| `bun bin/index.ts --help` | Show CLI help |

## Key Concepts

Domain terms (Output Format, Conversion, Conversion Plan, Batch, Unattended Run) are defined in [GLOSSARY.md](GLOSSARY.md).

### Testing through `main`

`main(argv, terminal, updater)` returns the exit code instead of exiting, and does all its asking, printing and updating through the `Terminal` and `Updater` it is given. Tests pass a `ScriptedTerminal` (queued answers, recorded output) and an `InMemoryUpdater`:

```typescript
import { main } from "../src/cli";
import { ScriptedTerminal } from "../src/scripted-terminal";
import { InMemoryUpdater } from "../src/updater";

const terminal = new ScriptedTerminal();
const code = await main(["-y", "-s", "photo.png", "-f", "webp"], terminal, new InMemoryUpdater());
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure all tests pass (`bun test`)
5. Submit a Pull Request

## Tech Stack

- **Runtime**: Bun v1.3+
- **Image Processing**: Sharp v0.34+
- **CLI Prompts**: @inquirer/prompts v8.2+
- **Testing**: bun:test

## License

MIT License - see [LICENSE](LICENSE) file

## Acknowledgments

- [Sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- [Bun](https://bun.sh/) - Fast JavaScript runtime
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) - Interactive CLI prompts
