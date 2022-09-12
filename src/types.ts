import type { WebhookEventMap } from "./deps/ocotokit.ts";
import type { EventPayloadMap, WebhookEventName } from "./deps/ocotokit.ts";
import type {
  Simplify,
  StringKeyOf,
  UnionToIntersection,
} from "./deps/types.ts";
import type {
  Expression,
  ExpressionValue,
  WithContext,
} from "./expressions.ts";

export type LiteralString = string & Record<never, never>;
export type IsUnknown<Type> = unknown extends Type ? true : never;
// gets all viable keys from all interfaces in a union.
export type AllKeysOf<Union> = Union extends any ? keyof Union : never;
/**
 * Basically does Union[Key] but when Union is a union it only gives Union[Key]
 * for the members of the union for which it is a valid key.
 */
export type Get<Union, Key extends keyof any> = Union extends Record<Key, any>
  ? Union[Key] // extends object ? CombineAsUnion<Union[Key]> : Union[Key]
  : never;

export type Intersect<Union, Key extends keyof any> = Union extends
  Record<Key, any> ? UnionToIntersection<Union[Key]> : never;
// takes a union of interfaces and merges them so that any common key is a union of possibilities.
export type CombineAsUnion<Union> = Simplify<
  { [Key in AllKeysOf<Union>]: Get<Union, Key> }
>;

export type _CombineAsUnion<A, B> =
  & Omit<A, keyof B> // items in A that aren't in B
  & Omit<B, keyof A> // items in B that aren't in A
  & { [K in keyof A & keyof B]: A[K] | B[K] }; // union of both.
export type CombineAsIntersection<Union> = {
  [Key in AllKeysOf<Union>]: Intersect<Union, Key>;
};

export interface BaseContext<Type = unknown> {
  /** @internal */
  readonly z$__context__$: "$__CONTEXT__$";
  /** @internal */
  readonly z$__type__$: Type;
  /**
   * @internal
   */
  readonly z$__keys__$: string[];
}

/**
 * Get the Action template from a workflow, step or job.
 */
export type GetTemplate<Type extends HasActionTemplate<any>> = Type["zBase$"];

export interface HasActionTemplate<Base extends ActionTemplate> {
  zBase$: Base;
}

export type WithStep<Type> = Type & { inStep: true; inJob: true };
export type WithJob<Type> = Type & { inJob: true };

export enum Runner {
  SelfHosted = "self-hosted",
  /**
   * The windows-latest label currently uses the Windows Server 2022 runner
   * image.
   */
  WindowsLatest = "windows-latest",
  Windows2022 = "windows-2022",
  Windows2019 = "windows-2019",
  Ubuntu22_04 = "ubuntu-22.04",
  UbuntuLatest = "ubuntu-latest",
  Ubuntu20_04 = "ubuntu-20.04",
  /**
   * @deprecated Migrate to ubuntu-20.04 or ubuntu-22.04
   *
   * For more information, see [this GitHub blog
   * post](https://github.blog/changelog/2022-08-09-github-actions-the-ubuntu-18-04-actions-runner-image-is-being-deprecated-and-will-be-removed-by-12-1-22/).
   */
  Ubuntu18_04 = "ubuntu-18.04",
  MacOS12 = "macos-12",
  MacOS11 = "macos-11",
  /**
   * The macos-latest label currently uses the macOS 11 runner image.
   */
  MacOSLatest = "macos-latest",
  /**
   * @deprecated Migrate to macOS-11 or macOS-12. For more information, see
   * [this GitHub blog
   * post](https://github.blog/changelog/2022-07-20-github-actions-the-macos-10-15-actions-runner-image-is-being-deprecated-and-will-be-removed-by-8-30-22/).
   */
  MacOS10_15 = "macos-10.15",
}

export interface ActionTemplate {
  inJob?: boolean;
  inStep?: boolean;
  events?: keyof WorkflowEvents;
  env?: string;
  services?: string;
  /** Jobs to their outputs */
  jobs?: string;
  jobOutputs?: string;
  hoistEnv?: string;
  steps?: string;
  stepOutputs?: string;
  secrets?: string;
  needs?: string;
  matrix?: string;
  inputs?: string;
  stepId?: string | undefined;
  tmp?: unknown;
}

// type B = {[Key in 'a'  | 'b' as `job_outputs:${Key}`]: Key}

export interface ActionData<
  Base extends ActionTemplate = ActionTemplate,
> {
  /**
   * Information about the workflow run. For more information, see github
   * context.
   */
  github: GitHubData<Base>;

  /**
   * Contains environment variables set in a workflow, job, or step. For more
   * information, see env context.
   */
  env: EnvData<Base>;

  /**
   * Information about the currently running job. For more information, see job
   * context.
   */
  job: Base["inJob"] extends true ? JobData<Base> : never;

  /**
   * For reusable workflows only, contains outputs of jobs from the reusable
   * workflow. For more information, see jobs context.
   */
  jobs: JobsData<Base>;

  /**
   * Information about the steps that have been run in the current job. For more
   * information, see steps context.
   */
  steps: Base["inJob"] extends true ? StepsData<Base> : never;

  /**
   * Information about the runner that is running the current job. For more
   * information, see runner context.
   */
  runner: Base["inJob"] extends true ? RunnerData : never;

  /**
   * Contains the names and values of secrets that are available to a workflow
   * run. For more information, see secrets context.
   */
  secrets: SecretsData<Base>;

  /**
   * Information about the matrix execution strategy for the current job. For
   * more information, see strategy context.
   */
  strategy: StrategyData;

  /**
   * Contains the matrix properties defined in the workflow that apply to the
   * current job. For more information, see matrix context.
   */
  matrix: Base["inJob"] extends true ? MatrixData<Base> : never;

  /**
   * Contains the outputs of all jobs that are defined as a dependency of the
   * current job. For more information, see needs context.
   */
  needs: Base["inJob"] extends true ? NeedsData<Base> : never;

  /**
   * Contains the inputs of a reusable or manually triggered workflow. For more
   * information, see inputs context.
   */
  inputs: InputData<Base>;
}

