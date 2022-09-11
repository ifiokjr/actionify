import { generate } from "./mod.ts";
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
  .arguments("[config:string]")
  .option(
    "-o, --output [output:string]",
    "The path to the output default so <CWD>/.github/workflows",
    { default: "./.github/workflows" },
  ).action(async (options, config = "./.github/actionify.ts") => {
    const { output } = options;
    const configPath = resolve(config);
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
