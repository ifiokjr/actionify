import { Meta } from "../mod.ts";
import * as path from "../src/deps/path.ts";
import { globber, semver } from "./deps.ts";

const cwd = new URL("../", import.meta.url).pathname;
const importMapPath = path.join(cwd, "tests/test_docs_import_map.json");

const releaseTypes = [
  "pre",
  "major",
  "premajor",
  "minor",
  "preminor",
  "patch",
  "prepatch",
  "prerelease",
] as const;

try {
  const imports: Record<string, string> = {
    "https://deno.land/x/actionify@<%=it.version%>/": cwd,
    "https://deno.land/x/actionify/": cwd,
    [`https://deno.land/x/actionify@${Meta.VERSION}/`]: cwd,
  };

  for (const type of releaseTypes) {
    imports[
      `https://deno.land/x/actionify@${semver.inc(Meta.VERSION, type)}/`
    ] = cwd;
  }

  const importMap = { imports };
  const files = [];

  for await (
    const file of globber({
      cwd,
      extensions: [".ts", ".md"],
      exclude: ["**/fixtures/", "**/tests/", "**/config/"],
      excludeDirectories: true,
    })
  ) {
    files.push(file.relative);
  }

  await Deno.writeTextFile(importMapPath, JSON.stringify(importMap));

  await Deno
    .run({
      cmd: [
        "deno",
        "test",
        "--doc",
        "--check",
        `--allow-read=${cwd}`,
        `--import-map=${importMapPath}`,
        ...files,
      ],
      cwd,
    }).status();
} finally {
  await Deno.remove(importMapPath);
}
