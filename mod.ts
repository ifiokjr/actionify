import * as commands from "./src/commands.ts";
import * as expressions from "./src/expressions.ts";

export { defineWorkflows, type DefineWorkflowsProps } from "./src/config.ts";
export { generate } from "./src/generate.ts";
export { type AnyJob, Job } from "./src/job.ts";
export * as Meta from "./src/meta.ts";
export { type AnyStep, Step } from "./src/step.ts";
export { type GetTemplate, Runner, Shell } from "./src/types.ts";
export { type AnyWorkflow, Workflow } from "./src/workflow.ts";

export { commands, commands as c, expressions, expressions as e };
