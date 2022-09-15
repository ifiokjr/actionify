import { type DefineWorkflowOutput } from "./config.ts";
import { emptyDir, ensureDir } from "./deps/fs.ts";
import { join } from "./deps/path.ts";
import { dump } from "./deps/yaml.ts";
import { VERSION } from "./meta.ts";

const MESSAGE =
  `# This file was autogenerated with actionify@${VERSION}\n# To update run: \n# deno run -Ar https://deno.land/x/actionify@0.2.0/cli.ts`;

export async function generate(
  props: DefineWorkflowOutput,
): Promise<void> {
  const { cleanupRoot, rootDirectory, workflows } = props;
  if (cleanupRoot) {
    await emptyDir(rootDirectory);
  } else {
    await ensureDir(rootDirectory);
  }

  const promises: Array<Promise<void>> = [];

  for (const workflow of workflows) {
    const output = dump(JSON.parse(JSON.stringify(workflow.toJSON())), {
      lineWidth: 100,
    });
    promises.push(Deno.writeTextFile(
      join(props.rootDirectory, `${workflow.fileName}.yml`),
      `${MESSAGE}\n\n${output}`,
    ));
  }

  await Promise.all(promises);
}
