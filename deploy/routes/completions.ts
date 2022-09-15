import { Handlers, RouteConfig } from "$fresh/server.ts";
import { BackBlaze } from "../modules/backblaze.ts";
import { env } from "../modules/env.ts";
import { ACTIONS_PREFIX, json } from "../modules/utils.ts";

const bucketId = env.BACKBLAZE_BUCKET_ID;
const applicationKey = env.BACKBLAZE_SECRET;
const applicationKeyId = env.BACKBLAZE_ID;
const maxFileCount = 20;
const delimiter = "/";

export const handler: Handlers = {
  async GET(req, ctx) {
    const { org, repo, version } = ctx.params;
    const url = new URL(req.url);

    if (!org && !repo && !version) {
      return json({ items: [], isIncomplete: false });
    }

    const blaze = new BackBlaze({ applicationKey, applicationKeyId });
    await blaze.authorizeAccount();

    const prefix = `${ACTIONS_PREFIX}${org}${
      (repo || url.pathname.endsWith("/")) ? `/${repo}` : ""
    }${(version || url.pathname.endsWith("/")) && repo ? `/${version}` : ""}`;

    const stringToReplace = version
      ? `${ACTIONS_PREFIX}${org}/${repo}/`
      : repo
      ? `${ACTIONS_PREFIX}${org}/`
      : `${ACTIONS_PREFIX}`;
    const result = await blaze
      .listFileNames({ bucketId, prefix, delimiter, maxFileCount });

    if (result.error) {
      return json({ items: [], isIncomplete: false });
    }

    const items = result.data.files.map((file) => {
      return file.fileName
        .replace(stringToReplace, "")
        .replace(/\/$/, "");
    });
    const isIncomplete = items.length > maxFileCount;
    const preselect = items.at(0);

    return json({ items, isIncomplete, preselect });
  },
};

export const config: RouteConfig = {
  routeOverride: "/_completions/v0/:org([a-z][a-z0-9_]+){/:repo}?{/:version}?",
};
