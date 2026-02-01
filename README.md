# image-convert-cli

A fast, interactive command-line tool for converting images between WebP, JPEG, and JPG formats. Built with [Bun](https://bun.sh/) and [Sharp](https://sharp.pixelplumbing.com/) for high-performance image processing.

## Features

- **Interactive CLI** - Guided prompts for easy image conversion
- **Multiple formats** - Convert to WebP, JPEG, or JPG
- **Compression option** - Choose to compress with format-specific optimization
- **100% quality default** - Lossless quality when not compressing
- **Detailed stats** - See file size savings and conversion time
- **Error handling** - Validates inputs and reports issues clearly

## Installation

### Prerequisites

- [Bun](https://bun.sh/) (v1.3.6 or later recommended)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/image-convert-cli.git
cd image-convert-cli

# Install dependencies
bun install

# Make CLI globally available (optional)
bun link
```

## Usage

Run the interactive converter:

```bash
bun start
```

Or if you've linked the CLI:

```bash
imgc
```

### Example Session

```
Image Converter - Convert images to webp, jpeg, or jpg

Source file path: /path/to/image.png
Target format: webp
Destination path: /path/to/image.webp
Do you want to compress the image? No

Conversion settings:
  Source: /path/to/image.png
  Target format: WEBP
  Destination: /path/to/image.webp
  Compression: No
Proceed with conversion? Yes

Converting...
✓ Conversion complete!
  Time: 123ms
  Original size: 2.50 MB
  Output size: 2.48 MB
  Saved: 0.8%

Output saved to: /path/to/image.webp
```

## Quality Settings

- **Default quality**: 100% (lossless, no compression)
- **With compression enabled**:

| Format | Options |
|--------|---------|
| WebP   | 100% quality + lossless encoding |
| JPEG   | 100% quality + mozjpeg optimization |
| JPG    | 100% quality + mozjpeg optimization |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Sharp](https://sharp.pixelplumbing.com/) for high-performance image processing
- [Bun](https://bun.sh/) for the fast JavaScript runtime
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) for interactive CLI prompts