type InputData<Base extends ActionTemplate> = {
  [Input in NonNullable<Base["inputs"]>]: GetInput<Input, Base>;
};

export type StepOutputKey<StepId extends string, OutputName extends string> =
  GenerateKeyObject<
    "steps_output",
    StepId,
    OutputName
  >;

export type StepOutput<StepId extends string, OutputName extends string> =
  StepId extends string ? { steps: StepId } & StepOutputKey<StepId, OutputName>
    : never;

type GetStepOutput<StepId extends string, Base extends ActionTemplate> =
  Base extends StepOutputKey<StepId, infer OutputName extends string>
    ? OutputName
    : LiteralString;

interface StepResult<StepId extends string, Base extends ActionTemplate> {
  /**
   * The set of outputs defined for the step. For more information, see
   * "Metadata syntax for GitHub Actions."
   */
  outputs: Record<GetStepOutput<StepId, Base>, string>;

  /**
   * 	The result of a completed step after continue-on-error is applied. Possible values are success, failure, cancelled, or skipped. When a continue-on-error step fails, the outcome is failure, but the final conclusion is success.
   */
  conclusion: JobResult;

  /**
   * 	The result of a completed step before continue-on-error is applied. Possible values are success, failure, cancelled, or skipped. When a continue-on-error step fails, the outcome is failure, but the final conclusion is success.
   */
  outcome: JobResult;
  // outputs.<output_name>	string	The value of a specific output.
}

export type StepsData<Base extends ActionTemplate> = {
  [StepId in NonNullable<Base["steps"]>]: StepResult<StepId, Base>;
};

interface StrategyData {
  /**
   * When true, all in-progress jobs are canceled if any job in a matrix fails.
   * For more information, see "Workflow syntax for GitHub Actions."
   */
  "fail-fast": string;

  /**
   * The index of the current job in the matrix. Note: This number is a zero-based
   * number. The first job's index in the matrix is 0.
   */
  "job-index": string;

  /**
   * The total number of jobs in the matrix. Note: This number is not a zero-based
   * number. For example, for a matrix with four jobs, the value of job-total is
   * 4.
   */
  "job-total": string;

  /**
   * The maximum number of jobs that can run simultaneously when using a matrix
   * job strategy. For more information, see "Workflow syntax for GitHub Actions."
   */
  "max-parallel": string;
}

/**
 * This context is the same for each job in a workflow run. You can access this
 * context from any step in a job. This object contains all the properties
 * listed below.
 */
export type SecretsData<Base extends ActionTemplate> =
  & Record<NonNullable<Base["secrets"]>, string>
  & {
    /**
     * Automatically created token for each workflow run. For more information,
     * see "Automatic token authentication."
     */
    GITHUB_TOKEN: string;
  }
  & Record<LiteralString, string>;

/**
 * This context is only populated for workflow runs that have dependent jobs,
 * and changes for each job in a workflow run. You can access this context from
 * any job or step in a workflow. This object contains all the properties listed
 * below.
 */
export type NeedsData<Base extends ActionTemplate> = {
  [Key in NonNullable<Base["needs"]>]: OutputResult<Key, Base>;
};

/**
 * The runner context contains information about the runner that is executing
 * the current job.
 *
 * This context changes for each job in a workflow run.
 */
export interface RunnerData {
  /**
   * The name of the runner executing the job.
   */
  name: string;

  /**
   * The operating system of the runner executing the job. Possible values are
   * Linux, Windows, or macOS.
   */
  os: RunnerOS;

  /**
   * The architecture of the runner executing the job. Possible values are X86,
   * X64, ARM, or ARM64.
   */
  arch: RunnerArch;

  /**
   * The path to a temporary directory on the runner. This directory is emptied at
   * the beginning and end of each job. Note that files will not be removed if the
   * runner's user account does not have permission to delete them.
   */
  temp: string;

  /**
   * The path to the directory containing preinstalled tools for GitHub-hosted
   * runners. For more information, see "About GitHub-hosted runners".
   */
  tool_cache: string;

  /**
   * This is set only if debug logging is enabled, and always has the value of 1.
   * It can be useful as an indicator to enable additional debugging or verbose
   * logging in your own job steps.
   */
  debug: string;
}

type RunnerOS = "Linux" | "Windows" | "macOS";
type RunnerArch = "X86" | "X64" | "ARM" | "ARM64";

type GenerateKeyObject<Prefix extends string, Name extends string, Type> = {
  [Key in Name as `${Prefix}:${Key}`]: Type;
};

type JobMatrixKey<Name extends string, Type> = GenerateKeyObject<
  "job_matrix",
  Name,
  Type
>;
export type MatrixKeys<
  Matrix extends Record<LiteralString, readonly unknown[]>,
  Excluded extends Record<LiteralString, unknown>,
  Included extends Record<LiteralString, unknown>,
  MK extends StringKeyOf<Matrix> = Exclude<
    StringKeyOf<Matrix>,
    "exclude" | "include"
  >,
  EK extends AllKeysOf<Excluded> = AllKeysOf<Excluded>,
  IK extends AllKeysOf<Included> = AllKeysOf<Included>,
