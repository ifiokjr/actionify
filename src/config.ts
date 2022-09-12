import { join } from "./deps/path.ts";
import { VERSION } from "./meta.ts";
import { AnyWorkflow } from "./workflow.ts";

type Replace<Type, Replacement extends object> =
  & Omit<Type, keyof Replacement>
  & Replacement;

export interface DefineWorkflowsProps {
  /**
   * Set to `true` to clean the directory before generating the workflow files.
   *
   * @default false
   */
  cleanupRoot?: boolean | undefined;

  /**
   * The location to place the generated files.
   *
   * @default `<CWD>/.github/workflows`
   */
  rootDirectory?: string | URL;

  /**
   * The workflow definitions which will be placed into the root directory.
   */
  workflows: AnyWorkflow[];
}

const $$_ID_$$ = Symbol.for("WorkflowOutput");

interface WorkflowMeta extends DefineWorkflowsProps {
  /** The version used to create this workflow */
  version: string;
  readonly $$_ID_$$: typeof $$_ID_$$;
}
export type DefineWorkflowOutput = Replace<
  Required<WorkflowMeta>,
  { rootDirectory: string }
>;

export function defineWorkflows(
  props: DefineWorkflowsProps,
): DefineWorkflowOutput {
  return {
    ...props,
    cleanupRoot: !!props.cleanupRoot,
    rootDirectory: getRootDirectory(props.rootDirectory),
    version: VERSION,
    $$_ID_$$,
  };
}

/**
 * Check that the exported
 */
export function isWorkflowOutput(
  value: unknown,
): value is DefineWorkflowOutput {
  return typeof value === "object" &&
    (value as PlainObject).$$_ID_$$ === $$_ID_$$;
}

type PlainObject = Record<string, unknown>;

export function getRootDirectory(root: string | URL | undefined): string {
  return root instanceof URL
    ? root.pathname
    : root?.startsWith("file:")
    ? new URL(root).pathname
    : join(Deno.cwd(), typeof root === "string" ? root : "./.github/workflows");
}
