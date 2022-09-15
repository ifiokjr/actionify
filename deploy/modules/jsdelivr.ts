const DATA_JSDELIVR = "https://data.jsdelivr.com/v1/package/gh/";
const CDN_JSDELIVR = "https://cdn.jsdelivr.net/gh/";
interface JsDelivrVersions {
  tags: Record<string, string>;
  versions: string[];
}

export async function getFilesList(
  props: Required<SearchJsDelivrProps>,
): Promise<JsDelivrFile[]> {
  const url =
    `${DATA_JSDELIVR}${props.org}/${props.repo}@${props.version}/flat`;
  const response = await fetch(url);
  const json = await response.json();

  return json.files;
}

export function getCdnUrl(
  props: Required<SearchJsDelivrProps> & { path: string },
) {
  return new URL(
    `${props.org}/${props.repo}@${props.version}${props.path}`,
    CDN_JSDELIVR,
  );
}

/**
 * Use this when no version is provided.
 */
export async function getLatestVersion(
  org: string,
  repo: string,
): Promise<string | undefined> {
  const response = await fetch(`${DATA_JSDELIVR}${org}/${repo}`);
  const json: JsDelivrVersions = await response.json();
  return json.versions.at(0);
}

interface SearchJsDelivrProps {
  org: string;
  repo: string;
  version?: string;
}
interface JsDelivrFile {
  name: string;
  hash: string;
  time: string;
  size: number;
}
