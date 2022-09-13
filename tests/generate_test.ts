import { generate } from "../mod.ts";
import type { DefineWorkflowOutput } from "../src/config.ts";
import { path } from "./deps.ts";
import { snapshot } from "./helpers.ts";

for await (
  const example of Deno.readDir(new URL(import.meta.resolve("../examples")))
) {
  if (!example.isDirectory) {
    continue;
  }

  Deno.test(`${example.name}`, async (t) => {
    const result = await import(
      import.meta.resolve(`../examples/${example.name}/actionify.ts`)
    );
    const workflows: DefineWorkflowOutput = result.default;
    await generate(workflows);
    const content = new Map<string, string>();

    for await (const entry of Deno.readDir(workflows.rootDirectory)) {
      if (!entry.isFile || !entry.name.endsWith(".yml")) {
        continue;
      }

      content.set(
        entry.name,
        await Deno.readTextFile(path.join(workflows.rootDirectory, entry.name)),
      );
    }

    const entries = Object.entries(content).sort((a, z) => {
      return a[0].localeCompare(z[0]);
    });

    for (const [, text] of entries) {
      await snapshot(t, text);
    }
  });
}
