import { isEmpty } from "./deps/just.ts";
import { isFunction } from "./deps/just.ts";
import { StringKeyOf } from "./deps/types.ts";
import { ActionifyError, JobError } from "./errors.ts";
import { Contextify, ExpressionValue } from "./expressions.ts";
import { AnyStep, Step } from "./step.ts";
import type {
  ActionData,
  ActionTemplate,
  CombineAsUnion,
  DefaultsProp,
  EnvProps,
  ExpressionInputData,
  ExpressionSecretData,
  GetTemplate,
  HasActionTemplate,
  Listed,
  LiteralString,
  MatrixKeys,
  PickInputs,
  PickSecrets,
  ReplaceMethods,
  Runner,
  SetPermissions,
  StepOutput,
  StrategyOptions,
  WithContext,
} from "./types.ts";
import { getFromContext } from "./utils.ts";
import type { AnyWorkflow, Workflow } from "./workflow.ts";

/**
 * Create a job which can be added to a workflow.
 */
export function job<Base extends ActionTemplate = {}>(): Job<Base> {
  return Job.create();
}

export class Job<
  Base extends ActionTemplate = ActionTemplate,
> implements HasActionTemplate<Base> {
  static create<Base extends ActionTemplate = {}>(): Job<Base> {
    return new Job();
  }

  /**
   * Create a leniently typed `Job`.
   */
  static untyped() {
    return new Job();
  }

  declare zBase$: Base;
  #name?: ExpressionValue<string> | undefined;
  #permissions: SetPermissions | undefined;
  #needs: Listed<string> | undefined;
  #if: ExpressionValue | undefined;
  #runsOn: ExpressionValue<string | string[]> | undefined;
  #environment: EnvironmentOptions | undefined;
  #concurrency?: ConcurrentOptions | undefined;
  #outputs: Record<string, ExpressionValue<string>> | undefined;
  #env: Record<string, ExpressionValue<string>> | undefined;
  #defaults: DefaultsProp | undefined;
  #timeoutMinutes: ExpressionValue<number> | undefined;
  #strategy: StrategyOptions | undefined;
  #maxParallel: number | undefined;
  #continueOnError: ExpressionValue | undefined;
  #container: ContainerOptions | undefined;
  #services: Record<string, ContainerProps> | undefined;
  #uses: string | undefined;
  #with: object | undefined;
  #secrets: SecretsInput | undefined;
  #steps: AnyStep[] = [];

  private constructor() {}

  /**
   * Use jobs.<job_id>.name to set a name for the job, which is displayed in the
   * GitHub UI.
   */
  name(
    name:
      | WithContext<ExpressionValue<string>, Base, "jobs:jobId:name">
      | undefined,
  ) {
    this.#name = getFromContext(name);
    return this;
  }

  /**
   * For a specific job, you can use jobs.<job_id>.permissions to modify the
   * default permissions granted to the GITHUB_TOKEN, adding or removing access
   * as required, so that you only allow the minimum required access. For more
   * information, see "Authentication in a workflow."
   *
   * By specifying the permission within a job definition, you can configure a
   * different set of permissions for the GITHUB_TOKEN for each job, if
   * required. Alternatively, you can specify the permissions for all jobs in
   * the workflow.
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
   * Use jobs.<job_id>.needs to identify any jobs that must complete
   * successfully before this job will run. It can be a string or array of
   * strings. If a job fails, all jobs that need it are skipped unless the jobs
   * use a conditional expression that causes the job to continue. If a run
   * contains a series of jobs that need each other, a failure applies to all
   * jobs in the dependency chain from the point of failure onwards.
   *
   * #### Requiring successful dependent jobs
   *
   * ```ts
   * import { workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: "ci", fileName: "ci" })
   *   .job('a', (job) => job.name('A'))
   *   .job('b', (job) => job.name('B'))
   *   .job('c', (job) => job.name('C').needs('a'))
   *   .job('d', (job) => job.name('D').needs(["a", "b", "c"]));
   * ```
   */
  needs<Name extends NonNullable<Base["jobs"]>>(
    needs: Listed<Name>,
  ): Job<CombineAsUnion<Base | { needs: Name }>> {
    this.#needs = needs;

    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  /**
   * You can use jobs.<job_id>.outputs to create a map of outputs for a job. Job
   * outputs are available to all downstream jobs that depend on this job. For
   * more information on defining job dependencies, see jobs.<job_id>.needs.
   *
   * Outputs are Unicode strings, and can be a maximum of 1 MB. The total of all
   * outputs in a workflow run can be a maximum of 50 MB.
   *
   * Job outputs containing expressions are evaluated on the runner at the end
   * of each job. Outputs containing secrets are redacted on the runner and not
   * sent to GitHub Actions.
   *
   * To use job outputs in a dependent job, you can use the needs context. For
   * more information, see "Contexts."
   *
   * ```ts
   * import { workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: "ci", fileName: "ci" })
   *   .job('firstJob', (job) => {
   *     return job
   *       .name('A')
   *       .outputs(ctx => {
   *         return { action: e.expr(ctx.env.GITHUB_ACTION) }
   *       })
   *   });
   * ```
   */
  outputs<Options extends DefaultOutputOptions>(
    outputs: WithContext<Options, Base, "jobs:jobId:outputs:outputId">,
  ): Job<CombineAsUnion<Base | { jobOutputs: StringKeyOf<Options> }>> {
    this.#outputs = getFromContext(outputs);
    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  /**
   * You can use the jobs.<job_id>.if conditional to prevent a job from running
   * unless a condition is met. You can use any supported context and expression
   * to create a conditional.
   *
   * When you use expressions in an if conditional, you may omit the expression
   * syntax (${{ }}) because GitHub automatically evaluates the if conditional
   * as an expression. For more information, see "Expressions."
   *
   * Example: Only run job for specific repository This example uses if to
   * control when the production-deploy job can run. It will only run if the
   * repository is named octo-repo-prod and is within the octo-org organization.
   * Otherwise, the job will be marked as skipped.
   *
   * ```ts
   * import { workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: "ci", fileName: "ci" })
   *   .on('push')
   *   .job('productionDeploy', job => {
   *     return job
   *       .if(e.op(e.ctx.github.repository, '==', 'octo-org/octo-repo-prod'))
   *   });
   * ```
   */
  if(statement: WithContext<ExpressionValue, Base, "jobs:jobId:if">) {
    this.#if = getFromContext(statement);
    return this;
  }

  /**
   * Use `.runsOn()` to define the type of machine to run the job on. The
   * machine can be either a GitHub-hosted runner or a self-hosted runner. You
   * can provide runs-on as a single string or as an array of strings. If you
   * specify an array of strings, your workflow will run on a self-hosted runner
   * whose labels match all of the specified runs-on values, if available. If
   * you would like to run your workflow on multiple machines, use
   * `.strategy()`.
   *
   * ```ts
   * import { workflow, Runner } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .job('setup', job => job.runsOn(Runner.UbuntuLatest))
   * ```
   *
   * ### Choosing self-hosted runners
   *
   * To specify a self-hosted runner for your job,
   * configure runs-on in your workflow file with self-hosted runner labels.
   *
   * All self-hosted runners have the self-hosted label. Using only this label
   * will select any self-hosted runner. To select runners that meet certain
   * criteria, such as operating system or architecture, we recommend providing
   * an array of labels that begins with self-hosted (this must be listed first)
   * and then includes additional labels as needed. When you specify an array of
   * labels, jobs will be queued on runners that have all the labels that you
   * specify.
   *
   * Although the self-hosted label is not required, we strongly recommend
   * specifying it when using self-hosted runners to ensure that your job does
   * not unintentionally specify any current or future GitHub-hosted runners.
   *
   * ```ts
   * import { workflow, Runner } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .job('setup', job => job.runsOn(['self-hosted', 'linux']));
   * ```
   */
  runsOn(
    runsOn: WithContext<RunsOnOptions, Base, "jobs:jobId:runsOn">,
  ) {
    this.#runsOn = getFromContext(runsOn);
    return this;
  }

  /**
   * Use .environment to define the environment that the job references. All
   * environment protection rules must pass before a job referencing the
   * environment is sent to a runner. For more information, see "Using
   * environments for deployment."
   *
   * You can provide the environment as only the environment name, or as an
   * environment object with the name and url. The URL maps to environment_url
   * in the deployments API. For more information about the deployments API, see
   * "Deployments."
   *
   * ##### Using a single environment name
   *
   * ```ts
   * import { workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .job('setup', job => job.environment('production'));
   * ```
   *
   * ##### Using environment name and URL
   *
   * ```ts
   * import { workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .job('setup', job => job.environment({
   *      name: 'production',
   *      url: 'https://github.com'
   *    }));
   * ```
   *
   * The URL can be an expression and can use any context except for the secrets
   * context. For more information about expressions, see "Expressions."
   *
   * ##### Using output as URL
   *
   * ```ts
   * import { commands, e, workflow } from "https://deno.land/x/actionify@0.1.0/mod.ts";
   *
   * const ci = workflow({ name: "ci" })
   *   .job("setup", (job) => {
   *     return job
   *       .step((step) => {
   *         return step
   *           .id("step_id")
   *           .run(commands.setOutput("url_output", "value"));
   *       })
   *       .environment((ctx) => ({
   *         name: "production",
   *         url: e.expr(ctx.steps.step_id.outputs.url_output),
   *       }));
   *   });
   *
   * ```
   */
  environment(
    environment: WithContext<
      EnvironmentOptions,
      Base,
      "jobs:jobId:environment" | "jobs:jobId:environment:url"
    >,
  ) {
    this.#environment = getFromContext(environment);
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
   * import { workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .on('push')
   *   .concurrency(ctx => e.concat('ci-', ctx.github.ref));
   * ```
   *
   * ##### Using concurrency to cancel any in-progress job or run
   *
   * ```ts
   * import { workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
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
   * import { workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
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
   * import { workflow, e } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .on('push')
   *   .concurrency(ctx => ({
   *     group: e.op(ctx.github.ref, '||', ctx.github.run_id),
   *     'cancel-in-progress': true,
   *   }));
   * ```
   */
  concurrency(
    options: WithContext<ConcurrentOptions, Base, "jobs:jobId:concurrency">,
  ) {
    this.#concurrency = getFromContext(options);
    return this;
  }

  /**
   * A map of environment variables that are available to the steps of all jobs
   * in the workflow. You can also set environment variables that are only
   * available to the steps of a single job or to a single step. For more
   * information, see jobs.<job_id>.env and jobs.<job_id>.steps[*].env.
   *
   * When more than one environment variable is defined with the same name,
   * GitHub uses the most specific environment variable. For example, an
   * environment variable defined in a step will override job and workflow
   * variables with the same name, while the step executes. A variable defined
   * for a job will override a workflow variable with the same name, while the
   * job executes.
   *
   * ```ts
   * import { workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .job('myJob', job => {
   *     return job.name('My Job').env({ SERVER: 'production' });
   *   });
   * ```
   */
  env<Env extends EnvProps>(
    env: WithContext<Env, Base, "jobs:jobId:env">,
  ): Job<CombineAsUnion<Base | { env: StringKeyOf<Env> }>> {
    this.#env = getFromContext(env);
    // @ts-expect-error The builder pattern makes this difficult to infer
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
   * import { workflow } from "https://deno.land/x/actionify@0.1.0/mod.ts";
   *
   * const ci = workflow({ name: "ci" })
   *   .on("push")
   *   .jobs({
   *     "job1": (job) => {
   *       return job
   *         .defaults({ run: { shell: "bash", "working-directory": "scripts" } });
   *     },
   *   });
   * ```
   */
  defaults(
    defaults: WithContext<DefaultsProp, Base, "jobs:jobId:defaults:run">,
  ) {
    this.#defaults = getFromContext(defaults);
    return this;
  }

  /**
   * The maximum number of minutes to let a job run before GitHub automatically
   * cancels it. Default: 360
   *
   * If the timeout exceeds the job execution time limit for the runner, the job
   * will be canceled when the execution time limit is met instead. For more
   * information about job execution time limits, see "Usage limits and billing"
   * for GitHub-hosted runners and "About self-hosted runners" for self-hosted
   * runner usage limits.
   */
  timeoutMinutes(
    minutes: WithContext<
      ExpressionValue<number>,
      Base,
      "jobs:jobId:timeoutMinutes"
    >,
  ) {
    this.#timeoutMinutes = getFromContext(minutes);
    return this;
  }

  /**
   * Use jobs.<job_id>.strategy to use a matrix strategy for your jobs. A matrix
   * strategy lets you use variables in a single job definition to automatically
   * create multiple job runs that are based on the combinations of the
   * variables. For example, you can use a matrix strategy to test your code in
   * multiple versions of a language or on multiple operating systems. For more
   * information, see "Using a matrix for your jobs."
   */
  strategy<
    Matrix extends Record<LiteralString, readonly unknown[]>,
    Excluded extends Record<LiteralString, unknown>,
    Included extends Record<LiteralString, unknown>,
  >(
    strategy: WithContext<
      StrategyOptions<Matrix, Excluded, Included>,
      Base,
      "jobs:jobId:strategy"
    >,
  ): Job<
    CombineAsUnion<
      Base | MatrixKeys<Matrix, Excluded, Included>
    >
  > {
    this.#strategy = getFromContext(strategy);
    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  /**
   * By default, GitHub will maximize the number of jobs run in parallel
   * depending on runner availability. To set the maximum number of jobs that
   * can run simultaneously when using a matrix job strategy, use
   * jobs.<job_id>.strategy.max-parallel.
   *
   * For example, the following workflow will run a maximum of two jobs at a
   * time, even if there are runners available to run all six jobs at once.
   */
  maxParallel(maxParallel: number) {
    this.#maxParallel = maxParallel;
    return this;
  }

  /**
   * Prevents a workflow run from failing when a job fails. Set to true to allow
   * a workflow run to pass when this job fails.
   *
   * ##### Preventing a specific failing matrix job from failing a workflow
   * run
   *
   * You can allow specific jobs in a job matrix to fail without failing the
   * workflow run. For example, if you wanted to only allow an experimental job
   * with node set to 15 to fail without failing the workflow run.
   *
   * ```ts
   * import { workflow, e, Runner } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci', })
   *   .job('job', (job) => {
   *     return job
   *       .strategy({
   *         'fail-fast': false,
   *         matrix: {
   *           node: [16, 18],
   *           os: [Runner.MacOSLatest, Runner.UbuntuLatest],
   *           experimental: [false],
   *           include: [{ node: 17, os: Runner.UbuntuLatest, experimental: true }],
   *         },
   *       })
   *       .runsOn(ctx => e.expr(ctx.matrix.os))
   *       .continueOnError(ctx => e.expr(ctx.matrix.experimental))
   *   })
   * ```
   */
  continueOnError(
    continueOnError: WithContext<
      ExpressionValue,
      Base,
      "jobs:jobId:continueOnError"
    >,
  ) {
    this.#continueOnError = getFromContext(continueOnError);
    return this;
  }

  /**
   * ::: Note
   *
   * Note: If your workflows use Docker container actions, job containers, or
   * service containers, then you must use a Linux runner:
   *
   * - If you are using GitHub-hosted runners, you must use an Ubuntu runner.
   * - If you are using self-hosted runners, you must use a Linux machine as
   *   your runner and Docker must be installed.
   *
   * :::
   *
   * Use jobs.<job_id>.container to create a container to run any steps in a job
   * that don't already specify a container. If you have steps that use both
   * script and container actions, the container actions will run as sibling
   * containers on the same network with the same volume mounts.
   *
   * If you do not set a container, all steps will run directly on the host
   * specified by runs-on unless a step refers to an action configured to run in
   * a container.
   *
   * ::: Note
   *
   * Note: The default shell for run steps inside a container is sh instead of
   * bash. This can be overridden with jobs.<job_id>.defaults.run or
   * jobs.<job_id>.steps[*].shell.
   *
   * :::
   */
  container<Env extends EnvProps>(
    container: WithContext<
      ContainerOptions<Env>,
      Base,
      | "jobs:jobId:container"
      | "jobs:jobId:container:env:envId"
      | "jobs:jobId:container:credentials"
    >,
  ): Job<CombineAsUnion<Base | { env: StringKeyOf<Env> }>> {
    this.#container = getFromContext(container);
    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  /**
   * ::: Note
   *
   * If your workflows use Docker container actions, job containers, or service
   * containers, then you must use a Linux runner:
   *
   * - If you are using GitHub-hosted runners, you must use an Ubuntu runner.
   * - If you are using self-hosted runners, you must use a Linux machine as
   *   your runner and Docker must be installed.
   *
   * :::
   *
   * Used to host service containers for a job in a workflow. Service containers
   * are useful for creating databases or cache services like Redis. The runner
   * automatically creates a Docker network and manages the life cycle of the
   * service containers.
   *
   * If you configure your job to run in a container, or your step uses
   * container actions, you don't need to map ports to access the service or
   * action. Docker automatically exposes all ports between containers on the
   * same Docker user-defined bridge network. You can directly reference the
   * service container by its hostname. The hostname is automatically mapped to
   * the label name you configure for the service in the workflow.
   *
   * If you configure the job to run directly on the runner machine and your
   * step doesn't use a container action, you must map any required Docker
   * service container ports to the Docker host (the runner machine). You can
   * access the service container using localhost and the mapped port.
   *
   * For more information about the differences between networking service
   * containers, see "About service containers."
   */
  services<Services extends string>(
    services: WithContext<
      Record<Services, ContainerProps>,
      Base,
      | "jobs:jobId:services"
      | "jobs:jobId:services:serviceId:credentials"
      | "jobs:jobId:services:serviceId:env:envId"
    >,
  ): Job<CombineAsUnion<Base | { services: Services }>> {
    this.#services = getFromContext(services);
    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  /**
   * The location and version of a reusable workflow file to run as a job. Use
   * one of the following syntaxes:
   *
   * - {owner}/{repo}/.github/workflows/{filename}@{ref} for reusable workflows
   *   in public repositories.
   * - ./.github/workflows/{filename} for reusable workflows in the same
   *   repository. {ref} can be a SHA, a release tag, or a branch name. Using
   *   the commit SHA is the safest for stability and security. For more
   *   information, see "Security hardening for GitHub Actions." If you use the
   *   second syntax option (without {owner}/{repo} and @{ref}) the called
   *   workflow is from the same commit as the caller workflow.
   *
   * ```ts
   * import { workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .job('call-workflow-1-in-local-repo', (job) => {
   *     return job
   *       .uses('octo-org/this-repo/.github/workflows/workflow-1.yml@172239021f7ba04fe7327647b213799853a9eb89')
   *   })
   *   .job('call-workflow-2-in-local-repo', (job) => {
   *     return job.uses('./.github/workflows/workflow-2.yml')
   *   })
   *   .job('call-workflow-in-another-repo', (job) => {
   *     return job.uses('octo-org/another-repo/.github/workflows/workflow.yml@v1')
   *   });
   * ```
   *
   * For more information, see "[Reusing
   * workflows](https://docs.github.com/en/actions/learn-github-actions/reusing-workflows)."
   */
  uses<Workflow extends AnyWorkflow>(
    uses: string | Workflow,
  ): Job<CombineAsUnion<Base | ExtractFromWorkflow<Workflow>>> {
    this.#uses = typeof uses === "string"
      ? uses
      : `./.github/workflows/${uses.fileName}.yml`;

    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  /**
   * When a job is used to call a reusable workflow, you can use with to provide
   * a map of inputs that are passed to the called workflow.
   *
   * Any inputs that you pass must match the input specifications defined in the
   * called workflow.
   *
   * Unlike jobs.<job_id>.steps[*].with, the inputs you pass with
   * jobs.<job_id>.with are not be available as environment variables in the
   * called workflow. Instead, you can reference the inputs by using the inputs
   * context.
   *
   * ```ts
   * import { workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .job('call-workflow', (job) => job
   *     .uses('octo-org/example-repo/.github/workflows/called-workflow.yml')
   *     .with({ username: 'mona' })
   *   );
   * ```
   */
  with(
    props: WithContext<
      // Record<string, ExpressionValue> &
      ExpressionInputData<Base>,
      Base,
      "jobs:jobId:with:withId"
    >,
  ) {
    this.#with = getFromContext(props);
    return this;
  }

  /**
   * When a job is used to call a reusable workflow, you can use secrets to
   * provide a map of secrets that are passed to the called workflow.
   *
   * Any secrets that you pass must match the names defined in the called
   * workflow.
   *
   * ```ts
   * import { e, workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .on('push')
   *   .job('call-workflow', (job) => job
   *     .uses('octo-org/example-repo/.github/workflows/called-workflow.yml')
   *     .secrets((ctx) => ({
   *       'access-token': e.expr(ctx.secrets.PERSONAL_ACCESS_TOKEN)
   *     }))
   *   );
   * ```
   *
   * Use the inherit keyword to pass all the calling workflow's secrets to the
   * called workflow. This includes all secrets the calling workflow has access
   * to, namely organization, repository, and environment secrets. The inherit
   * keyword can be used to pass secrets across repositories within the same
   * organization, or across organizations within the same enterprise.
   *
   * ```ts
   * import { e, Runner, workflow } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
   *
   * const ci = workflow({ name: 'ci' })
   *   .on('workflow_dispatch')
   *   .job('pass-secrets-to-workflow', (job) => job
   *     .uses('./.github/workflows/called-workflow.yml')
   *     .secrets('inherit')
   *   );
   *
   * const reusable = workflow({ name: 'called-workflow' })
   *   .on('workflow_call')
   *   .job('pass-secret-to-action', job => job
   *     .runsOn(Runner.UbuntuLatest)
   *     .step(step => step
   *       .name('Use a repo or org secret from the calling workflow')
   *       .run(ctx => `echo ${e.expr(ctx.secrets.CALLING_WORKFLOW_SECRET)}`)
   *     )
   *   );
   * ```
   */
  secrets(
    secrets: WithContext<
      "inherit" | ExpressionSecretData<Base>,
      Base,
      "jobs:jobId:secrets:secretsId"
    >,
  ) {
    this.#secrets = getFromContext(secrets);
    return this;
  }

  /**
   * A job contains a sequence of tasks called steps. Steps can run commands,
   * run setup tasks, or run an action in your repository, a public repository,
   * or an action published in a Docker registry. Not all steps run actions, but
   * all actions run as a step. Each step runs in its own process in the runner
   * environment and has access to the workspace and filesystem. Because steps
   * run in their own process, changes to environment variables are not
   * preserved between steps. GitHub provides built-in steps to set up and
   * complete a job.
   */
  step<
    OutputStep extends AnyStep,
    Id extends GetStepId<OutputStep> = GetStepId<OutputStep>,
  >(
    step: StepCreator<Base, OutputStep>,
  ): Job<
    CombineAsUnion<
      | Base
      // | { tmp: OutputStep["zBase$"]["hoistEnv"] }
      | GetStepEnv<OutputStep>
      | StepOutput<Id, GetStepOutputs<OutputStep>>
    >
  > {
    const result = isFunction(step) ? step(Step.create()) : step;
    this.#steps.push(result);
    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  /**
   * Create multiple steps.
   */
  steps<Steps extends ReadonlyArray<StepCreator<Base, AnyStep>>>(
    steps: Steps,
  ): Job<CombineAsUnion<Base | GetSteps<Base, Steps>>> {
    const results = steps.map((step) =>
      isFunction(step) ? step(Step.create()) : step
    );
    this.#steps.push(...results);
    // @ts-expect-error The builder pattern makes this difficult to infer
    return this;
  }

  toString() {
    return `Job { name: ${this.#name} }`;
  }

  toJSON() {
    const json = Object.create(null);
    const errors: Error[] = [];
    const valid = (!!this.#steps.length || !!this.#uses) &&
      !(this.#steps.length > 0 && this.#uses);

    if (!valid) {
      errors.push(
        new JobError(
          `The job '${this.#name}' requires either 'steps' or a 'uses' property.`,
        ),
      );
    }

    if (
      this.#steps.length > 0 &&
      (!this.#runsOn || (Array.isArray(this.#runsOn) && isEmpty(this.#runsOn)))
    ) {
      errors.push(
        new JobError(
          `The job '${this.#name}'is missing the following properties: 'runsOn'.`,
        ),
      );
    }

    if (errors.length > 0) {
      throw new ActionifyError(
        `Invalid Job configuration: '${this.#name}'`,
        errors,
      );
    }

    json.name = this.#name;
    json.permissions = this.#permissions;
    json.needs = this.#needs;
    json.if = this.#if;
    json["runs-on"] = this.#runsOn;
    json.environment = this.#environment;
    json.concurrency = this.#concurrency;
    json.outputs = this.#outputs;
    json.env = this.#env;
    json.defaults = this.#defaults;
    json["timeout-minutes"] = this.#timeoutMinutes;
    json.strategy = this.#strategy;
    json["max-parallel"] = this.#maxParallel;
    json["continue-on-error"] = this.#continueOnError;
    json.container = this.#container;
    json.services = this.#services;
    json.uses = this.#uses;
    json.with = this.#with;
    json.secrets = this.#secrets;

    if (this.#steps.length > 0) {
      json.steps = this.#steps;
    }

    return json;
  }
}

export type AnyJob = ReplaceMethods<Job<any>>;
export type ConcurrentOptions = ConcurrentProps | ExpressionValue<string>;

type DefaultOutputOptions = Record<string, ExpressionValue<string>>;
type EnvironmentOptions = string | {
  name: string;
  url: ExpressionValue<string>;
};

interface ConcurrentProps {
  group: ExpressionValue<string>;
  "cancel-in-progress": ExpressionValue<boolean>;
}

type RunsOnOptions = ExpressionValue<
  `${Runner}` | LiteralString | string[]
>;

interface ContainerProps<Env extends EnvProps = EnvProps> {
  /**
   * Use jobs.<job_id>.container.image to define the Docker image to use as the
   * container to run the action. The value can be the Docker Hub image name or
   * a registry name.
   */
  image: ExpressionValue<string>;
  /**
   * If the image's container registry requires authentication to pull the
   * image, you can use jobs.<job_id>.container.credentials to set a map of the
   * username and password. The credentials are the same values that you would
   * provide to the docker login command.
   */
  credentials?: {
    username?: ExpressionValue<string>;
    password?: ExpressionValue<string>;
    [key: string]: ExpressionValue<string>;
  };
  /**
   * Use jobs.<job_id>.container.env to set a map of environment variables in
   * the container.
   */
  env?: Env;

  /**
   * Use jobs.<job_id>.container.ports to set an array of ports to expose on the
   * container.
   */
  ports?: ExpressionValue<Array<string | number>>;

  /**
   * Use jobs.<job_id>.container.volumes to set an array of volumes for the
   * container to use. You can use volumes to share data between services or
   * other steps in a job. You can specify named Docker volumes, anonymous
   * Docker volumes, or bind mounts on the host.
   *
   * To specify a volume, you specify the source and destination path:
   *
   * <source>:<destinationPath>.
   *
   * The <source> is a volume name or an absolute path on the host machine, and
   * <destinationPath> is an absolute path in the container.
   */
  volumes?: ExpressionValue<string[]>;

  /**
   * Use jobs.<job_id>.container.options to configure additional Docker
   * container resource options. For a list of options, see [`docker create`
   * options](https://docs.docker.com/engine/reference/commandline/create/#options).
   */
  options?: ExpressionValue<string>;
}

type ContainerOptions<Env extends EnvProps = EnvProps> =
  | ExpressionValue<string>
  | ContainerProps<Env>;
type SecretsInput =
  | ExpressionValue<"inherit">
  | Record<string, ExpressionValue>;

type StepCreator<Base extends ActionTemplate, OutputStep extends AnyStep> =
  | ((
    step: Step<Base>,
  ) => OutputStep)
  | OutputStep;
type StepsCreator<Base extends ActionTemplate, OutputStep extends AnyStep> =
  | ((
    step: Step<Base>,
    ctx: Contextify<ActionData<Base>>,
  ) => OutputStep[])
  | OutputStep[];
type GetStepId<Type> = Type extends Step<infer Base extends ActionTemplate>
  ? Base["stepId"] extends string ? Base["stepId"] : never
  : never;

type GetStepOutputs<Type extends AnyStep> = unknown extends
  GetTemplate<Type>["stepOutputs"] ? never
  : GetTemplate<Type>["stepOutputs"];

type GetStepEnv<Type extends AnyStep> = Type extends
  Step<infer Base extends ActionTemplate>
  ? unknown extends Base["hoistEnv"] ? never
  : { env: Base["hoistEnv"] }
  : never;

type GetSteps<
  Base extends ActionTemplate,
  Steps extends ReadonlyArray<StepCreator<Base, AnyStep>>,
> // Id extends GetStepId<OutputStep> = GetStepId<OutputStep>,
 = Steps extends Array<StepCreator<Base, infer S>>
  ? S extends AnyStep
    ? StepOutput<GetStepId<S>, GetStepOutputs<S>> | GetStepEnv<S>
  : never
  : never;

type ExtractFromWorkflow<W> = W extends Workflow<infer Base> ? 
    | {
      jobOutputs: NonNullable<Base["outputs"]>;
      secrets: NonNullable<Base["secrets"]>;
      inputs: NonNullable<Base["inputs"]>;
    }
    | PickInputs<Base>
    | PickSecrets<Base>
  : never;
