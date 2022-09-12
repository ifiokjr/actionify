import { isEmpty, isFunction, kebabCase } from "./deps/just.ts";
import type { StringKeyOf } from "./deps/types.ts";
import {
  context,
  Contextify,
  ExpressionValue,
  WithContext,
} from "./expressions.ts";
import { AnyJob, ConcurrentOptions, Job } from "./job.ts";
import type {
  ActionData,
  ActionTemplate,
  CombineAsUnion,
  DefaultsProp,
  EnvProps,
  GetEventOptions,
  GetTemplate,
  HasActionTemplate,
  InputKeys,
  JobOutputKey,
  SetPermissions,
  WithJob,
  WorkflowCallOptions,
  WorkflowDispatchOptions,
  WorkflowEvents,
  WorkflowRunOptions,
} from "./types.ts";
import { getFromContext } from "./utils.ts";

/**
 * Create a workflow.
 */
export function workflow<Base extends ActionTemplate = {}>(
  props: CreateWorkflowProps,
): Workflow<Base> {
  return Workflow.create(props);
}

interface CreateWorkflowProps {
  name: string;
  /**
   * A custom filename without the extension. Convention suggests using
   * lowercase names.
   */
  fileName?: string;
}

/**
 * A workflow is a configurable automated process made up of one or more jobs.
 * This class creates a YAML file to define your workflow configuration.
 */
