<p align="center">
  <a href="#">
    <img width="300" height="300" src="./deploy/static/logo.svg" alt="svg logo" title="SVG Logo" />
  </a>
</p>

<br />

<p align="center">
  <h1 align="center">
    actionify
  </h1>
</p>

<br />

<p align="center">
  <em>Create TypeSafe GitHub actions</em>
</p>

<br />

<p align="center">
  <a href="https://github.com/ifiokjr/actionify/actions?query=workflow:ci">
    <img src="https://github.com/ifiokjr/actionify/workflows/ci/badge.svg?branch=main" alt="Continuous integration badge for github actions" title="CI Badge" />
  </a>
</p>

- [actionify](#actionify)
  - [Why?](#why)
  - [Installation](#installation)
    - [1. Install globally](#1-install-globally)
    - [2. Run with `deno`](#2-run-with-deno)
  - [VSCode Setup](#vscode-setup)
  - [Usage](#usage)
    - [With global installation](#with-global-installation)
    - [With `deno run`](#with-deno-run)
  - [Roadmap](#roadmap)
    - [Better error handling](#better-error-handling)
    - [Community feedback on TypeScript API](#community-feedback-on-typescript-api)
    - [Remote Actions](#remote-actions)
    - [Support deno scripting](#support-deno-scripting)
  - [Contributing](#contributing)

<br />

## Why?

Continuous integration (CI) is an essential safety net for any sustainable open source project. GitHub Actions have become the industry standard. One downside is the **yaml** configuration format. `.yml` files can be error-prone and make reuse more difficult.

I decided to create this project after implementing a rust build pipeline for a `rust` / `napi` project which needed to be compiled across multiple architectures. The `.yml` files were complex and hard to maintain. By using this tool I've been able to reduce the complexity massively and allow for much simpler reuse of code.

<br />

## Installation

This project requires a recent [installation](https://deno.land/manual@v1.25.2/getting_started/installation) of `deno` and is tested to run on versions greater than `1.24.x`. It may work on older versions but this is not guaranteed.

There are two ways of running this project:

#### 1. Install globally

```bash
deno install -Af --name actionify https://deno.land/x/actionify@0.3.0/cli.ts
```

After this is run you will be able to run `actionify` from the command line.

```bash
actionify # Autogenerates all the workflows using defaults
actionify --help # Prints the help menu
actionify check # Checks whether workflows are up to date and valid
```

#### 2. Run with `deno`

```bash
deno run -Ar https://deno.land/x/actionify@0.3.0/cli.ts
```

<br />

## VSCode Setup

If you are using `vscode` you can install the [deno extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) which will provide you with syntax highlighting and autocompletion.

Enabling `deno` for the whole project may cause interoperability issues if you are using a default TypeScript setup. The best way to get around this is to create a `.vscode/settings.json` file in the root of your project and add the following:

```json
{
  "deno.enablePaths": [".github/"]
}
```

This restricts `deno` support to the `.github` folder and will fix most of the conflicts. Depending on your TypeScript setup you may also need to **exclude** the `.github` folder via your `tsconfig.json` file.

```jsonc
{
  "compilerOptions": {
    // ...
  },
  "exclude": [".github/**"]
}
```

## Usage

The following setup uses the defaults. These can be customised as documented later in this readme.

The first thing to do is create the file `.github/actionify.ts` file which will contain the configuration for creating all workflow actions. The example will be taken from the GitHub [quickstart guide](https://docs.github.com/en/actions/quickstart#creating-your-first-workflow).

```ts
import {
  defineWorkflows,
  e,
  step,
  workflow,
} from "https://deno.land/x/actionify@0.3.0/mod.ts";

// Create the configuration for the CI workflow.
const ciWorkflow = workflow({ name: "GitHub Actions Demo", fileName: "ci" })
  .on("push")
  // Set the job and it's ID. The ID can be used to access the job context later.
  .job("Explore-GitHub-Actions", (job) => {
    return job.steps(...generateSteps());
  });

// Create the configuration for the CI workflows. When the CLI is run this will be
// used to create the workflows.
export default defineWorkflows({
  workflows: [ciWorkflow],
});

// Create a list of steps which will be used in the job.
function generateSteps() {
  return [
    step().run(
      `echo "🎉 The job was automatically triggered by a ${
        e.wrap(e.ctx.github.event_name)
      } event.`,
    ),
    step().run(
      `echo "🐧 This job is now running on a ${
        e.wrap(e.ctx.runner.os)
      } server hosted by GitHub!"`,
    ),
    step().run(
      `echo "🔎 The name of your branch is ${
        e.wrap(e.ctx.github.ref)
      } and your repository is ${e.wrap(e.ctx.github.repository)}."`,
    ),
    step().name("Check out the repository code").uses("actions/checkout@v3"),
    step().run(
      `echo "💡 The ${
        e.wrap(e.ctx.github.repository)
      } repository has been cloned to the runner."`,
    ),
    step().run(
      'echo "🖥️ The workflow is now ready to test your code on the runner."',
    ),
    step().name("List files in your repository").run([
      `ls ${e.wrap(e.ctx.github.workspace)}`,
    ]),
    step().run((ctx) => {
      return `echo "🍏 This job's status is ${e.wrap(ctx.job.status)}."`;
    }),
  ];
}
```

Once the above example is in place, you can run the following to generate all the workflow files.

#### With global installation

```bash
actionify
```

#### With `deno run`

```bash
deno run -Ar https://deno.land/x/actionify@0.3.0/cli.ts
```

This creates the following file: `.github/workflows/ci.yml`

```yml
# This file was autogenerated with actionify@0.0.0
# To update run:
# deno run -Ar https://deno.land/x/actionify@0.3.0/cli.ts

name: GitHub Actions Demo
'on':
  push: null
jobs:
  Explore-GitHub-Actions:
    steps:
      - run: echo "🎉 The job was automatically triggered by a ${{ github.event_name }} event.
      - run: echo "🐧 This job is now running on a ${{ runner.os }} server hosted by GitHub!"
      - run: >-
          echo "🔎 The name of your branch is ${{ github.ref }} and your repository is ${{
          github.repository }}."
      - name: Check out the repository code
        uses: actions/checkout@v3
      - run: echo "💡 The ${{ github.repository }} repository has been cloned to the runner."
      - run: echo "🖥️ The workflow is now ready to test your code on the runner."
      - name: List files in your repository
        run: ls ${{ github.workspace }}
      - run: echo "🍏 This job's status is ${{ job.status }}."
```

<br />

## Roadmap

### Better error handling

Right now it's possible to create invalid workflow files.

- Users can create a workflow file with no jobs and no events. Both of which are required.
- Users can create a job with no runner (which is required) and no steps.
- Users can create empty steps which also don't fail.

Any of the above will cause the workflow to fail on GitHub.

There are two ways of adding validation.

Validation can be added during:

- workflow generation throw an error when required properties are missing.
- TypeScript: meaning that only valid workflows can be added to `defineWorkflows`, only valid jobs can be added to `Workflow.job` and only valid steps can be added to `Job.steps`.

Ideally both of these would be implemented to prevent workflows from failing on GitHub.

### Community feedback on TypeScript API

It will be important to get community feedback on the TypeScript API. There are a several places that things could be improved, and design choices around making types more strict or making the API more intuitive.

### Remote Actions

The main reason I created this project is to have type-safe control over GitHub actions. Eventually this will also mean that remote actions can be called in a fully type safe way, without ever needing to leave your code editor.

This could be fulfilled via a deno registry deployment allowing for remote actions to be imported and used in a type-safe way.

```ts
import checkout from "https://act.deno.dev/actions/checkout@v3.0.2";
import {
  defineWorkflows,
  e,
  workflow,
} from "https://deno.land/x/actionify@0.3.0/mod.ts";

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

The remote actions will be dynamically generated and cached.

### Support deno scripting

A user should be able to run write a function that runs directly within the function context. The script created would use deno as the runtime.

```ts
import { step } from "https://deno.land/x/actionify@0.3.0/mod.ts";

const scriptStep = step()
  // @ts-expect-error
  .script(async function (...args: number[]) {
    // This runs the script in the context of the step and has access to the deno runtime.
    const result = await Deno.readTextFile(
      new URL(import.meta.resolve("./readme.md")),
    );
    // do something with the result
  }, [1, 2, 3]);
```

<br />

## Contributing

To contribute first update your cache with

```bash
deno task lock
```

This both generates the lockfile and makes sure the same cache is used for all contributors.

To check that all you code is working as expected, run:

```bash
deno task check
```

This will test, lint and check that formatting is correct.

_created with [`scaffold`](https://github.com/ifiokjr/scaffold)_
