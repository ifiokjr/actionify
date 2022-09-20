import { check, generate, Meta } from "./mod.ts";
import {
  Command,
  CompletionsCommand,
  DenoLandProvider,
  HelpCommand,
  UpgradeCommand,
} from "./src/deps/cli.ts";
import { resolve } from "./src/deps/path.ts";
import { ActionifyError } from "./src/errors.ts";

if (!import.meta.main) {
  throw new ActionifyError("The cli should not be imported as a module");
}

const main = new Command()
  .name("actionify")
  .description(
    "Generate reusable GitHub Action workflow files with TypeScript.",
  )
  .version(Meta.VERSION)
  .globalOption(
    "-c, --config [config:string]",
    "The path to the TypeScript configuration file",
    { default: "./.github/actionify.ts" },
  )
  .globalOption(
    "-o, --output [output:string]",
    "The path to the folder containing the generated workflow `.yml` files.",
    { default: "./.github/workflows" },
  )
  .action(async (options) => {
    const { output, config } = options;
    const configPath = typeof config === "string"
      ? resolve(config)
      : resolve("./.github/actionify.ts");
    const rootDirectory = typeof output === "string"
      ? resolve(output)
      : resolve("./.github/workflows");

    const { default: workflowConfig } = await import(configPath);

    await generate({ ...workflowConfig, rootDirectory });
  })
  .command("check")
  .description(
    "Check that the workflows configurations are up to date with .yml files.",
  )
  .action(async (options) => {
    const { output, config } = options;
    const configPath = typeof config === "string"
      ? resolve(config)
      : resolve("./.github/actionify.ts");
    const rootDirectory = typeof output === "string"
      ? resolve(output)
      : resolve("./.github/workflows");

    const { default: workflowConfig } = await import(configPath);
    const result = await check({ ...workflowConfig, rootDirectory });

    if (result) {
      console.warn(result);
      Deno.exit(1);
    }
  });

const upgrade = new UpgradeCommand({
  main: "cli.ts",
  provider: new DenoLandProvider(),
  args: ["--unstable", "-A", "-n", "actionify"],
});

main
  .command("upgrade", upgrade)
  .command("help", new HelpCommand().global())
  .command("completions", new CompletionsCommand());

await main.parse(Deno.args);
