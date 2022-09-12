# Changelog

## Unreleased

> [Compare](https://github.com/ifiokjr/actionify/compare/0.1.0...HEAD)

## 0.1.0

> [2022-09-12](https://github.com/ifiokjr/actionify/compare/3d33388...0.1.0)

### 🎉 Features

- This is the initial release of actionify.
- Currently the project is focused on making it easier to create github workflows that are fully typed and easy to reuse.

```bash
Usage:   actionify
Version: 0.1.0

Description:

  Generate reusable GitHub Action workflow files with TypeScript.

Options:

  -h, --help               - Show this help.
  -V, --version            - Show the version number for this program.
  -c, --config   [config]  - The path to the TypeScript configuration file                           (Default: "./.github/actionify.ts")
  -o, --output   [output]  - The path to the folder containing the generated workflow `.yml` files.  (Default: "./.github/workflows")

Commands:

  upgrade                 - Upgrade actionify executable to latest or given version.
  help         [command]  - Show this help or the help of a sub-command.
  completions             - Generate shell completions.
```
