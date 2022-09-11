import { join } from "./deps/path.ts";
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

export type WorkflowOutput = Replace<
  Required<DefineWorkflowsProps>,
  { rootDirectory: string }
>;

export function defineWorkflows(
  props: DefineWorkflowsProps,
): WorkflowOutput {
  return {
    ...props,
    cleanupRoot: !!props.cleanupRoot,
    rootDirectory: getRootDirectory(props.rootDirectory),
  };
}

export function getRootDirectory(root: string | URL | undefined): string {
  return root instanceof URL
    ? root.pathname
    : root?.startsWith("file:")
    ? new URL(root).pathname
    : join(Deno.cwd(), typeof root === "string" ? root : "./.github/workflows");
}
