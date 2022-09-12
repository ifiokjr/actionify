import {
  defineWorkflows,
  e,
  step,
  workflow,
} from "https://deno.land/x/actionify@0.1.0/mod.ts";

const ciWorkflow = workflow({ name: "GitHub Actions Demo", fileName: "ci" })
  .on("push")
  .job("Explore-GitHub-Actions", (job) => {
    return job.steps(generateSteps());
  });

export default defineWorkflows({
  rootDirectory: import.meta.resolve("./"),
  workflows: [ciWorkflow],
});

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
  ] as const;
}
