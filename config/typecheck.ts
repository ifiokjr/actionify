import { globber } from "./deps.ts";
import { cwd } from "./helpers.ts";

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

const result = await Deno.run({
  cmd: ["deno", "--unstable", "check", ...files],
  stdout: "inherit",
  stdin: "inherit",
  stderr: "inherit",
}).status();

if (!result.success) {
  Deno.exit(result.code);
}
