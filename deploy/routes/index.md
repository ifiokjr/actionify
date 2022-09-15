`actionify` makes maintaining GitHub Actions easier. It is written in TypeScript and runs on deno. Every publicly versioned GitHub action is available here as a remote action.

Below is an example of importing actions to build and format your project.

```ts
import checkout from "https://act.deno.dev/actions/checkout@3.0.2";
import deno from "https://act.deno.dev/denoland/setup-deno@v1.1.0";
import dprint from "https://act.deno.dev/dprint/check@v2.1";
import {
  defineWorkflows,
  workflow,
} from "https://deno.land/x/actionify@0.1.0/mod.ts";

const ci = workflow({ name: "ci" })
  .on("push")
  .job("Explore-GitHub-Actions", (job) => {
    return job
      .runsOn("ubuntu-latest")
      .step(checkout({ lfs: true }))
      .step(deno({ "deno-version": "canary" }))
      .step(dprint());
  });

export default defineWorkflows({ workflows: [ci] });
```
