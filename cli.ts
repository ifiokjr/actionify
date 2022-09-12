import { generate, Meta } from "./mod.ts";
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
  .option(
    "-c, --config [config:string]",
    "The path to the TypeScript configuration file",
    { default: "./.github/actionify.ts" },
  )
  .option(
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
