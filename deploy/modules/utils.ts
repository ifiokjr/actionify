import { isNumber } from "../../src/deps/just.ts";

export const ACTIONS_PREFIX = "_actions/";

const accepted = ["text/html", "application/xhtml+xml", "application/xml"];

export function supportsHtmlResponse(headers: Headers) {
  return accepted.some((text) => headers.get("Accept")?.includes(text));
}

interface TransformResponseProps {
  response: Response;
  shouldCache: boolean;
  org: string;
  repo: string;
  version: string;
  supportHtml: boolean;
}

export function transformResponse(props: TransformResponseProps) {
  const { response, shouldCache, org, repo, version, supportHtml } = props;
  const headers = new Headers(response.headers);
  if (shouldCache) {
    headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  } else {
    headers.set("Cache-Control", "no-cache");
  }

  headers.set("Vary", "Origin, Accept-Encoding, User-Agent");

  if (supportHtml) {
    headers.set("Content-Type", "application/javascript; charset=utf-8");
  } else {
    headers.set("Content-Type", "application/typescript; charset=utf-8");
  }

  headers.set("Accept-Ranges", "bytes");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  );
  headers.set(
    "Content-Disposition",
    `inline; filename=${org}__${repo}@${version}.ts`,
  );

  return new Response(response.body, { headers, status: 200 });
}

export function createEnv<Required extends string, Optional extends string>(
  required: readonly Required[],
  optional: readonly Optional[] = [],
): { [Key in Required]: string } & { [Key in Optional]?: string } {
  const env = Object.create(null);

  for (const name of required) {
    const value = Deno.env.get(name);

    if (!value) {
      throw new Error(`Missing environment variable: '${name}'`);
    }

    env[name] = value;
  }

  for (const name of optional) {
    const value = Deno.env.get(name);
    env[name] = value;
  }

  return env;
}

/**
 * This is a shortcut for creating `application/json` responses. Converts `data`
 * to JSON and sets the `Content-Type` header.
 */
export function json<Data = object>(
  data: Data,
  init: number | ResponseInit = {},
): Response {
  let responseInit: ResponseInit = {};

  if (isNumber(init)) {
    responseInit = { status: init };
  } else if (typeof init?.status === "undefined") {
    responseInit.status = 200;
  }

  const headers = new Headers(responseInit.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers,
  });
}
