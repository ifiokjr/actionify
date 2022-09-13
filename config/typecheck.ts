import { globber, parse } from "./deps.ts";
import { cwd } from "./helpers.ts";

const args = parse(Deno.args, { boolean: ["reload"] });
const files: string[] = [];
const entries = globber({
  cwd,
  include: [
    "config/",
    "mod.ts",
    "cli.ts",
    "src/",
    "tests/",
    ".github/",
    "examples/",
    // TODO(@ifiokjr): enabling causes a type check error
    // "deploy/",
  ],
  extensions: [".ts", ".tsx"],
  exclude: ["**/fixtures", "**/snapshots", "config/twind.config.ts"],
  excludeDirectories: true,
});

for await (const entry of entries) {
  files.push(entry.absolute);
}

const reload = args.reload ? ["-r"] : [];

const result = await Deno.run({
  cmd: ["deno", "check", ...reload, ...files],
  stdout: "inherit",
  stdin: "inherit",
  stderr: "inherit",
}).status();

if (!result.success) {
  Deno.exit(result.code);
}
