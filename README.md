# image-convert-cli

> A fast, interactive CLI tool for converting images between WebP, JPEG, JPG PNG, and ICO formats

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

### Interactive Mode

Just run without arguments:

```bash
imgc
```

### Non-Interactive Mode

Pass all options via flags:

```bash
imgc -s photo.png -f webp -d photo.webp -c
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help message |
| `--source <path>` | `-s` | Source image file path |
| `--format <format>` | `-f` | Target format: webp, jpeg, or jpg |
| `--dest <path>` | `-d` | Output file path |
| `--compress` | `-c` | Enable compression |
| `--yes` | `-y` | Skip all confirmations (use defaults) |

## Examples

### Convert PNG to WebP

```bash
imgc -s input.png -f webp -d output.webp
```

### Quick lossless conversion

```bash
imgc -s image.png -f webp
```

### Convert with compression

```bash
imgc -s photo.jpg -f webp -c
```

## Quality Settings

- **Default**: 100% quality, lossless
- **With --compress**: Format-specific optimization (WebP lossless, mozjpeg for JPEG/JPG)

| Format | Options |
|--------|---------|
| WebP   | 100% quality + lossless encoding |
| JPEG   | 100% quality + mozjpeg optimization |
| JPG    | 100% quality + mozjpeg optimization |

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
bin/index.ts          # CLI entry point, argument parsing
src/
├── cli.ts            # Core CLI orchestration
├── converter.ts      # Image conversion using Sharp
├── prompts.ts        # Interactive prompt services
├── types.ts          # TypeScript type definitions
└── utils/
    ├── path.ts       # Path utilities
    └── format.ts     # Formatting utilities
tests/                # Unit tests
```

## Available Commands

| Command | Description |
|---------|-------------|
| `bun start` | Run CLI in interactive mode |
| `bun test` | Run all unit tests |
| `bun bin/index.ts --help` | Show CLI help |

## Key Concepts

### Dependency Injection

The CLI accepts a `promptService` parameter for testability:

```typescript
import { runCli } from "./cli";
await runCli(options, mockPromptService);
```

### Result Objects

Conversions return structured `ConversionResult` objects instead of throwing:

```typescript
interface ConversionResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  originalSize: number;
  convertedSize: number;
  format: string;
  error?: string;
}
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
