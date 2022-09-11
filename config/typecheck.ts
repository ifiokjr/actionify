import { globber } from "./deps.ts";
import { cwd } from "./helpers.ts";

const files: string[] = [];
const entries = globber({
  cwd,
  include: [
    "deploy/**/*.{ts,tsx}",
    "config/**/*.ts",
    "tests/**/*test.ts",
    "mod.ts",
  ],
  exclude: ["**/fixtures", "**/snapshots"],
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