> =
  | (LiteralString extends EK ? never
    : EK extends string
      ? { matrix: EK } & JobMatrixKey<EK, NonNullable<Excluded[EK]>>
    : never)
  | (LiteralString extends IK ? never
    : IK extends string
      ? { matrix: IK } & JobMatrixKey<IK, NonNullable<Included[IK]>>
    : never)
  | (LiteralString extends MK ? never : MK extends string ? {
      matrix: MK;
    } & JobMatrixKey<MK, Matrix[MK] extends Array<infer T> ? T : never>
  : never);

type GetMatrix<Name extends string, Base extends ActionTemplate> = Base extends
  JobMatrixKey<Name, infer Type> ? Type : never;

export type MatrixData<Base extends ActionTemplate> = {
  [Key in NonNullable<Base["matrix"]>]: GetMatrix<Key, Base>;
};

type A = {
  events: "pull_request" | "push";
  inJob: true;
  env: "DENO_DIR";
  matrix: "os" | "deno";
  "job_matrix:os": Runner;
  "job_matrix:deno": string;
};

type B = MatrixData<A>;

export interface StrategyOptions<
  Matrix extends Record<string, readonly unknown[]> = Record<
    string,
    readonly unknown[]
  >,
  Exclude extends Record<string, unknown> = Record<
    string,
    unknown
  >,
  Included extends Record<string, unknown> = Record<
    string,
    unknown
  >,
> {
  matrix?: Matrix & {
    exclude?: readonly Exclude[];
    include?: readonly Included[];
  };

  /**
   * You can control how job failures are handled with
   * jobs.<job_id>.strategy.fail-fast and jobs.<job_id>.continue-on-error.
   *
   * jobs.<job_id>.strategy.fail-fast applies to the entire matrix. If
   * jobs.<job_id>.strategy.fail-fast is set to true, GitHub will cancel all
   * in-progress and queued jobs in the matrix if any job in the matrix fails.
   * This property defaults to true.
   *
   * jobs.<job_id>.continue-on-error applies to a single job. If
   * jobs.<job_id>.continue-on-error is true, other jobs in the matrix will
   * continue running even if the job with jobs.<job_id>.continue-on-error: true
   * fails.
   *
   * You can use jobs.<job_id>.strategy.fail-fast and
   * jobs.<job_id>.continue-on-error together. For example, the following
   * workflow will start four jobs. For each job, continue-on-error is
   * determined by the value of matrix.experimental. If any of the jobs with
   * continue-on-error: false fail, all jobs that are in progress or queued will
   * be cancelled. If the job with continue-on-error: true fails, the other jobs
   * will not be affected.
   */
  "fail-fast"?: boolean;

  /**
   * By default, GitHub will maximize the number of jobs run in parallel
   * depending on runner availability. To set the maximum number of jobs that
   * can run simultaneously when using a matrix job strategy, use
   * jobs.<job_id>.strategy.max-parallel.
   *
   * For example, the following workflow will run a maximum of two jobs at a
   * time, even if there are runners available to run all six jobs at once.
   */
  "max-parallel"?: number;
}

type GetJobOutputs<JobId extends string, Base extends ActionTemplate> =
  Base extends JobOutputKey<JobId, infer Output extends string> ? Output
    : LiteralString;
export type JobOutputKey<JobId extends string, Outputs extends string> =
  GenerateKeyObject<"job_outputs", JobId, Outputs>;

interface OutputResult<
  JobId extends string,
  Base extends ActionTemplate,
> {
  /**
   * The result of a job that the current job depends on. Possible values are success, failure, cancelled, or skipped.
   */
  result: JobResult;
  /**
   * The set of outputs of a job that the current job depends on.
   */
  outputs: Record<GetJobOutputs<JobId, Base>, string>;
}

export type JobsData<
  Base extends ActionTemplate,
> = {
  [JobId in NonNullable<Base["jobs"]>]: OutputResult<JobId, Base>;
};

export type JobResult = "success" | "failure" | "cancelled" | "skipped";

/**
 * The job context contains information about the currently running job.
 *
 * This context changes for each job in a workflow run. You can access this
 * context from any step in a job. This object contains all the properties
 * listed below.
 */
export interface JobData<Base extends ActionTemplate> {
  /**
   * Information about the job's container.
   */
  container: JobContextContainer;

  /**
   * The service containers created for a job.
   */
  services: JobContextServices<NonNullable<Base["services"]>>;

  /**
   * The current status of the job. Possible values are `success`, `failure`, or
   * `cancelled`.
   */
  status: JobContextStatus;
}

type JobContextStatus = "success" | "failure" | "cancelled";
interface JobContextContainer {
  /**
   * The ID of the container.
   */
  id: string;

  /**
   * The ID of the container network. The runner creates the network used by all
   * containers in a job.
   */
  network: string;
}

type JobContextServices<Services extends string = string> = Record<
  Services,
  JobContextService
>;

/**
 * The service containers created for a job. For more information about service
 * containers, see "Workflow syntax for GitHub Actions."
 */
interface JobContextService {
  /**
   * The ID of the service container.
   */
  id: string;
  /**

  * The ID of the service container network. The runner creates the network
   * used by all containers in a job.
   */
  network: string;

