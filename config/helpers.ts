import { gitUrlParse, readLines, semver } from "./deps.ts";

function clean(version: string) {
  return semver.parse(version.trim().replace(/^[=v]+/, ""))?.version;
}

export async function getTagVersion(cwd = Deno.cwd()): Promise<string> {
  let version = "0.0.0";
  const stdout = Deno.run({ cmd: ["git", "tag"], cwd, stdout: "piped" }).stdout;

  try {
    for await (const line of readLines(stdout)) {
      const cleaned = clean(line) ?? version;
      version = semver.gt(cleaned, version) ? cleaned : version;
    }
  } catch {
    // Do nothing
  }

  return version;
}

/**
 * Get the currently checked out commit sha.
 */
export async function getCurrentCommit(cwd = Deno.cwd()): Promise<string> {
  const stdout = await Deno.run({
    cmd: ["git", "rev-parse", "HEAD"],
    cwd,
    stdout: "piped",
  }).output();

  return new TextDecoder().decode(stdout).trim();
}

export async function gitCheckoutOrCreate(name: string) {
  // try to checkout out
  const result = await Deno.run({
    cmd: ["git", "checkout", name],
    cwd: cwd.pathname,
  }).status();

  if (result.success) {
    return;
  }

  await Deno.run({
    cmd: ["git", "checkout", "-b", name],
    cwd: cwd.pathname,
  }).status();
}

/**
 * Read the remote URL.
 */
export async function getGitHubRemote(cwd = Deno.cwd()): Promise<GitHubRemote> {
  const stdout = await Deno.run({
    cmd: ["git", "remote", "get-url", "origin"],
    cwd,
    stdout: "piped",
  }).output();
  const remote = new TextDecoder().decode(stdout);
  const parsed = gitUrlParse(remote);

  return {
    fullName: parsed.full_name,
    href: `https://${parsed.source}/${parsed.full_name}/`,
    name: parsed.name,
    owner: parsed.owner,
  };
}

interface GitHubRemote {
  owner: string;
  name: string;
  fullName: string;
  href: string;
}

/**
 * Read the first commit in the commit history.
 */
export async function getFirstCommit(cwd = Deno.cwd()) {
  const stdout = await Deno.run({
    cmd: ["git", "rev-list", "--max-parents=0", "HEAD"],
    cwd,
    stdout: "piped",
  }).output();
  const ref = new TextDecoder().decode(stdout);

  return ref.slice(0, 7);
}

/**
 * Create a tag for the provided version.
 */
export function createTag(
  version: string,
  cwd = Deno.cwd(),
): Promise<Deno.ProcessStatus> {
  if (!semver.valid(version)) {
    throw new Error(`Invalid tag version provided: ${version}`);
  }

  // NOTE: it's important we use the -m flag to create annotated tag otherwise
  // 'git push --follow-tags' won't actually push the tags
  return Deno
    .run({ cmd: ["git", "tag", "version", "-m", version], cwd })
    .status();
}

export async function gitReset(
  ref: string,
  mode: "hard" | "soft" | "mixed" = "hard",
) {
  await Deno.run({
    cmd: ["git", "reset", `--${mode}`, ref],
    cwd: cwd.pathname,
    stdout: "inherit",
  }).status();
}

export const cwd = new URL("..", import.meta.url);
