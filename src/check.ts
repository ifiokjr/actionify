import type { DefineWorkflowOutput } from "./config.ts";
import { globber } from "./deps/fs.ts";
import { generateWorkflows } from "./generate.ts";

import { isObject } from "./deps/just.ts";
import { dump, load } from "./deps/yaml.ts";
import { unifiedDiff } from "./diff.ts";

export async function check(props: DefineWorkflowOutput) {
  const expectedMap = generateWorkflows(props);
  const actualMap = new Map<string, object>();
  const entries = globber({
    cwd: props.rootDirectory,
    extensions: [".yml"],
    excludeDirectories: true,
    maxDepth: 1,
  });

  for await (const entry of entries) {
    const name = entry.name.replace(/\.yml$/, "");
    const contents = await Deno.readTextFile(entry.absolute);
    const data = load(contents);

    actualMap.set(name, isObject(data) ? data : {});
  }

  function getComparisonString(map: Map<string, object>) {
    return [...map.entries()]
      .map(([name, object]) =>
        `File: ${name}.yml\n${dump(object, { lineWidth: 100 })}`
      )
      .join("\n\n");
  }

  const expected = getComparisonString(expectedMap);
  const actual = getComparisonString(actualMap);

  return unifiedDiff(actual, expected);
}
