import type { AnyCommand, Command } from "./commands.ts";
import { isArray } from "./deps/just.ts";
import { StringKeyOf } from "./deps/types.ts";
import type { ExpressionValue, WithContext } from "./expressions.ts";
import type {
  ActionTemplate,
  CombineAsUnion,
  EnvProps,
  HasActionTemplate,
  Listed,
  LiteralString,
  Shell,
  WithStep,
} from "./types.ts";
import { getFromContext } from "./utils.ts";

/**
 * Create a step which can be added to jobs.
 */
export function step<
  Base extends ActionTemplate = { stepId: never },
>(): Step<WithStep<Base>> {
  return Step.create();
}

export class Step<Base extends ActionTemplate = WithStep<ActionTemplate>>
  implements HasActionTemplate<Base> {
  static create<
    Base extends ActionTemplate = { stepId: never },
  >(): Step<WithStep<Base>> {
    return new Step();
  }

  /**
   * Create a leniently typed `Step`.
   */
  static untyped() {
    return new Step();
  }

  #id: string | undefined;
  #if: ExpressionValue | undefined;
  #name: ExpressionValue<string> | undefined;
  #uses: string | undefined;
  #run: string | undefined;
  #shell: string | undefined;
  #workingDirectory: ExpressionValue | undefined;
  #with: Record<string, ExpressionValue> | undefined;
  #env: Record<string, ExpressionValue<string>> | undefined;
  #continueOnError: ExpressionValue | undefined;
  #timeoutMinutes: ExpressionValue<number> | undefined;
  declare zBase$: Base;

  /**
   * A unique identifier for the step. You can use the id to reference the step
   * in contexts.
   */
  id<Id extends string>(id: Id): Step<CombineAsUnion<Base | { stepId: Id }>> {
    this.#id = id;
    // @ts-expect-error This type would be very difficult to infer due to the
    // builder pattern.
    return this;
  }

  /**
   * You can use the `if` conditional to prevent a job from running unless a
   * condition is met. You can use any supported context and expression to
   * create a conditional.
   *
   * When you use expressions in an if conditional, you may omit the expression
   * syntax (${{ }}) because GitHub automatically evaluates the if conditional
   * as an expression. For more information, see "Expressions."
   *
   * ##### Using contexts
   *
   * This step only runs when the event type is a pull_request and the event
   * action is unassigned.

   * ```ts
   * import { Step, e } from 'https://deno.land/x/actionify/mod.ts';
   *
   * const step = Step
   *   .untyped()
   *   .name('My first step')
   *   .if(ctx => e.op(
   *     e.op(ctx.github.event_name, '==', 'pull_request'),
   *     '&&',
   *     e.op(ctx.github.action, '==', 'unassigned')
   *   ))
   *   .run('echo This event is a pull request that had an assignee removed');
   * ```
   *
   * ##### Using status check functions
   *
   * The my backup step only runs when the previous step of a job fails.
   *
   * ```ts
   * import { Job, e, Step } from 'https://deno.land/x/actionify/mod.ts';
   *
   * const usesStep = Step
   *   .create()
   *   .uses('octo-org/action-name');
   * const conditionalStep = Step
   *   .create()
   *   .if(e.failure())
   *   .uses('actions/heroku@1.0.0');
   *
   * const job = Job
   *   .create()
   *   .step(usesStep)
   *   .step(conditionalStep);
   * ```
   *
   * ##### Using secrets
   *
   * Secrets cannot be directly referenced in if: conditionals. Instead,
   * consider setting secrets as job-level environment variables, then
   * referencing the environment variables to conditionally run steps in the
   * job.
   *
   * If a secret has not been set, the return value of an expression referencing
   * the secret (such as ${{ secrets.SuperSecret }} in the example) will be an
   * empty string.
   *
   * ```ts
   * import { Workflow, e } from 'https://deno.land/x/actionify/mod.ts';
   *
   * const workflow = Workflow
   *   .create({ name: "ci", fileName: "ci" })
   *   .on('push')
   *   .job('myJobName', job => job
   *     .env({ SUPER_SECRET: e.expr(e.ctx.secrets.SUPER_SECRET) })
   *     .step(step => step
   *       .if(ctx => e.op(ctx.env.SUPER_SECRET, '!=', ''))
   *       .run('echo "This step will only run if the secret has a value set."')
   *     )
   *     .step(step => step
   *       .if(ctx => e.op(ctx.env.SUPER_SECRET, '==', ''))
   *       .run('echo "This step will only run if the secret does not have a value set."')
   *     )
   *   );
   * ```
   */
  if(statement: WithContext<ExpressionValue, Base>) {
    this.#if = getFromContext(statement);
    return this;
  }

  /**
   * A name for the step to display in the GitHub UI.
   */
  name(name: WithContext<ExpressionValue<string>, Base>) {
    this.#name = getFromContext(name);
    return this;
  }

  /**
   * Selects an action to run as part of a step in your job. An action is a
   * reusable unit of code. You can use an action defined in the same repository
   * as the workflow, a public repository, or in a published Docker container
   * image.
   *
   * We strongly recommend that you include the version of the action you are
   * using by specifying a Git ref, SHA, or Docker tag. If you don't specify a
   * version, it could break your workflows or cause unexpected behavior when
   * the action owner publishes an update.
   *
   * Using the commit SHA of a released action version is the safest for
   * stability and security. If the action publishes major version tags, you
   * should expect to receive critical fixes and security patches while still
   * retaining compatibility. Note that this behavior is at the discretion of
   * the action's author. Using the default branch of an action may be
   * convenient, but if someone releases a new major version with a breaking
   * change, your workflow could break. Some actions require inputs that you
   * must set using the with keyword. Review the action's README file to
   * determine the inputs required.
   *
   * Actions are either JavaScript files or Docker containers. If the action
   * you're using is a Docker container you must run the job in a Linux
   * environment. For more details, see runs-on.
   *
   * ##### Using versioned actions
   *
   * ```ts
   * import { Job } from 'https://deno.land/x/actionify/mod.ts';
   *
   * const job = Job
   *   .create()
   *   // Reference a specific commit
   *   .step(step => step.uses('actions/checkout@a81bbbf8298c0fa03ea29cdc473d45769f953675'))
   *   // Reference the major version of a release
   *   .step(step => step.uses('actions/checkout@v3'))
   *   // Reference a specific version
   *   .step(step => step.uses('actions/checkout@v3.2.0'))
   *   // Reference a branch
   *   .step(step => step.uses('actions/checkout@main'))
   * ```
   */
  uses(uses: string) {
    this.#uses = uses;
    return this;
  }

  /**
   * Runs command-line programs using the operating system's shell. If you do
   * not provide a name, the step name will default to the text specified in the
   * run command.
   *
   * Commands run using non-login shells by default. You can choose a different
   * shell and customize the shell used to run commands. For more information,
   * see jobs.<job_id>.steps[*].shell.
   *
   * Each run keyword represents a new process and shell in the runner
   * environment. When you provide multi-line commands, each line runs in the
   * same shell.
   *
   * ```ts
   * import { Step } from 'https://deno.land/x/actionify/mod.ts';
   *
   * const step = Step
   *   .create()
   *   .run('npm install');
   * ```
   */
  run<Type extends AnyCommand>(
    run: WithContext<Listed<Type | string>, Base>,
  ): Step<CombineAsUnion<Base | ExtractCommand<Type>>> {
    const value = getFromContext(run);
    this.#run = (isArray(value) ? value : [value])
      .map((command) => `${command}`)
      .join("\n");
    // @ts-expect-error This type would be very difficult to infer due to the
    // builder pattern.
    return this;
  }

  /**
   * You can override the default shell settings in the runner's operating
   * system using the `shell` keyword. You can use built-in `shell` keywords, or
   * you can define a custom set of shell options. The shell command that is run
   * internally executes a temporary file that contains the commands specified
   * in the `run` keyword.
   *
   * ```ts
   * import { Step } from 'https://deno.land/x/actionify/mod.ts';
   *
   * const step = Step
   *   .create()
   *   .run('echo $PATH')
   *   .shell('bash');
   * ```
   */
  shell(shell: WithContext<LiteralString | `${Shell}`, Base>) {
    this.#shell = getFromContext(shell);
    return this;
  }

  /**
   * Using the working-directory keyword, you can specify the working directory
   * of where to run the command.
   *
   * ```ts
   * import { Step } from 'https://deno.land/x/actionify/mod.ts';
   *
   * const step = Step
   *   .create()
   *   .run('rm -rf *')
   *   .workingDirectory('./tmp');
   * ```
   */
  workingDirectory(workingDirectory?: WithContext<ExpressionValue, Base>) {
    this.#workingDirectory = getFromContext(workingDirectory);
    return this;
  }

  /**
   * A map of the input parameters defined by the action. Each input parameter
   * is a key/value pair. Input parameters are set as environment variables. The
   * variable is prefixed with INPUT_ and converted to upper case.
   */
  with(props: WithContext<WithProps, Base>) {
    this.#with = getFromContext(props);
    return this;
  }

  /**
   * Sets environment variables for steps to use in the runner environment. You
   * can also set environment variables for the entire workflow or a job. For
   * more information, see env and jobs.<job_id>.env.
   *
   * When more than one environment variable is defined with the same name,
   * GitHub uses the most specific environment variable. For example, an
   * environment variable defined in a step will override job and workflow
   * variables with the same name, while the step executes. A variable defined
   * for a job will override a workflow variable with the same name, while the
   * job executes.
   *
   * Public actions may specify expected environment variables in the README
   * file. If you are setting a secret in an environment variable, you must set
   * secrets using the secrets context. For more information, see "Using
   * environment variables" and "Contexts."
   */
  env<Env extends EnvProps>(
    env: WithContext<Env, Base>,
  ): Step<CombineAsUnion<Base | { env: StringKeyOf<Env> }>> {
    this.#env = getFromContext(env);
    // @ts-expect-error This type would be very difficult to infer due to the
    // builder pattern.
    return this;
  }

  /**
   * Prevents a job from failing when a step fails. Set to true to allow a job
   * to pass when this step fails.
   */
  continueOnError(continueOnError: WithContext<ExpressionValue, Base>) {
    this.#continueOnError = getFromContext(continueOnError);
    return this;
  }

  /**
   * The maximum number of minutes to run the step before killing the process.
   */
  timeoutMinutes(minutes: WithContext<ExpressionValue<number>, Base>) {
    this.#timeoutMinutes = getFromContext(minutes);
    return this;
  }

  toString() {
    return `Step { id: "${this.#id}", name: "${this.#name}" }`;
  }

  [Symbol.for("Deno.customInspect")](): string {
    return this.toString();
  }

  /**
   * TODO(@ifiokjr): add type to the json result
   */
  toJSON() {
    const json = Object.create(null);

    json.if = this.#if;
    json.id = this.#id;
    json.name = this.#name;
    json.uses = this.#uses;
    json.run = this.#run;
    json.shell = this.#shell;
    json["working-directory"] = this.#workingDirectory;
    json.with = this.#with;
    json.env = this.#env;
    json["continue-on-error"] = this.#continueOnError;
    json["timeout-minutes"] = this.#timeoutMinutes;

    return json;
  }
}

export type AnyStep = Step<any>;
// export type ExtractCommand<Type> =
//   | GetOutputs<Type>
//   | GetJobEnv<Type>;
export type ExtractCommand<C extends AnyCommand> = C extends Command<infer T> ? //  T["output"]
  { stepOutputs: T["output"] } | { hoistEnv: T["env"]; env: T["env"] }
  : never;

// type GetOutputs<Type> = Type extends Command<infer Output extends string, any>
//   ? { stepOutputs: Output }
//   : never;
// type GetJobEnv<Type> = Type extends Command<any, infer Env extends string>
//   ? { hoistEnv: Env }
//   : never;

interface WithProps {
  [key: string]: ExpressionValue;

  /**
   * A string that defines the inputs for a Docker container. GitHub passes the
   * args to the container's ENTRYPOINT when the container starts up. An array
   * of strings is not supported by this parameter.
   */
  args?: ExpressionValue;

  /**
   * Overrides the Docker ENTRYPOINT in the Dockerfile, or sets it if one wasn't
   * already specified. Unlike the Docker ENTRYPOINT instruction which has a
   * shell and exec form, entrypoint keyword accepts only a single string
   * defining the executable to be run.
   */
  entrypoint?: ExpressionValue;
}
