# Changelog

## Unreleased

> [Compare](https://github.com/ifiokjr/actionify/compare/0.2.0...HEAD)

### Breaking 💥

- Deprecate `job().step()` in favour of `job().steps()`
- `job.steps()` now takes a spread of jobs as arguments rather than an array.

  ```ts
  import { job } from 'https://deno.land/x/actionify@0.3.0/mod.ts';

  const newApiJob = job()
    .runsOn('ubuntu-latest')
    // Multiple steps can be added as arguments
    .steps(
      step().run('echo "Hello World"'),
      step().run('echo "The job was automatically triggered by a ${{ github.event_name }} event."'),
      step().run('echo "This job is now running on a ${{ runner.os }} server hosted by GitHub!"'),
      step().run('echo "The name of your branch is ${{ github.ref }} and your repository is ${{ github.repository }}."'),
      step().name('Check out the repository code').uses('actions/checkout@v3'),
      step().run('echo "The ${{ github.repository }} repository has been cloned to the runner."'),
      step().run('echo "The workflow is now ready to test your code on the runner."'),
      step().name('List files in your repository').run('ls -a'),
      step().run((ctx) => `echo "This job's status is ${{ job.status }}."`),
    );
  ```

### Features 🎉

- When no version is supplied to `https://act.deno.dev/:org/:repo` auto redirect to the latest version.

### Bug Fixes

- Allow hyphens (`-`) in `https://act.deno.dev/:org/:repo` org and repo segment of deployment URLs. This was causing repositories like https://act.deno.dev/actions/setup-node to fail.

## 0.2.0

> [2022-09-15](https://github.com/ifiokjr/actionify/compare/0.1.0...0.2.0)

### 🎉 Features

- BREAKING! rename commands to align with `octokit` command names.
  - `setMask` -> `setSecret`
  - `setEnv` -> `exportVariable`
  - `setError` -> `error`
  - `setNotice` -> `notice`
  - `setWarning` -> `warning`

- Add a remote actions server to allow importing fully typed actions from `https://act.deno.dev`.

  ```ts
  import checkout from "https://act.deno.dev/actions/checkout@3.0.2";
  import {
    defineWorkflows,
    e,
    workflow,
  } from "https://deno.land/x/actionify@0.1.0/mod.ts";

  const checkoutStep = checkout((ctx) => ({
    repository: e.wrap(ctx.github.repository),
    ref: e.wrap(ctx.github.ref),
    token: e.wrap(ctx.github.token),
    lfs: true,
  })).env((ctx) => ({
    GITHUB_TOKEN: e.wrap(ctx.secrets.GITHUB_TOKEN),
  }));

  const ci = workflow({ name: "ci" })
    .on("push")
    .job("Explore-GitHub-Actions", (job) => job.step(checkoutStep));

  export default defineWorkflows({
    workflows: [ci],
  });
  ```

### 🐛 Bug Fixes

- Remove `@octokit/core` dependency which was adding `9mb` to the bundle size. Now only import types.

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
