// For now this should be run locally. Unless able to setup a github action that can do it

import { Meta } from "../mod.ts";
import {
  getLogger,
  globber,
  objectEntries,
  objectKeys,
  parse,
  semver,
  type Token,
  tokens,
} from "./deps.ts";
import { cwd, getFirstCommit, getGitHubRemote } from "./helpers.ts";

const log = getLogger();
const args = parse(Deno.args, { boolean: ["promote"] });
const VERSION_KEYWORDS = {
  major: ["Major", "Breaking", "BREAKING", "MAJOR", "💣", "💥"],
  minor: ["Features", "Feature", "Minor", "🎉", "✨"],
  patch: ["Fix", "Patch", "Other", "🐛"],
} as const;
const REGISTRY_REGEX = new RegExp(
  `https://deno.land/x/${Meta.NAME}(?:@.*)?/`,
  "g",
);
const RELEASES = objectKeys(VERSION_KEYWORDS);

interface ChangelogVersion {
  /**
   * The string in the changelog file.
   */
  contents: string;

  /**
   * The absolute path to the changelog file.
   */
  path: string;

  /**
   * The new version.
   */
  version: string;
}

/**
 * Get the upgrade version.
 */
export async function getChangelogVersion(
  cwd: string | URL,
): Promise<ChangelogVersion | undefined> {
  // Major upgrades are only supported once version 1.0.0 is reached or the
  // `--promote` flag is added when running the script.
  const supportsMajor = semver.gte(Meta.VERSION, "1.0.0") || args.promote;

  // Search for the file.
  const iterator = globber({
    cwd,
    include: ["changelog.md"],
    caseInsensitive: true,
    excludeDirectories: true,
  });

  let tokenized: Token[] = [];
  let contents = "";
  let path = "";
  let versionChange: keyof typeof VERSION_KEYWORDS | undefined;

  for await (const entry of iterator) {
    path = entry.absolute;
    contents = await Deno.readTextFile(path);
    tokenized = tokens(contents, {});
    break;
  }

  if (!path) {
    path = new URL("changelog.md", cwd).pathname;
  }

  if (!contents) {
    const url = new URL(cwd);
    const remote = await getGitHubRemote(url.pathname);
    const firstCommit = await getFirstCommit(url.pathname);
    const nextUrl = new URL(`compare/${firstCommit}...HEAD`, remote.href).href;
    contents = `# Changelog\n\n## Unreleased\n\n> [Compare](${nextUrl})\n`;
    log.info("Creating the changelog.md", path, contents);
    await Deno.writeTextFile(path, contents);
  }

  for (let index = 0; index < tokenized.length; index++) {
    const token = tokenized[index];

    if (!token) {
      break;
    }

    const nextToken = tokenized[index + 1];
    index += 2;

    if (
      token.type !== "start" || token.tag !== "heading" || token.level !== 2 ||
      nextToken?.type !== "text" || nextToken.content !== "Unreleased"
    ) {
      continue;
    }

    for (index; index < tokenized.length; index++) {
      const token = tokenized[index];

      if (
        !token ||
        (token.type === "start" && token.tag === "heading" && token.level === 2)
      ) {
        break;
      }

      if (token.type !== "text") {
        continue;
      }

      for (const [name, words] of objectEntries(VERSION_KEYWORDS)) {
        if (
          words.some((word) => token.content.includes(word)) &&
          (
            !versionChange ||
            RELEASES.indexOf(name) > RELEASES.indexOf(versionChange)
          )
        ) {
          versionChange = name;
        }

        if (versionChange === "major") {
          break;
        }
      }

      if (versionChange === "major") {
        break;
      }
    }

    break;
  }

  if (!versionChange) {
    return;
  }

  if (versionChange === "major" && !supportsMajor) {
    versionChange = "minor";
  }

  const version = semver.inc(Meta.VERSION, versionChange) ?? undefined;

  return version ? { version, contents, path } : undefined;
}

/**
 * Replace `Unreleased` with the version. And add the date also.
 */
async function updateChangelog(props: ChangelogVersion) {
  const date = new Date().toISOString().split("T").at(0);
  const remote = await getGitHubRemote(cwd.pathname);
  let previousVersion: string = Meta.VERSION;
  previousVersion = previousVersion === "0.0.0"
    ? await getFirstCommit(cwd.pathname)
    : previousVersion;
  const nextUrl = new URL(`compare/${props.version}...HEAD`, remote.href).href;
  const previousUrl =
    new URL(`compare/${previousVersion}...${props.version}`, remote.href).href;

  const content = props.contents.replace(
    /^##\s+Unreleased\s+>\s+\[Compare\]\(.+\)/gmi,
    `## Unreleased \n\n> [Compare](${nextUrl})\n\n## ${props.version}\n\n> [${date}](${previousUrl})`,
  );

  await Deno.writeTextFile(props.path, content);
}

async function updateMeta(props: ChangelogVersion) {
  const iterator = globber({ cwd, include: ["**/meta.ts"] });

  for await (const entry of iterator) {
    const contents = await Deno.readTextFile(entry.absolute);
    const updated = contents.replace(
      /export const VERSION\s*=\s*["'`]\d+.\d+.\d+["'`]/,
      `export const VERSION = "${props.version}"`,
    );
    await Deno.writeTextFile(entry.absolute, updated);
    break;
  }
}

async function updateMarkdownFiles(props: ChangelogVersion) {
  const iterator = globber({
    cwd,
    exclude: ["changelog.md"],
    caseInsensitive: true,
    extensions: [".md", ".json", ".ts"],
  });

  const promises: Array<Promise<void>> = [];

  for await (const entry of iterator) {
    promises.push(
      Deno.readTextFile(entry.absolute).then(async (contents) => {
        const updated = contents.replace(
          REGISTRY_REGEX,
          `https://deno.land/x/${Meta.NAME}@${props.version}/`,
        );

        await Deno.writeTextFile(entry.absolute, updated);
      }),
    );
  }

  await Promise.all(promises);
}

async function main() {
  const value = await getChangelogVersion(cwd);

  if (!value) {
    log.warning("No version upgrade necessary.");
  } else {
    await Promise.all([
      updateChangelog(value),
      updateMeta(value),
      updateMarkdownFiles(value),
    ]);
  }
}

if (import.meta.main) {
  await main();
}
