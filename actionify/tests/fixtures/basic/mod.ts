import { commands, defineWorkflows, e } from "../../../mod.ts";
import { Workflow } from "../../../mod.ts";
import { HostedRunner } from "../../../types.ts";

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
  .job(
    "a",
    (job) => {
      return job
        .name("A")
        .outputs((ctx) => ({ action: e.expr(ctx.env.GITHUB_ACTION) }));
    },
  )
  .job(
    "b",
    (job) => {
      return job
        .name("B")
        .outputs((ctx) => ({ ci: e.expr(ctx.env.CI) }));
    },
  )
  .job("c", (job) => {
    const result = job
      .needs("a")
      .name((ctx) => {
        return e.expr(ctx.needs.a.outputs.action);
      }).services({
        nginx: { image: "nginx", ports: ["8080:80"] },
        redis: { image: "redis", ports: ["6379/tcp"] },
      })
      .strategy({
        matrix: {
          os: [
            HostedRunner.UbuntuLatest,
            HostedRunner.MacOSLatest,
            HostedRunner.WindowsLatest,
          ],
          node: [16, 17, 18],
          exclude: [{ os: HostedRunner.UbuntuLatest, node: 16 }, { yo: true }],
          include: [{ a: 100 }],
        },
      })
      .name((ctx) => {
        return e.expr(ctx.job.services.nginx.id);
      })
      .name((ctx) => e.expr(ctx.matrix.os))
      .step((step) =>
        step
          .id("step1")
          .name("Step 1")
          .run(commands.setOutput("value", "custom"))
      );

    return result;
  })
  .env((ctx) => ({ YO: e.expr(ctx.github.workspace) }));

const rootDirectory = import.meta.resolve("./tmp/workflows");
console.log({ rootDirectory });
export default defineWorkflows({
  rootDirectory,
  workflows: [ciWorkflow],
});
