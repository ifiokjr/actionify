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

    for await (const entry of Deno.readDir(workflows.rootDirectory)) {
      if (!entry.isFile) {
        continue;
      }

      await snapshot(
        t,
        await Deno.readTextFile(path.join(workflows.rootDirectory, entry.name)),
      );
    }
  });
}
