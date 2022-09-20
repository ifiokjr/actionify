import { type DefineWorkflowOutput } from "./config.ts";
import { emptyDir, ensureDir } from "./deps/fs.ts";
import { join } from "./deps/path.ts";
import { dump } from "./deps/yaml.ts";
import { VERSION } from "./meta.ts";

const MESSAGE =
  `# This file was autogenerated with actionify@${VERSION}\n# To update run: \n# deno run -Ar https://deno.land/x/actionify@0.3.0/cli.ts`;

export async function generate(props: DefineWorkflowOutput): Promise<void> {
  const { cleanupRoot, rootDirectory } = props;
  if (cleanupRoot) {
    await emptyDir(rootDirectory);
  } else {
    await ensureDir(rootDirectory);
  }

  const generated = generateWorkflows(props);
  const promises: Array<Promise<void>> = [];

  for (const [name, json] of generated) {
    const output = dump(json, { lineWidth: 100 });

    promises.push(Deno.writeTextFile(
      join(props.rootDirectory, `${name}.yml`),
      `${MESSAGE}\n\n${output}`,
    ));
  }

  await Promise.all(promises);
}

type Name = string;
type Json = object;

/**
 * Generate the workflows.
 */
export function generateWorkflows(
  props: DefineWorkflowOutput,
): Map<Name, Json> {
  const map = new Map<Name, Json>();

  for (const workflow of props.workflows) {
    map.set(workflow.fileName, JSON.parse(JSON.stringify(workflow.toJSON())));
  }

  return map;
}