  /**
   * The exposed ports of the service container.
   */
  ports: object;
}

export type EnvData<Base extends ActionTemplate> =
  & DefaultEnv
  & Record<NonNullable<Base["env"]>, string>;

/**
 * The default environment variables that GitHub sets are available to every
 * step in a workflow.
 *
 * We strongly recommend that actions use environment variables to access the
 * filesystem rather than using hardcoded file paths. GitHub sets environment
 * variables for actions to use in all runner environments.
 */
export interface DefaultEnv {
  /**
   * Always set to true.
   */
  CI: string;

  /**
   * The name of the action currently running, or the id of a step. For example, for an action, __repo-owner_name-of-action-repo.
   *
   * GitHub removes special characters, and uses the name __run when the current step runs a script without an id. If you use the same script or action more than once in the same job, the name will include a suffix that consists of the sequence number preceded by an underscore. For example, the first script you run will have the name __run, and the second script will be named __run_2. Similarly, the second invocation of actions/checkout will be actionscheckout2.
   */
  GITHUB_ACTION: string;

  /**
   * The path where an action is located. This property is only supported in
   * composite actions. You can use this path to access files located in the same
   * repository as the action. For example,
   * /home/runner/work/_actions/repo-owner/name-of-action-repo/v1.
   */
  GITHUB_ACTION_PATH: string;

  /**
   * For a step executing an action, this is the owner and repository name of the
   * action. For example, actions/checkout.
   */
  GITHUB_ACTION_REPOSITORY: string;

  /**
   * Always set to true when GitHub Actions is running the workflow. You can use
   * this variable to differentiate when tests are being run locally or by GitHub
   * Actions.
   */
  GITHUB_ACTIONS: string;

  /**
   * The name of the person or app that initiated the workflow. For example,
   * octocat.
   */
  GITHUB_ACTOR: string;

  /**
   * Returns the API URL. For example: https://api.github.com.
   */
  GITHUB_API_URL: string;

  /**
   * The name of the base ref or target branch of the pull request in a workflow
   * run. This is only set when the event that triggers a workflow run is either
   * pull_request or pull_request_target. For example, main.
   */
  GITHUB_BASE_REF: string;

  /**
   * The path on the runner to the file that sets environment variables from
   * workflow commands. This file is unique to the current step and changes for
   * each step in a job. For example,
   * /home/runner/work/_temp/_runner_file_commands/set_env_87406d6e-4979-4d42-98e1-3dab1f48b13a.
   * For more information, see "Workflow commands for GitHub Actions."
   */
  GITHUB_ENV: string;

  /**
   * The name of the event that triggered the workflow. For example,
   * workflow_dispatch.
   */
  GITHUB_EVENT_NAME: string;

  /**
   * The path to the file on the runner that contains the full event webhook
   * payload. For example, /github/workflow/event.json.
   */
  GITHUB_EVENT_PATH: string;

  /**
   * Returns the GraphQL API URL. For example: https://api.github.com/graphql.
   */
  GITHUB_GRAPHQL_URL: string;

  /**
   * The head ref or source branch of the pull request in a workflow run. This
   * property is only set when the event that triggers a workflow run is either
   * pull_request or pull_request_target. For example, feature-branch-1.
   */
  GITHUB_HEAD_REF: string;

  /**
   * The job_id of the current job. For example, greeting_job.
   */
  GITHUB_JOB: string;

  /**
   * The path on the runner to the file that sets system PATH variables from
   * workflow commands. This file is unique to the current step and changes for
   * each step in a job. For example,
   * /home/runner/work/_temp/_runner_file_commands/add_path_899b9445-ad4a-400c-aa89-249f18632cf5.
   * For more information, see "Workflow commands for GitHub Actions."
   */
  GITHUB_PATH: string;

  /**
   * The branch or tag ref that triggered the workflow run. For workflows
   * triggered by push, this is the branch or tag ref that was pushed. For
   * workflows triggered by pull_request, this is the pull request merge branch.
   * For workflows triggered by release, this is the release tag created. For
   * other triggers, this is the branch or tag ref that triggered the workflow
   * run. This is only set if a branch or tag is available for the event type. The
   * ref given is fully-formed, meaning that for branches the format is
   * refs/heads/<branch_name>, for pull requests it is
   * refs/pull/<pr_number>/merge, and for tags it is refs/tags/<tag_name>. For
   * example, refs/heads/feature-branch-1.
   */
  GITHUB_REF: string;

  /**
   * The branch or tag name that triggered the workflow run. For example,
   * feature-branch-1.
   */
  GITHUB_REF_NAME: string;

  /**
   * true if branch protections are configured for the ref that triggered the
   * workflow run.
   */
  GITHUB_REF_PROTECTED: string;

  /**
   * The type of ref that triggered the workflow run. Valid values are branch or
   * tag.
   */
  GITHUB_REF_TYPE: string;

  /**
   * The owner and repository name. For example, octocat/Hello-World.
   */
  GITHUB_REPOSITORY: string;

  /**
   * The repository owner's name. For example, octocat.
   */
  GITHUB_REPOSITORY_OWNER: string;

  /**
   * The number of days that workflow run logs and artifacts are kept. For
   * example, 90.
   */
  GITHUB_RETENTION_DAYS: string;

  /**
   * A unique number for each attempt of a particular workflow run in a
   * repository. This number begins at 1 for the workflow run's first attempt, and
   * increments with each re-run. For example, 3.
   */
  GITHUB_RUN_ATTEMPT: string;

