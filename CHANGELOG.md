# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- GIF, TIFF (`.tif`/`.tiff`) and AVIF are accepted as sources, in single-file runs and Batches.
- `--overwrite` replaces output files that already exist.
- An interactive run whose outputs already exist asks once: overwrite all, skip them, or cancel.
- Skipped Conversions are reported with their reason, such as "already WebP" or "<path> already exists"; Batch summaries list them under "Skipped files:".

### Changed
- `-y` no longer turns on Compress for single files. Compress is on only with `-c`.
- An Unattended Run (`-y`) never prompts: without `--dest` it writes next to the source.
- Unattended Runs skip output files that already exist unless `--overwrite` is given. Single-file runs no longer overwrite silently.
- Exit codes: 0 on success, 1 when a Conversion or any file in a Batch fails or `imgc update` can't look up or install the latest version, 2 for a usage error, 130 when you cancel.
- A bad or unknown flag, a bad `--format`, a missing `--source`/`--format` with `-y`, or a source that isn't a known Input Format exits 2 with an error and a pointer to `imgc --help`.
- `imgc update` accepts only `-y`, and `imgc version` accepts no flags: a conversion flag such as `-c` or `--source` there exits 2 instead of being ignored.
- Declining a confirmation or pressing Ctrl-C at a prompt exits 130.
- The interactive JPEG choice writes `.jpg`. On the command line the spelling you type picks the extension: `-f jpg` writes `.jpg`, `-f jpeg` writes `.jpeg`. `--format` accepts any case (`-f JPG` writes `.jpg`).
- In a Batch, sources whose output names would collide keep their extension: `photo.png` and `photo.jpg` become `photo.png.webp` and `photo.jpg.webp`.
- A Batch never writes over one of its own sources, even with `--overwrite`, and skips sources already in the Output Format.
- Converting a file to its own format writes `<name>.converted.<ext>` by default (for example `photo.converted.png`). A `--dest` equal to the source exits 2, and so does a single-file `--dest` that is an existing directory.
- Paths that differ only in case count as the same file, as they do on the default macOS and Windows filesystems: `photo.PNG` to png writes `photo.converted.png`, and `Photo.png` and `photo.jpg` collide in a Batch.
- The Batch confirmation counts only the Conversions that will run.
- `imgc update` asks "Update image-convert-cli <current> → <latest>?" before installing.

### Fixed
- `-c` works: it compresses single files and every file in a Batch, and stops the compression question being asked.
- The "Saved %" line no longer shows NaN when the original file is empty.

## [1.2.0] - 2026-02-13

### Added
- SVG support as input format with automatic resize handling
- Tilde (~) expansion for home directory in file paths
- CHANGELOG for version tracking
- Test coverage script (`bun run test:coverage`)

### Tests
- Unit tests for SVG conversion
- Unit tests for path completion with tilde expansion

## [1.1.6] - 2026-02-13

### Added
- MIT license (LICENSE.md)
- IDE config files to .gitignore

## [1.1.5] - 2025-02-10

### Changed
- Bump version to 1.1.5
- Improve documentation

## [1.1.4] - 2025-02-08

### Changed
- Bump version to 1.1.4

## [1.1.3] - 2025-02-08

### Fixed
- Use dynamic version from package.json

## [1.1.2] - 2025-02-08

### Added
- Auto-update flag and confirmation prompt for self-update
- Batch conversion mode for directories

## [1.1.1] - 2025-02-07

### Added
- Version command to display CLI version

### Changed
- Exclude assets from npm package

## [1.1.0] - 2025-02-07

### Added
- Self-update check command

### Changed
- Demo video and reorganize assets folder

## [1.0.0] - 2025-02-07

### Added
- PNG format support for image conversion
- Prepare project for npm/bun publishing

### Changed
- Enhance README with installation, usage examples, and development guide
