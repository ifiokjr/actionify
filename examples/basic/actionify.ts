import {
  commands,
  defineWorkflows,
  e,
  Runner,
  Workflow,
} from "https://deno.land/x/actionify@0.2.0/mod.ts";

const ciWorkflow = Workflow
  .create({ name: "ci", fileName: "ci" })
  .on("check_run", {
    types: ["completed", "created", "requested_action", "rerequested"],
  })
  .on("push")
  .on("pull_request", { branches: ["main"] })
  .permissions("read-all")
  .on("schedule", { cron: "" })
  .on("fork")
  .env({ "AWESOME": "true" })
  .defaults({ run: { shell: "bash" } })
  .permissions("write-all")
  .job("a", (job) => {
    return job
      .name("A")
      .runsOn("ubuntu-latest")
      .outputs((ctx) => ({ action: e.expr(ctx.env.GITHUB_ACTION) }))
      .step((step) => step.uses("some/repo"));
  })
  .job("b", (job) => {
    return job
      .name("B")
      .runsOn("ubuntu-latest")
      .outputs((ctx) => ({ ci: e.expr(ctx.env.CI) }))
      .step((step) => step.uses("some/repo"));
  })
  .job("c", (job) => {
    const result = job
      .needs("a")
      .runsOn("ubuntu-latest")
      .name((ctx) => {
        return e.expr(ctx.needs.a.outputs.action);
      }).services({
        nginx: { image: "nginx", ports: ["8080:80"] },
        redis: { image: "redis", ports: ["6379/tcp"] },
      })
      .strategy({
        matrix: {
          os: [
            Runner.UbuntuLatest,
            Runner.MacOSLatest,
            Runner.WindowsLatest,
          ],
          node: [16, 17, 18],
          exclude: [{ os: Runner.UbuntuLatest, node: 16 }, { yo: true }],
          include: [{ a: 100 }],
        },
      })
      .environment((ctx) => ({
        url: e.expr(ctx.job.services.nginx.id),
        name: "some-environment",
      }))
      .step((step) =>
        step
          .id("step1")
          .name("Step 1")
          .run(commands.setOutput("value", "custom"))
      );

    return result;
  })
  .env((ctx) => ({ YO: e.expr(ctx.github.workspace) }));

export default defineWorkflows({
  rootDirectory: import.meta.resolve("./"),
  workflows: [ciWorkflow],
});