  /**
   * A unique number for each workflow run within a repository. This number does
   * not change if you re-run the workflow run. For example, 1658821493.
   */
  GITHUB_RUN_ID: string;

  /**
   * A unique number for each run of a particular workflow in a repository. This
   * number begins at 1 for the workflow's first run, and increments with each new
   * run. This number does not change if you re-run the workflow run. For example,
   * 3.
   */
  GITHUB_RUN_NUMBER: string;

  /**
   * The URL of the GitHub server. For example: https://github.com.
   */
  GITHUB_SERVER_URL: string;

  /**
   * The commit SHA that triggered the workflow. The value of this commit SHA
   * depends on the event that triggered the workflow. For more information, see
   * "Events that trigger workflows." For example,
   * ffac537e6cbbf934b08745a378932722df287a53.
   */
  GITHUB_SHA: string;

  /**
   * The path on the runner to the file that contains job summaries from workflow
   * commands. This file is unique to the current step and changes for each step
   * in a job. For example,
   * /home/rob/runner/_layout/_work/_temp/_runner_file_commands/step_summary_1cb22d7f-5663-41a8-9ffc-13472605c76c.
   * For more information, see "Workflow commands for GitHub Actions."
   */
  GITHUB_STEP_SUMMARY: string;

  /**
   * The name of the workflow. For example, My test workflow. If the workflow file
   * doesn't specify a name, the value of this variable is the full path of the
   * workflow file in the repository.
   */
  GITHUB_WORKFLOW: string;

  /**
   * The default working directory on the runner for steps, and the default
   * location of your repository when using the checkout action. For example,
   * /home/runner/work/my-repo-name/my-repo-name.
   */
  GITHUB_WORKSPACE: string;

  /**
   * The architecture of the runner executing the job. Possible values are X86,
   * X64, ARM, or ARM64.
   */
  RUNNER_ARCH: string;

  /**
   * This is set only if debug logging is enabled, and always has the value of 1.
   * It can be useful as an indicator to enable additional debugging or verbose
   * logging in your own job steps.
   */
  RUNNER_DEBUG: string;

  /**
   * The name of the runner executing the job. For example, Hosted Agent
   */
  RUNNER_NAME: string;

  /**
   * The operating system of the runner executing the job. Possible values are
   * Linux, Windows, or macOS. For example, Windows
   */
  RUNNER_OS: string;

  /**
   * The path to a temporary directory on the runner. This directory is emptied at
   * the beginning and end of each job. Note that files will not be removed if the
   * runner's user account does not have permission to delete them. For example,
   * D:\a\_temp
   */
  RUNNER_TEMP: string;

  /**
   * The path to the directory containing preinstalled tools for GitHub-hosted
   * runners. For more information, see "About GitHub-hosted runners". For
   * example, C:\hostedtoolcache\windows
   */
  RUNNER_TOOL_CACHE: string;
}

/**
 * The github context contains information about the workflow run and the event
 * that triggered the run. You can also read most of the github context data in
 * environment variables. For more information about environment variables, see
 * ["Using environment
 * variables."](https://docs.github.com/en/actions/automating-your-workflow-with-github-actions/using-environment-variables)
 *
 * :::warning
 *
 *  When using the whole github context, be mindful that it includes
 *  sensitive information such as github.token. GitHub masks secrets when they
 *  are printed to the console, but you should be cautious when exporting or
 *  printing the context.
 *
 * :::
 *
 * :::warning
 *
 * When creating workflows and actions, you should always consider whether your
 * code might execute untrusted input from possible attackers. Certain contexts
 * should be treated as untrusted input, as an attacker could insert their own
 * malicious content. For more information, see ["Understanding the risk of
 * script
 * injections."](https://docs.github.com/en/actions/learn-github-actions/security-hardening-for-github-actions#understanding-the-risk-of-script-injections)
 *
 * :::
 */
export type GitHubData<
  Base extends ActionTemplate,
  Event extends keyof WorkflowEvents = NonNullable<Base["events"]>,
> = Event extends string ? GitHubContextItem<Event>
  : GitHubContextItem<keyof WorkflowEvents>;

export interface GitHubContextItem<Event extends keyof WorkflowEvents> {
  /**
   * The name of the action currently running, or the id of a step. GitHub
   * removes special characters, and uses the name __run when the current step
   * runs a script without an id. If you use the same action more than once in
   * the same job, the name will include a suffix with the sequence number with
   * underscore before it. For example, the first script you run will have the
   * name __run, and the second script will be named __run_2. Similarly, the
   * second invocation of actions/checkout will be actionscheckout2.
   */
  action: string;

  /**
   * The path where an action is located. This property is only supported in
   * composite actions. You can use this path to access files located in the
   * same repository as the action.
   */
  action_path: string;

  /**
   * For a step executing an action, this is the ref of the action being
   * executed. For example, v2.
   */
  action_ref: string;

  /**
   * For a step executing an action, this is the owner and repository name of the
   * action. For example, actions/checkout.
   */
  action_repository: string;

  /**
   * For a composite action, the current result of the composite action.
   */
  action_status: string;

  /**
   * The username of the user that triggered the initial workflow run. If the
   * workflow run is a re-run, this value may differ from
   * github.triggering_actor. Any workflow re-runs will use the privileges of
   * github.actor, even if the actor initiating the re-run
   * (github.triggering_actor) has different privileges.
   */
  actor: string;

  /**
   * The URL of the GitHub REST API.
   */
  api_url: string;

