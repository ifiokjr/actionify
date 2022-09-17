// Copyright 2022 the Deno authors. All rights reserved. MIT license.

import { RouteConfig } from "$fresh/server.ts";
import { accepts } from "oak_commons";

interface RegistryDefVariable {
  key: string;
  documentation?: string;
  url: string;
}

interface RegistryDef {
  schema: string;
  variables: RegistryDefVariable[];
}

interface RegistryConfig {
  version: 1 | 2;
  registries: RegistryDef[];
}

const MAX_AGE_1_DAY = "max-age=86400";

/** This is the v2 registry configuration which provides documentation
 * endpoints and allows incremental completion/search of variables. */
const configV2: RegistryConfig = {
  version: 2,
  registries: [
    {
      schema: "/:org/:repo{@:version}?",
      variables: [
        {
          key: "org",
          url: `/completions/api/\${org}`,
        },
        {
          key: "repo",
          url: `/completions/api/\${org}/\${repo}`,
        },
        {
          key: "version",
          // documentation: `/completions/api/details/\${org}/\${{version}}`,
          url: `/completions/api/\${org}/\${repo}/\${{version}}`,
        },
      ],
    },
  ],
};

/** Provide the v1 or v2 registry configuration based on the accepts header
 * provided by the client.  Deno 1.17.1 and later indicates it accepts a
 * configuration of v2. */
export function handler(req: Request) {
  const accept = req.headers.get("accept");
  const acceptsV2 = accept !== null && accept !== "*/*" &&
    accepts(req, "application/vnd.deno.reg.v2+json");
  if (!acceptsV2) {
    return new Response(
      "The v1 registry completions API is not supported anymore. Please upgrade to Deno v1.17.1 or later.",
      { status: 404 },
    );
  }
  return Response.json(configV2, {
    headers: {
      "cache-control": MAX_AGE_1_DAY,
      "content-type": "application/vnd.deno.reg.v2+json",
    },
  });
}

export const config: RouteConfig = {
  routeOverride: "/.well-known/deno-import-intellisense.json",
};
