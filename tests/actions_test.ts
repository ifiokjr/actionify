import { generateTypeScriptFromAction } from "https://deno.land/x/actionify@0.1.0/mod.ts";
import { emptyDir, ensureDir } from "../src/deps/fs.ts";
import { assert } from "./deps.ts";
import { snapshot } from "./helpers.ts";

Deno.test("generate TypeScript module from cache.yml", async (t) => {
  const result = await generateTypeScriptFromAction(
    import.meta.resolve("./fixtures/actions/cache.yml"),
    "actions/cache@3.0.8",
  );

  await snapshot(t, result);
  await assertCanRun(
    result,
    { path: "this/is/awesome", key: "this is a key" },
    {},
    "cache",
  );
});

Deno.test("generate TypeScript module from checkout.yml", async (t) => {
  const result = await generateTypeScriptFromAction(
    import.meta.resolve("./fixtures/actions/checkout.yml"),
    "actions/checkout@3.0.2",
  );

  await snapshot(t, result);

  await assertCanRun(result, { ref: "main" }, { reff: "" }, "checkout");
});

async function assertCanRun(
  content: string,
  props: object,
  failingProps: object,
  name: string,
) {
  const pathToMod = import.meta.resolve("../mod.ts");
  const action = `\
import testStep from "./test_step.ts";
import { workflow, defineWorkflows } from "${pathToMod}";

const test = workflow({ name: "test" })
  .on("push")
  .job("awesome", (job) => {
    return job
      .runsOn("ubuntu-latest")
      .step(testStep(${JSON.stringify(props)}))
      // @ts-expect-error for the purpose of the test.
      .step(testStep(${JSON.stringify(failingProps)}));
  });

export default defineWorkflows({
  workflows: [test],
  rootDirectory: import.meta.resolve("./"),
});
`;
  const root = new URL(import.meta.resolve(`./fixtures/tmp/${name}/`));
  const cliPath = new URL(import.meta.resolve("../cli.ts"));

  await ensureDir(root);
  const contentPath = new URL("./test_step.ts", root);
  const actionPath = new URL("./actionify.ts", root);

  await Deno.writeTextFile(contentPath, content);
  await Deno.writeTextFile(actionPath, action);

  const checkProcess = Deno.run({
    cwd: root.pathname,
    cmd: ["deno", "check", "-r", actionPath.pathname],
    stderr: "null",
    stdout: "null",
  });
  const checkStatus = await checkProcess.status();
  checkProcess.close();

  assert(checkStatus.success, "should successfully typecheck");

  const buildProcess = Deno.run({
    cwd: root.pathname,
    stderr: "null",
    stdout: "null",
    cmd: [
      "deno",
      "run",
      "-Ar",
      cliPath.pathname,
      "-c",
      actionPath.pathname,
      "-o",
      root.pathname,
    ],
  });
  const buildStatus = await buildProcess.status();
  buildProcess.close();

  assert(buildStatus.success, "should be able to use the custom module");
  await emptyDir(root);
}