  /**
   * The base_ref or target branch of the pull request in a workflow run. This
   * property is only available when the event that triggers a workflow run is
   * either pull_request or pull_request_target.
   */
  base_ref: string;

  /**
   * Path on the runner to the file that sets environment variables from workflow
   * commands. This file is unique to the current step and is a different file
   * for each step in a job. For more information, see "Workflow commands for
   * GitHub Actions."
   */
  env: string;

  /**
   * The full event webhook payload. You can access individual properties of the
   * event using this context. This object is identical to the webhook payload of
   * the event that triggered the workflow run, and is different for each event.
   * The webhooks for each GitHub Actions event is linked in "Events that trigger
   * workflows." For example, for a workflow run triggered by the push event,
   * this object contains the contents of the push webhook payload.
   */
  event: WorkflowEvents[Event];

  /**
   * The name of the event that triggered the workflow run.
   */
  event_name: Event;

  /**
   * The path to the file on the runner that contains the full event webhook
   * payload.
   */
  event_path: string;

  /**
   * The URL of the GitHub GraphQL API.
   */
  graphql_url: string;

  /**
   * The head_ref or source branch of the pull request in a workflow run. This
   * property is only available when the event that triggers a workflow run is
   * either pull_request or pull_request_target.
   */
  head_ref: string;

  /**
   * The job_id of the current job.
   *
   * Note: This context property is set by the
   * Actions runner, and is only available within the execution steps of a job.
   * Otherwise, the value of this property will be null.
   */
  job: string;

  /**
   * The branch or tag ref that triggered the workflow run. For workflows
   * triggered by push, this is the branch or tag ref that was pushed. For
   * workflows triggered by pull_request, this is the pull request merge branch.
   * For workflows triggered by release, this is the release tag created. For
   * other triggers, this is the branch or tag ref that triggered the workflow
   * run. This is only set if a branch or tag is available for the event type.
   * The ref given is fully-formed, meaning that for branches the format is
   * refs/heads/<branch_name>, for pull requests it is
   * refs/pull/<pr_number>/merge, and for tags it is refs/tags/<tag_name>. For
   * example, refs/heads/feature-branch-1.
   */
  ref: string;

  /**
   * The branch or tag name that triggered the workflow run.
   */
  ref_name: string;

  /**
   * true if branch protections are configured for the ref that triggered the
   * workflow run.
   */
  ref_protected: string;

  /**
   * The type of ref that triggered the workflow run. Valid values are branch or
   * tag.
   */
  ref_type: string;

  /**
   * Path on the runner to the file that sets system PATH variables from workflow
   * commands. This file is unique to the current step and is a different file
   * for each step in a job. For more information, see "Workflow commands for
   * GitHub Actions."
   */
  path: string;

  /**
   * The owner and repository name. For example, Codertocat/Hello-World.
   */
  repository: string;

  /**
   * The repository owner's name. For example, Codertocat.
   */
  repository_owner: string;

  /**
   * The Git URL to the repository. For example,
   * git://github.com/codertocat/hello-world.git.
   */
  repositoryUrl: string;

  /**
   * The number of days that workflow run logs and artifacts are kept.
   */
  retention_days: string;

  /**
   * A unique number for each workflow run within a repository. This number does
   * not change if you re-run the workflow run.
   */
  run_id: string;

  /**
   * A unique number for each run of a particular workflow in a repository. This
   * number begins at 1 for the workflow's first run, and increments with each
   * new run. This number does not change if you re-run the workflow run.
   */
  run_number: string;

  /**
   * A unique number for each attempt of a particular workflow run in a
   * repository. This number begins at 1 for the workflow run's first attempt,
   * and increments with each re-run.
   */
  run_attempt: string;

  /**
   * The URL of the GitHub server. For example: https://github.com.
   */
  server_url: string;

  /**
   * The commit SHA that triggered the workflow. The value of this commit SHA
   * depends on the event that triggered the workflow. For more information, see
   * "Events that trigger workflows." For example,
   * ffac537e6cbbf934b08745a378932722df287a53.
   */
  sha: string;

  /**
   * A token to authenticate on behalf of the GitHub App installed on your
   * repository. This is functionally equivalent to the GITHUB_TOKEN secret. For
   * more information, see "Automatic token authentication."
   *
   * Note: This context
   * property is set by the Actions runner, and is only available within the
   * execution steps of a job. Otherwise, the value of this property will be
   * null.
   */
  token: string;

  /**
   * The username of the user that initiated the workflow run. If the workflow
   * run is a re-run, this value may differ from github.actor. Any workflow
   * re-runs will use the privileges of github.actor, even if the actor
   * initiating the re-run (github.triggering_actor) has different privileges.
   */
  triggering_actor: string;

  /**
   * The name of the workflow. If the workflow file doesn't specify a name, the
   * value of this property is the full path of the workflow file in the
   * repository.
   */
  workflow: string;

  /**
   * The default working directory on the runner for steps, and the default
   * location of your repository when using the checkout action.
   */
  workspace: string;
}

