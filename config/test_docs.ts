import mainImportMap from "../import_map.json" assert { type: "json" };
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

let status = 0;

try {
  const imports: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(mainImportMap.imports).map((
        [key, path],
      ) => [key, path.startsWith("./") ? path.replace(/^\.\//, "../") : path]),
    ),
    "https://deno.land/x/actionify@<%=it.version%>/": cwd,
    "https://deno.land/x/actionify@0.1.0/": cwd,
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
      include: [".github/", "src/", "mod.ts", "readme.md"],
      extensions: [".ts", ".md", ".tsx"],
      dot: true,
      excludeDirectories: true,
    })
  ) {
    files.push(file.relative);
  }

  await Deno.writeTextFile(importMapPath, JSON.stringify(importMap));

  const result = await Deno
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

  status = result.code;
} finally {
  await Deno.remove(importMapPath);
}

Deno.exit(status);
