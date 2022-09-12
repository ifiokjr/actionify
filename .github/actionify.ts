import {
  commands,
  defineWorkflows,
  e,
  job,
  Runner,
  Shell,
  step,
  workflow,
} from "https://deno.land/x/actionify@0.0.0/mod.ts";

const deno = ["v1.24.x", "v1.x", "canary"];
const os = [Runner.MacOSLatest, Runner.UbuntuLatest];
const envStep = step().name("Set environment").run((ctx) =>
  commands.exportVariable("DENO_DIR", e.concat(ctx.runner.temp, "/deno_cache"))
);

const testJob = job()
  .strategy({ matrix: { deno, os } })
  .timeoutMinutes(5)
  .runsOn((ctx) => e.expr(ctx.matrix.os))
  .step(envStep)
  .steps(sharedSteps())
  .step((step) => {
    return step
      .name("🩺 Format")
      .uses("dprint/check@v2.0")
      .if((ctx) => e.eq(ctx.matrix.os, Runner.UbuntuLatest));
  })
  .step((step) => {
    return step
      .name("👩‍⚕️ Lint")
      .if((ctx) => e.eq(ctx.matrix.os, Runner.UbuntuLatest))
      .run("deno lint");
  })
  .step((step) => {
    return step
      .name("🩺 Typecheck")
      .run("deno task typecheck");
  })
  .step((step) => {
    return step
      .name("✅ Unittest")
      .run("deno task test");
  })
  .step((step) => {
    return step
      .name("📝 Docs")
      .run("deno task test:docs");
  });

const publishJob = job<{ jobs: "test" }>()
  .needs("test")
  .timeoutMinutes(5)
  .runsOn(Runner.UbuntuLatest)
  .step(envStep)
  .steps(sharedSteps(false))
  .step((step) => {
    return step
      .name("🦕 Publish")
      .env({ GITHUB_TOKEN: e.expr(e.ctx.secrets.GITHUB_TOKEN) })
      .run("deno task publish");
  });

const ciWorkflow = workflow({ name: "ci" })
  .on("push", { branches: ["main"] })
  .on("pull_request", { branches: ["main"] })
  .job("test", testJob)
  .job("publish", publishJob);

export default defineWorkflows({
  workflows: [ciWorkflow],
  cleanupRoot: true,
});

function sharedSteps(withMatrix = true) {
  return [
    step().name("🏴‍☠️ Checkout").uses("actions/checkout@v3"),
    step<{ matrix: "deno" | "os"; env: "DENO_DIR" }>()
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
    step<{ matrix: "deno" }>()
      .uses("denoland/setup-deno@v1")
      .with((ctx) => ({
        "deno-version": withMatrix ? e.expr(ctx.matrix.deno) : "v1.x",
      })),
    step()
      .name("🔒 Lock")
      .run("deno task lock")
      .shell(Shell.Bash)
      .continueOnError(),
  ] as const;
}