export interface WorkflowEvents {
  branch_protection_rule: WebhookEventMap["branch_protection_rule"];
  check_run: WebhookEventMap["check_run"];
  check_suite: WebhookEventMap["check_suite"];
  create: WebhookEventMap["create"];
  delete: WebhookEventMap["delete"];
  deployment: WebhookEventMap["deployment"];
  deployment_status: WebhookEventMap["deployment_status"];
  discussion: WebhookEventMap["discussion"];
  discussion_comment: WebhookEventMap["discussion_comment"];
  fork: WebhookEventMap["fork"];
  gollum: WebhookEventMap["gollum"];
  issue_comment: WebhookEventMap["issue_comment"];
  issues: WebhookEventMap["issues"];
  label: WebhookEventMap["label"];
  milestone: WebhookEventMap["milestone"];
  page_build: WebhookEventMap["page_build"];
  project: WebhookEventMap["project"];
  project_card: WebhookEventMap["project_card"];
  project_column: WebhookEventMap["project_column"];
  public: WebhookEventMap["public"];
  pull_request: WebhookEventMap["pull_request"];
  /**
   * @deprecated use `issue_comment`
   */
  pull_request_comment: WebhookEventMap["issue_comment"];
  pull_request_review: WebhookEventMap["pull_request_review"];
  pull_request_review_comment: WebhookEventMap["pull_request_review_comment"];
  pull_request_target: WebhookEventMap["pull_request"];
  push: WebhookEventMap["push"];
  registry_package: WebhookEventMap["package"];
  release: WebhookEventMap["release"];
  repository_dispatch: WebhookEventMap["repository_dispatch"];
  schedule: object;
  status: WebhookEventMap["status"];
  watch: WebhookEventMap["watch"];
  workflow_call: WebhookEventMap["workflow_dispatch"];
  workflow_dispatch: WebhookEventMap["workflow_dispatch"];
  workflow_run: WebhookEventMap["workflow_run"];
}

export type EnvProps = {
  [name: string]: ExpressionValue<string>;
};

export type GetEventOptions<
  Event extends keyof WorkflowEventOptions,
  Base extends ActionTemplate = ActionTemplate,
> = object extends WorkflowEventOptions[Event]
  ? [options?: WithContext<WorkflowEventOptions[Event], Base> | undefined]
  : [options: WithContext<WorkflowEventOptions[Event], Base>];
// type A = object extends { a?: number } ? "yes" : "no";
export type SetPermissions =
  | PermissionAll
  | Expression<PermissionAll>
  | Permissions;
export type PermissionAll = "read-all" | "write-all";
export type Listed<Type> = Type | readonly Type[] | Type[];
interface ActivityTypes<Action extends string> {
  /**
   * The activity types to trigger on.
   *
   * @defaults - all activity types
   */
  types?: readonly Action[];
}
type WithTypes<Name extends WebhookEventName> = EventPayloadMap[Name] extends
  { action: infer Action extends string } ? ActivityTypes<Action> : {};

export interface WorkflowEventOptions {
  branch_protection_rule: WithTypes<"branch_protection_rule">;
  check_run: WithTypes<"check_run">;
  check_suite: WithTypes<"check_suite">;
  create: WithTypes<"create">;
  delete: WithTypes<"delete">;
  deployment: WithTypes<"deployment">;
  deployment_status: WithTypes<"deployment_status">;
  discussion: WithTypes<"discussion">;
  discussion_comment: WithTypes<"discussion_comment">;
  fork: WithTypes<"fork">;
  gollum: WithTypes<"gollum">;
  issue_comment: WithTypes<"issue_comment">;
  issues: WithTypes<"issues">;
  label: WithTypes<"label">;
  milestone: WithTypes<"milestone">;
  page_build: WithTypes<"page_build">;
  project: WithTypes<"project">;
  project_card: WithTypes<"project_card">;
  project_column: WithTypes<"project_column">;
  public: WithTypes<"public">;
  pull_request: PullRequestOptions;
  /**
   * @deprecated use `issue_comment`
   */
  pull_request_comment: WithTypes<"issue_comment">;
  pull_request_review: WithTypes<"pull_request_review">;
  pull_request_review_comment: WithTypes<"pull_request_review_comment">;
  pull_request_target: PullRequestOptions;
  push: PushOptions;
  registry_package: WithTypes<"package">;
  release: WithTypes<"release">;
  repository_dispatch: WithTypes<"repository_dispatch">;
  schedule: Listed<{ cron: string }>;
  status: WithTypes<"status">;
  watch: WithTypes<"watch">;
  workflow_call: WorkflowCallOptions;
  workflow_dispatch: WorkflowDispatchOptions;
  workflow_run: WorkflowRunOptions;
}

export interface PullRequestOptions
  extends WithTypes<"pull_request">, PushOptions {
}

export interface PushOptions {
  /**
   * When using the push and pull_request events, you can configure a workflow
   * to run on specific branches or tags. For a pull_request event, only
   * branches and tags on the base are evaluated. If you define only tags or
   * only branches, the workflow won't run for events affecting the undefined
   * Git ref.
   *
   * @see
   * https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet
   */
  branches?: readonly string[];
  "branches-ignore"?: readonly string[];

  /**
   * When using the push and pull_request events, you can configure a workflow
   * to run on specific branches or tags. For a pull_request event, only
   * branches and tags on the base are evaluated. If you define only tags or
   * only branches, the workflow won't run for events affecting the undefined
   * Git ref.
   *
   * @see
   * https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet
   */
  tags?: readonly string[];
  "tags-ignore"?: readonly string[];

  /**
   * When using the push and pull_request events, you can configure a workflow
   * to run when at least one file does not match paths-ignore or at least one
   * modified file matches the configured paths. Path filters are not evaluated
   * for pushes to tags.
   *
   * @see
   * https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet
   */
  paths?: readonly string[];
}
export interface WorkflowCallOptions {
  inputs?: Record<string, WorkflowCallInput> | undefined;
  outputs?: Record<string, WorkflowOutput> | undefined;
  secrets?: Record<string, Secret> | undefined;
}