export class Workflow<Base extends ActionTemplate = ActionTemplate>
  implements HasActionTemplate<Base> {
  /**
   * Check if provided value is a workflow instance.
   */
  static is(value: unknown): value is Workflow {
    return value instanceof this;
  }

  static create<Base extends ActionTemplate = {}>(
    props: CreateWorkflowProps,
  ): Workflow<Base> {
    return new Workflow(props);
  }

  /**
   * Use this to create an untyped version of the workflow which might make
   * reuse simpler.
   */
  static untyped<Base extends ActionTemplate = ActionTemplate>(
    props: CreateWorkflowProps,
  ) {
    return new this<Base>(props);
  }

  declare zBase$: Base;
  readonly name: string;
  readonly fileName: string;

  #on = Object.create(null);
  #permissions?: SetPermissions | undefined;
  #env: Record<string, ExpressionValue<string>> | undefined;
  #defaults: DefaultsProp | undefined;
  #concurrency?: ConcurrentOptions | undefined;
  #jobs: Record<string, AnyJob> = Object.create(null);

  private constructor(props: CreateWorkflowProps) {
    const { name, fileName = kebabCase(name) } = props;

    this.name = name;
    this.fileName = fileName;
  }

  /**
   * To automatically trigger a workflow, use on to define which events can
   * cause the workflow to run. For a list of available events, see "Events that
   * trigger workflows."
   *
   * You can define single or multiple events that can a trigger workflow, or
   * set a time schedule. You can also restrict the execution of a workflow to
   * only occur for specific files, tags, or branch changes. These options are
   * described in the following sections.
   *
   * #### Using a single event
   *
   * For example, a workflow with the following on value will run when a push is
   * made to any branch in the workflow's repository:
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push');
   * ```
   *
   * #### Using multiple events
   *
   * You can specify a single event or multiple events. For example, a workflow
   * with the following on value will run when a push is made to any branch in
   * the repository or when someone forks the repository:
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .on('fork');
   * ```
   *
   * If you specify multiple events, only one of those events needs to occur to
   * trigger your workflow. If multiple triggering events for your workflow
   * occur at the same time, multiple workflow runs will be triggered.
   *
   * #### Using activity types
   *
   * Some events have activity types that give you more control over when your workflow should run. Use on.<event_name>.types to define the type of event activity that will trigger a workflow run.
   *
   * For example, the issue_comment event has the created, edited, and deleted activity types. If your workflow triggers on the label event, it will run whenever a label is created, edited, or deleted. If you specify the created activity type for the label event, your workflow will run when a label is created but not when a label is edited or deleted.
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .on('label', { types: ['created'] });
   * ```
   *
   * If you specify multiple activity types, only one of those event activity types needs to occur to trigger your workflow. If multiple triggering event activity types for your workflow occur at the same time, multiple workflow runs will be triggered. For example, the following workflow triggers when an issue is opened or labeled. If an issue with two labels is opened, three workflow runs will start: one for the issue opened event and two for the two issue labeled events.
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .on('pull_request', { types: ['opened', 'labeled'] });
   * ```
   *
   * For more information about each event and their activity types, see "Events that trigger workflows."
   */
  // @ts-expect-error This type would be very difficult to infer due to the
  // builder pattern.
  on<Options extends WorkflowDispatchOptions>(
    event: "workflow_dispatch",
    options: WithContext<Options, Base>,
  ): Workflow<
    CombineAsUnion<
      | Base
      | { events: "workflow_dispatch" }
      | InputKeys<NonNullable<Options["inputs"]>>
    >
  >;
  on<Options extends WorkflowCallOptions>(
    event: "workflow_call",
    options: WithContext<Options, Base>,
  ): Workflow<
    CombineAsUnion<
      | Base
      | { events: "workflow_call"; secrets: StringKeyOf<Options["secrets"]> }
      | InputKeys<NonNullable<Options["inputs"]>>
    >
  >;
  on<
    Event extends keyof Exclude<
      WorkflowEvents,
      "workflow_dispatch" | "workflow_call"
    >,
  >(
    event: Event,
    ...[options]: GetEventOptions<Event, Base | { events: Event }>
  ): Workflow<CombineAsUnion<Base | { events: Event }>>;
  on(event: string, options: object | undefined) {
    const optionsObject = getFromContext(options);
    if (event === "workflow_run") {
      const opts = optionsObject as WorkflowRunOptions;
      opts.workflows = opts.workflows.map((workflow) =>
        Workflow.is(workflow) ? workflow.name : workflow
      );

      this.#on[event] = opts;
    } else {
      this.#on[event] = optionsObject ? optionsObject : null;
    }

    return this;
  }

  /**
   * You can use permissions to modify the default permissions granted to the
   * GITHUB_TOKEN, adding or removing access as required, so that you only allow
   * the minimum required access. For more information, see "Authentication in a
   * workflow."
   *
   * You can use permissions either as a top-level key, to apply to all jobs in
   * the workflow, or within specific jobs. When you add the permissions key
   * within a specific job, all actions and run commands within that job that
   * use the GITHUB_TOKEN gain the access rights you specify. For more
   * information, see jobs.<job_id>.permissions.
   *
   * Each property can have a value of `read`, `write` or `none`.
   *
   * If you specify the access for any of these scopes, all of those that are not specified are set to none.
   *
   * You can use the following syntax to define read or write access for all of the available scopes:
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .permissions('write-all') // => `read-all` for read access
   * ```
   *
   * To disable permissions for all available scopes use the following:
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .permissions(false)
   * ```
   */
  permissions(permissions: SetPermissions | false) {
    if (permissions === false) {
      this.#permissions = undefined;
    } else {
      this.#permissions = permissions;
    }

    return this;
  }

  /**
   * A map of environment variables that are available to the steps of all jobs
   * in the workflow. You can also set environment variables that are only
   * available to the steps of a single job or to a single step. For more
   * information, see jobs.<job_id>.env and jobs.<job_id>.steps[*].env.
   *
   * Variables in the env map cannot be defined in terms of other variables in
   * the map.
   *
   * When more than one environment variable is defined with the same name,
   * GitHub uses the most specific environment variable. For example, an
   * environment variable defined in a step will override job and workflow
   * variables with the same name, while the step executes. A variable defined
   * for a job will override a workflow variable with the same name, while the
   * job executes.
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .env({ SERVER: 'production' });
   * ```
   */
  env<Env extends EnvProps>(
    env: WithContext<Env, Base>,
  ): Workflow<CombineAsUnion<Base | { env: StringKeyOf<Env> }>> {
    this.#env = getFromContext(env);
    // @ts-expect-error This type would be very difficult to infer due to the
    // builder pattern.
    return this;
  }

  /**
   * Use `defaults` to create a `map` of default settings that will apply to all
   * jobs in the workflow. You can also set default settings that are only
   * available to a job. For more
   * information,see [`jobs.<job_id>.defaults`](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_iddefaults).
   *
   * When more than one default setting is defined with the same name, GitHub
   * uses the most specific default setting. For example, a default setting
   * defined in a job will override a default setting that has the same name
   * defined in a workflow.
   *
   * ### `defaults.run`
   *
   * You can use defaults.run to provide default shell and working-directory options for all run steps in a workflow. You can also set default settings for run that are only available to a job. For more information, see jobs.<job_id>.defaults.run. You cannot use contexts or expressions in this keyword.
   *
   * When more than one default setting is defined with the same name, GitHub uses the most specific default setting. For example, a default setting defined in a job will override a default setting that has the same name defined in a workflow.
   *
   * ##### Set the default shell and working directory
   *
   * ```ts
   * import { Workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .defaults({ run: { shell: 'bash', 'working-directory': 'scripts' }})
   * ```
   */
  defaults(props: DefaultsProp) {
    this.#defaults = getFromContext(props);
    return this;
  }

  /**
   * Use concurrency to ensure that only a single job or workflow using the same
   * concurrency group will run at a time. A concurrency group can be any string
   * or expression. The expression can only use the github context. For more
   * information about expressions, see "Expressions."
   *
   * You can also specify concurrency at the job level. For more information,
   * see jobs.<job_id>.concurrency.
   *
   * When a concurrent job or workflow is queued, if another job or workflow
   * using the same concurrency group in the repository is in progress, the
   * queued job or workflow will be pending. Any previously pending job or
   * workflow in the concurrency group will be canceled. To also cancel any
   * currently running job or workflow in the same concurrency group, specify
   * cancel-in-progress: true.
   *
   * ##### Using concurrency and the default behavior
   *
   * ```ts
   * import { Workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .concurrency(ctx => e.concat('ci-', ctx.github.ref)); // => `${{ join(['ci-', github.ref], '') }}`
   * ```
   *
   * ##### Using concurrency to cancel any in-progress job or run
   *
   * ```ts
   * import { Workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .concurrency(ctx => ({
   *     group: e.expr(ctx.github.ref),
   *     'cancel-in-progress': true,
   *   }));
   * ```
   *
   * ##### Using a fallback value
   *
   * If you build the group name with a property that is only defined for
   * specific events, you can use a fallback value. For example, github.head_ref
   * is only defined on pull_request events. If your workflow responds to other
   * events in addition to pull_request events, you will need to provide a
   * fallback to avoid a syntax error. The following concurrency group cancels
   * in-progress jobs or runs on pull_request events only; if github.head_ref is
   * undefined, the concurrency group will fallback to the run ID, which is
   * guaranteed to be both unique and defined for the run.
   *
   * ```ts
   * import { Workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .concurrency(ctx => ({
   *     group: e.op(ctx.github.ref, '||', ctx.github.run_id),
   *     'cancel-in-progress': true,
   *   }));
   * ```
   *
   * ##### Only cancel in-progress jobs or runs for the current workflow
   *
   * If you have multiple workflows in the same repository, concurrency group
   * names must be unique across workflows to avoid canceling in-progress jobs
   * or runs from other workflows. Otherwise, any previously in-progress or
   * pending job will be canceled, regardless of the workflow.
   *
   * To only cancel in-progress runs of the same workflow, you can use the
   * github.workflow property to build the concurrency group:
   *
   * ```ts
   * import { Workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: 'ci' })
   *   .on('push')
   *   .concurrency(ctx => ({
   *     group: e.op(ctx.github.ref, '||', ctx.github.run_id),
   *     'cancel-in-progress': true,
   *   }));
   * ```
   */
  concurrency(options: WithContext<ConcurrentOptions, Base>) {
    this.#concurrency = getFromContext(options);
    return this;
  }

  job<
    Id extends string,
    OutputJob extends AnyJob,
  >(
    id: Id,
    job: JobCreator<Base, OutputJob>,
  ): Workflow<
    CombineAsUnion<
      Base | { jobs: Id } | JobOutputKey<Id, GetJobOutputs<OutputJob>>
    >
  > {
    this.#jobs[id] = isFunction(job) ? job(Job.create(), context()) : job;
    // @ts-expect-error This type would be very difficult to infer due to the
    // builder pattern.
    return this;
  }

  /**
   * Create multiple jobs as an object.
   *
   * The order of keys will be the order they jobs are displayed in the
   * generated action file.
   */
  jobs<Jobs extends Record<string, JobCreator<object, AnyJob>>>(
    jobs: Jobs,
  ): Workflow<CombineAsUnion<Base | GetJobs<Jobs>>> {
    for (const [id, job] of Object.entries(jobs)) {
      this.#jobs[id] = isFunction(job) ? job(Job.create(), context()) : job;
    }

    // @ts-expect-error This type would be very difficult to infer due to the
    // builder pattern.
    return this;
  }

  toJSON() {
    const json = Object.create(null);
    json.name = this.name;

    if (!isEmpty(this.#on)) {
      json.on = this.#on;
    }

    json.permissions = this.#permissions;
    json.env = this.#env;
    json.defaults = this.#defaults;
    json.concurrency = this.#concurrency;

    if (!isEmpty(this.#jobs)) {
      json.jobs = this.#jobs;
    }

    return json;
  }
}

type JobCreator<Base extends ActionTemplate, OutputJob extends AnyJob> =
  | ((job: Job<WithJob<Base>>, ctx: Contextify<ActionData<Base>>) => OutputJob)
  | OutputJob;
type GetJobOutputs<Type extends AnyJob> = unknown extends
  GetTemplate<Type>["jobOutputs"] ? never
  : GetTemplate<Type>["jobOutputs"];

export type AnyWorkflow = Workflow<any>;

type GetJobs<Jobs extends Record<string, JobCreator<object, AnyJob>>> = {
  [Id in StringKeyOf<Jobs>]:
    | { jobs: Id }
    | JobOutputKey<Id, GetJobOutputs<ExtractJob<Jobs[Id]>>>;
}[StringKeyOf<Jobs>];
type ExtractJob<Type extends JobCreator<object, AnyJob>> = Type extends
  JobCreator<object, infer J> ? J : never;
