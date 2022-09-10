import { join } from "../deps/path.ts";
import { generate } from "../mod.ts";
import { describe, it } from "./deps.ts";
import { snapshot } from "./helpers.ts";

describe("generate", () => {
  it("basic", async (t) => {
    const { default: workflows } = await import("./fixtures/basic/mod.ts");
    await generate(workflows);

    for await (const entry of Deno.readDir(workflows.rootDirectory)) {
      if (!entry.isFile) {
        continue;
      }

      await snapshot(
        t,
        await Deno.readTextFile(join(workflows.rootDirectory, entry.name)),
      );
    }
  });
});