type InputKey<Name extends string, Type> = GenerateKeyObject<
  "input",
  Name,
  Type
>;
export type InputKeys<
  Input extends Record<string, WorkflowDispatchInput>,
  Key extends StringKeyOf<Input> = StringKeyOf<Input>,
> = Key extends string
  ? { inputs: Key } & InputKey<Key, GetInputType<Input[Key]>>
  : never;

type GetInputType<Type extends WorkflowDispatchInput> = Type extends
  StringInput | ChoiceInput | EnvironmentInput ? string
  : Type extends BooleanInput ? boolean
  : Type extends NumberInput ? number
  : never;
type GetInput<Name extends string, Base extends ActionTemplate> = Base extends
  InputKey<Name, infer Type> ? Type : LiteralString;

export interface WorkflowDispatchOptions {
  inputs?: Record<string, WorkflowDispatchInput> | undefined;
}

export interface WorkflowRunOptions
  extends WithTypes<"workflow_run">, PushOptions {
  workflows: Array<string | { name: string }>;
}

export type WorkflowCallInput = StringInput | BooleanInput | NumberInput;
export type WorkflowDispatchInput =
  | WorkflowCallInput
  | ChoiceInput
  | EnvironmentInput;
interface BaseInput {
  require?: boolean | undefined;
  description?: string | undefined;
}
interface StringInput extends BaseInput {
  type: "string";
  default?: string | undefined;
}
interface EnvironmentInput extends BaseInput {
  type: "environment";
  default?: string | undefined;
}
interface BooleanInput extends BaseInput {
  type: "boolean";
  default?: boolean | undefined;
}
interface NumberInput extends BaseInput {
  type: "number";
  default?: number | undefined;
}
interface ChoiceInput extends BaseInput {
  type: "choice";
  options: <Option extends string>() => Option[];
  default?: string | undefined;
}

export interface WorkflowOutput {
  description?: string;
  /**
   * ```ts
   * import {
   *   defineWorkflows,
   *   e,
   *   Workflow,
   * } from "https://deno.land/x/actionify@0.1.0/mod.ts";
   *
   * const main = Workflow
   *   .create({ name: "ci" })
   *   .job(
   *     "main",
   *     (job) => job.outputs({ duration: "100", benchmarkResults: "thumbs up" }),
   *   )
   *   .on("workflow_call", (ctx) => ({
   *     outputs: {
   *       first: { value: e.expr(ctx.jobs.main.outputs.duration) },
   *       second: { value: e.expr(ctx.jobs.main.outputs.benchmarkResults) },
   *     },
   *   }));
   *
   * export default defineWorkflows({
   *   workflows: [main],
   * });
   * ```
   */
  value: string | Expression;
}

export interface Secret {
  description?: string | undefined;
  /** @default false */
  required?: boolean | undefined;
}

export interface Permissions {
  actions?: Permission | Expression<Permission> | undefined;
  checks?: Permission | Expression<Permission> | undefined;
  contents?: Permission | Expression<Permission> | undefined;
  deployments?: Permission | Expression<Permission> | undefined;
  idToken?: Permission | Expression<Permission> | undefined;
  issues?: Permission | Expression<Permission> | undefined;
  discussions?: Permission | Expression<Permission> | undefined;
  packages?: Permission | Expression<Permission> | undefined;
  pages?: Permission | Expression<Permission> | undefined;
  pullRequests?: Permission | Expression<Permission> | undefined;
  repositoryProjects?: Permission | Expression<Permission> | undefined;
  securityEvents?: Permission | Expression<Permission> | undefined;
  statuses?: Permission | Expression<Permission> | undefined;
}

type Permission = "read" | "write" | "none";

export type ContextOutput = unknown;
export interface DefaultsProp {
  run?: {
    shell?: ExpressionValue<`${Shell}`> | undefined;
    "working-directory"?: ExpressionValue<string> | undefined;
  };
}

export enum Shell {
  /**
   * **Supports all platforms**
   *
   * The default shell on non-Windows platforms. Note
   * that this runs a different command to when bash is specified explicitly. If
   * bash is not found in the path, this is treated as `sh`.  `bash -e {0}`
   *
   * The default shell on non-Windows platforms with a fallback to sh. When
   * specifying a bash shell on Windows, the bash shell included with Git for
   * Windows is used. `bash --noprofile --norc -eo pipefail {0}`
   */
  Bash = "bash",
  /**
   * **Supports all platforms**
   *
   * The PowerShell Core. GitHub appends the extension .ps1 to your script name.
   * pwsh -command ". '{0}'"
   */
  PowerShellCore = "pwsh",
  /**
   * **Supports all platforms**
   *
   * Executes the python command.	`python {0}`
   */
  Python = "python",
  /**
   * **macOS and Linux only**
   *
   * The fallback behavior for non-Windows platforms if no shell is provided and
   * bash is not found in the path. `sh -e {0}`
   */
  Sh = "sh",

  /**
   * **Windows only**
   *
   * GitHub appends the extension .cmd to your script name and substitutes for
   * {0}. `%ComSpec% /D /E:ON /V:OFF /S /C "CALL "{0}""`.
   */
  Cmd = "cmd",

  /**
   * **Windows only**
   *
   * The PowerShell Desktop. GitHub appends the extension .ps1 to your script
   * name. `powershell -command ". '{0}'"`.
   */
  PowerShellDesktop = "powershell",
}
