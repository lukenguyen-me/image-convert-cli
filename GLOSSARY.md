# image-convert-cli

A command-line tool that converts image files, singly or a whole directory at a time, into a chosen output format.

## Language

### Formats

**Output Format**:
An image format the tool can write, such as WebP, JPEG, PNG or ICO. Each has one canonical name and may have Format Aliases.
_Avoid_: target format, supported format

**Input Format**:
An image format the tool can read, such as JPEG, PNG, WebP, GIF, TIFF, AVIF, SVG or HEIC. Some are Input Formats only (GIF, TIFF, AVIF, SVG, HEIC), and some are Output Formats only (ICO).
_Avoid_: source format

**Format Alias**:
Another spelling for the same format, such as `jpg` for JPEG. An alias picks the output file's extension but never changes how the file is encoded.
_Avoid_: variant

**Compress**:
The user's request for a smaller output file. What it means in practice differs per Output Format, and some Output Formats ignore it. Never on unless the user asks for it.
_Avoid_: optimise, minify

### Runs

**Conversion**:
Turning one source file into one output file in an Output Format. A Conversion either runs or is skipped, and a skipped Conversion always says why.
_Avoid_: job, task, item

**Conversion Plan**:
Every Conversion in one run, each with its output path and whether it will run or be skipped, all worked out before any file is written. A single-file run is a Conversion Plan with one Conversion.
_Avoid_: batch settings, job list

**Batch**:
A run whose source is a directory. Its Conversion Plan covers every file in that directory whose Input Format the tool can read. Files of the same Output Format are skipped, and output names that would collide get disambiguated.
_Avoid_: bulk mode, directory mode

**Unattended Run**:
A run that never prompts. Any setting the user didn't supply takes its default; any setting that has no default makes the run fail.
_Avoid_: yes mode, non-interactive mode, silent mode
