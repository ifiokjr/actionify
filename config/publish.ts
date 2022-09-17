import { Meta } from "../mod.ts";
import { getLogger, globber, semver } from "./deps.ts";
import {
  cwd,
  getCurrentCommit,
  getGitHubRemote,
  getTagVersion,
} from "./helpers.ts";
import { seedPopularActions } from "./seed.ts";

const logger = getLogger();
const token = Deno.env.get("GITHUB_TOKEN") ?? "";

async function shouldPublish() {
  const taggedVersion = await getTagVersion(cwd.pathname);
  return semver.lt(taggedVersion, Meta.VERSION);
}

async function hasRelease(): Promise<boolean> {
  const remote = await getGitHubRemote(cwd.pathname);

  try {
    const headers = new Headers();
    headers.set("Accept", "application/vnd.github+json");
    headers.set("Authorization", `token ${token}`);
    const response = await fetch(
      `https://api.github.com/repos/${remote.owner}/${remote.name}/releases/tags/${Meta.VERSION}`,
    );

    return response.status === 200;
  } catch (error) {
    logger.error(error);
    return false;
  }
}

async function getBodyMarkdown() {
  const iterator = globber({
    cwd,
    include: ["changelog.md"],
    caseInsensitive: true,
    excludeDirectories: true,
  });

  let contents = "";
  let path = "";

  for await (const entry of iterator) {
    path = entry.absolute;
    contents = await Deno.readTextFile(path);
    break;
  }

  return contents.split(`## ${Meta.VERSION}`).at(1)?.split(/^##\s+/gm).at(0)
    ?.match(
      /(?<=^>\s\[[\d]{4}-[\d]{2}-[\d]{2}\]\([-\w\d()@:%_\+.~#?&//=]+\)\s+).+/gms,
    )?.at(0);
}

async function createRelease() {
  const remote = await getGitHubRemote(cwd.pathname);
  try {
    const headers = new Headers();
    headers.set("Accept", "application/vnd.github+json");
    headers.set("Authorization", `token ${token}`);

    const request = new Request(
      `https://api.github.com/repos/${remote.owner}/${remote.name}/releases`,
      {
        method: "POST",
        body: JSON.stringify({
          tag_name: Meta.VERSION,
          name: Meta.VERSION,
          body: await getBodyMarkdown(),
          target_commitish: await getCurrentCommit(cwd.pathname),
          draft: false,
          prerelease: false,
          discussion_category_name: undefined,
          generate_release_notes: false,
        }),
        headers,
      },
    );

    const response = await fetch(request);
    const json = await response.json();

    if (response.status !== 200 && json.documentation_url && json.message) {
      logger.warning(`See more: ${json.documentation_url}`);
      logger.error(json.message);
      return;
    } else {
      logger.info("Created release successfully");
      logger.debug(json);
    }
  } catch (error) {
    logger.critical(error);
    Deno.exit(1);
  }
}

async function run() {
  if (!(await shouldPublish()) || await hasRelease()) {
    logger.info("No versions to publish");
    return;
  }

  logger.warning("Publishing latest version");
  await createRelease();
  logger.info(`🚀 Successfully published version: ${Meta.VERSION}`);

  logger.info("Seeding popular actions...");
  await seedPopularActions();
  logger.info("✨ Successfully seeded actions");
}

if (import.meta.main) {
  await run();
}
