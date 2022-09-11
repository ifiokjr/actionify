import {
  defineWorkflows,
  e,
  Job,
  Runner,
  Shell,
  Step,
  Workflow,
} from "https://deno.land/x/actionify/mod.ts";

function sharedSteps(withMatrix = true) {
  return [
    Step.create().name("🏴‍☠️ Checkout").uses("actions/checkout@v3"),
    Step
      .create<{ matrix: "deno" | "os"; env: "DENO_DIR" }>()
      .name("📦 Cache")
      .uses("actions/cache@v3")
      .with((ctx) => ({
        path: e.expr(ctx.env.DENO_DIR),
        key: e.concat(
          e.hashFiles("lock.json"),
          "-",
          withMatrix ? ctx.matrix.deno : "v1.x",
          "-",
          withMatrix ? ctx.matrix.os : Runner.UbuntuLatest,
        ),
      })),
    Step
      .create<{ matrix: "deno" }>()
      .uses("denoland/setup-deno@v1.0.0")
      .with((ctx) => ({
        "deno-version": withMatrix ? e.expr(ctx.matrix.deno) : "v1.x",
      })),
    Step.create().name("🔒 Lock").run("deno task lock").shell(Shell.Bash),
  ] as const;
}

const deno = ["v1.x", "canary"];
const os = [Runner.MacOSLatest, Runner.UbuntuLatest];

const testJob = Job
  .create()
  .strategy({ matrix: { deno, os } })
  .timeoutMinutes(5)
  .runsOn((ctx) => e.expr(ctx.matrix.os))
  .steps(sharedSteps())
  .step((step) => {
    return step
      .name("🩺 Format")
      .uses("dprint/check@v2.0")
      .if((ctx) => {
        return e.and(
          e.startsWith(ctx.matrix.os, "ubuntu"),
          e.eq(ctx.matrix.deno, "canary"),
        );
      });
  })
  .step((step) => {
    return step
      .name("👩‍⚕️ Lint")
      .if((ctx) => {
        return e.and(
          e.startsWith(ctx.matrix.os, "ubuntu"),
          e.eq(ctx.matrix.deno, "canary"),
        );
      })
      .run("deno lint");
  })
  .step((step) => {
    return step
      .name("🩺 Typecheck")
      .run("deno task typecheck")
      .shell(Shell.Bash);
  })
  .step((step) => {
    return step
      .name("✅ Unittest")
      .run("deno task test")
      .shell(Shell.Bash);
  })
  .step((step) => {
    return step
      .name("📝 Docs")
      .run("deno task test:docs")
      .shell(Shell.Bash);
  });

const publishJob = Job
  .create<{ jobs: "test" }>()
  .needs("test")
  .timeoutMinutes(5)
  .runsOn(Runner.UbuntuLatest)
  .steps(sharedSteps(false))
  .step((step) => {
    return step
      .name("🦕 Publish")
      .env({ GITHUB_TOKEN: e.expr(e.ctx.secrets.GITHUB_TOKEN) })
      .run("deno task publish");
  });

const ciWorkflow = Workflow
  .create({ name: "ci" })
  .on("push", { branches: ["main"] })
  .on("pull_request", { branches: ["main"] })
  .env({ DENO_DIR: e.concat(e.ctx.github.workspace, "../deno_cache") })
  .job("test", testJob)
  .job("publish", publishJob);

export default defineWorkflows({
  workflows: [ciWorkflow],
  cleanupRoot: true,
});
