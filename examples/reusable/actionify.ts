import {
  commands,
  defineWorkflows,
  e,
  workflow,
} from "https://deno.land/x/actionify@0.3.0/mod.ts";

// This example is taken from
// https://docs.github.com/en/actions/using-workflows/reusing-workflows#using-inputs-and-secrets-in-a-reusable-workflow

// 1. First create the reusable workflow.
const reusable = workflow({ name: "A reusable workflow", fileName: "reusable" })
  // 2. Add the job before the event so that the types of the output can be used
  //    later on.
  .job("exampleJob", (job) => {
    return job
      .name("Generate Output For Workflow")
      .runsOn("ubuntu-latest")
      .step((step) => {
        return step
          .id("step1")
          .run(commands.setOutput("firstWord", "hello"));
      })
      .step((step) => {
        return step
          .id("step2")
          .run(commands.setOutput("secondWord", "hello"));
      })
      // 3. Set the outputs for this job which will be used in the
      //    `workflow_call` event and can be consumed by external workflows.
      .outputs((ctx) => ({
        output1: e.expr(ctx.steps.step1.outputs.firstWord),
        output2: e.expr(ctx.steps.step2.outputs.secondWord),
      }));
  })
  // 4. Add the workflow call event and setup up the inputs, secrets and
  //    outputs. The `inputs` and `secrets` will respect the `required` property
  //    in the caller. If any required properties (without a default) are
  //    missing then there will be type error.
  .on("workflow_call", (ctx) => ({
    inputs: {
      username: { required: true, type: "string" },
      password: { required: true, type: "string" },
      optional: { type: "number" },
    },
    secrets: {
      envPAT: { required: true },
      hush: { description: "Not required" },
    },
    outputs: {
      firstWord: {
        description: "The first output string",
        value: e.expr(ctx.jobs.exampleJob.outputs.output1),
      },
      secondWord: {
        description: "The first output string",
        value: e.expr(ctx.jobs.exampleJob.outputs.output2),
      },
    },
  }));

// 5. Create the caller workflow which will consume the reusable workflow.
const caller = workflow({
  name: "Call a reusable workflow",
  fileName: "caller",
})
  .on("pull_request", { branches: ["main"] })
  .job("callWorkflow", (job) => {
    return job
      .name("Call the reusable workflow")
      // 6. Set the workflow the job uses to the the previously defined `reusable`
      //    workflow to automatically infer the types.
      .uses(reusable)
      // 7. Only pass the required secrets into the workflow. To pass all
      //    secrets you can set the value to `inherit`.
      .secrets({ envPAT: "amazing" })
      // 8. Pass the inputs into the called workflow.
      .with({ username: "me", password: "secure" });
  })
  .job("useCalledWorkflowOutputs", (job) => {
    return job
      .runsOn("ubuntu-latest")
      .name("Use the outputs from previous reusable workflow")
      .needs("callWorkflow")
      .step((step) => {
        return step
          .run((ctx) => {
            return commands.debug(
              e.concat(
                ctx.needs.callWorkflow.outputs.firstWord,
                " ",
                ctx.needs.callWorkflow.outputs.firstWord,
              ),
            );
          });
      });
  });

export default defineWorkflows({
  workflows: [reusable, caller],
  rootDirectory: import.meta.resolve("./"),
});
