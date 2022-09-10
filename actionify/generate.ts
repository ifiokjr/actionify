import { type WorkflowOutput } from "./config.ts";
import { emptyDir, ensureDir } from "./deps/fs.ts";
import { join } from "./deps/path.ts";

export async function generate(
  props: WorkflowOutput,
): Promise<void> {
  const { cleanupRoot, rootDirectory, workflows } = props;
  if (cleanupRoot) {
    await emptyDir(rootDirectory);
  } else {
    await ensureDir(rootDirectory);
  }

  const promises: Array<Promise<void>> = [];

  for (const workflow of workflows) {
    promises.push(Deno.writeTextFile(
      join(props.rootDirectory, `${workflow.fileName}.yml`),
      JSON.stringify(workflow.toJSON(), null, 2),
    ));
  }

  await Promise.all(promises);
}
