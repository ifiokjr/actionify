import cache from "https://act.deno.dev/0.3.0/actions/cache@v3.0.8";
import checkout from "https://act.deno.dev/0.3.0/actions/checkout@v3.0.2";
import setupDeno from "https://act.deno.dev/0.3.0/denoland/setup-deno@v1.1.0";
import dprint from "https://act.deno.dev/0.3.0/dprint/check@v2.1";
import {
  commands,
  defineWorkflows,
  e,
  job,
  Runner,
  Shell,
  step,
  workflow,
} from "https://deno.land/x/actionify@0.3.0/mod.ts";

const deno = ["v1.24.x", "v1.x", "canary"];
const os = [Runner.MacOSLatest, Runner.UbuntuLatest];
const envStep = step().name("Set environment").run((ctx) =>
  commands.exportVariable("DENO_DIR", e.concat(ctx.runner.temp, "/deno_cache"))
);

const testJob = job()
  .strategy({ matrix: { deno, os } })
  .timeoutMinutes(20)
  .runsOn((ctx) => e.expr(ctx.matrix.os))
  .steps(envStep)
  .steps(...sharedSteps())
  .steps((_, ctx) => {
    return dprint()
      .name("🩺 Format")
      .if(e.eq(ctx.matrix.os, Runner.UbuntuLatest));
  })
  .steps((step) => {
    return step
      .name("👩‍⚕️ Lint")
      .if((ctx) => e.eq(ctx.matrix.os, Runner.UbuntuLatest))
      .run("deno task lint:ts");
  })
  .steps((step) => {
    return step
      .name("👩‍⚕️ Lint Workflows")
      .if((ctx) => e.eq(ctx.matrix.os, Runner.UbuntuLatest))
      .run("deno task lint:workflows");
  })
  .steps((step) => {
    return step
      .name("🩺 Typecheck")
      .if((ctx) => e.eq(ctx.matrix.os, Runner.UbuntuLatest))
      .run("deno task typecheck");
  })
  .steps((step) => {
    return step
      .name("✅ Unittest")
      .run("deno task test");
  })
  .steps((step) => {
    return step
      .name("📝 Docs")
      .if((ctx) => e.eq(ctx.matrix.os, Runner.UbuntuLatest))
      .run("deno task test:docs");
  });

const publishJob = job<{ jobs: "test" }>()
  .needs("test")
  .timeoutMinutes(5)
  .runsOn(Runner.UbuntuLatest)
  .steps(envStep)
  .steps(...sharedSteps(false))
  .steps((step) => {
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
    checkout().name("🏴‍☠️ Checkout"),
    cache<{ matrix: "deno" | "os"; env: "DENO_DIR" }>((ctx) => ({
      path: e.expr(ctx.env.DENO_DIR),
      key: e.concat(
        e.hashFiles("lock.json"),
        "-",
        withMatrix ? ctx.matrix.deno : "v1.x",
        "-",
        withMatrix ? ctx.matrix.os : Runner.UbuntuLatest,
      ),
    })).name("📦 Cache"),
    setupDeno<{ matrix: "deno" }>((ctx) => ({
      "deno-version": withMatrix ? e.expr(ctx.matrix.deno) : "v1.x",
    })),
    step()
      .name("🔒 Lock")
      .run("deno task lock")
      .shell(Shell.Bash)
      .continueOnError(),
  ] as const;
}
