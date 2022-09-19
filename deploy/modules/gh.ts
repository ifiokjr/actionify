import { BackBlaze } from "./backblaze.ts";
import { env } from "./env.ts";

const GITHUB_CONTENT = "https://raw.githubusercontent.com/";
const bucketId = env.BACKBLAZE_BUCKET_ID;
const bucketName = env.BACKBLAZE_BUCKET_NAME;
const applicationKey = env.BACKBLAZE_SECRET;
const applicationKeyId = env.BACKBLAZE_ID;

export function getCdnUrl(
  props: Required<SearchJsDelivrProps> & { path: string },
) {
  return new URL(
    `${props.org}/${props.repo}@${props.version}${props.path}`,
    GITHUB_CONTENT,
  );
}

/**
 * Use this when no version is provided.
 */
export async function getVersions(
  org: string,
  repo: string,
): Promise<string[]> {
  let versions: string[] = [];
  const headers = new Headers({
    "Accept": "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  });
  const response = await fetch(
    `https://api.github.com/repos/${org}/${repo}/tags`,
    { headers },
  );

  const fileName = `meta/${org}/${repo}/versions.json`;
  const blaze = new BackBlaze({ applicationKey, applicationKeyId });
  await blaze.authorizeAccount();

  async function loadCachedVersions(): Promise<string[]> {
    const response = await fetch(blaze.fileUrl(bucketName, fileName));
    return response.ok ? await response.json() : [];
  }

  if (response.ok) {
    const json: Array<{ name: string }> = await response.json();
    versions = json.map((value) => value.name);
    const versionsBinary = new TextEncoder().encode(JSON.stringify(versions));

    // store in backblaze for rate limiting
    await blaze.upload(versionsBinary, {
      bucketId,
      fileName,
      contentType: "application/json; charset=utf-8",
      contentLength: versionsBinary.length,
    });
  } else {
    versions = await loadCachedVersions();
  }

  return versions;
}

export async function getLatestVersion(
  org: string,
  repo: string,
): Promise<string | undefined> {
  const versions = await getVersions(org, repo);
  return versions.at(0);
}

interface SearchJsDelivrProps {
  org: string;
  repo: string;
  version?: string;
}
