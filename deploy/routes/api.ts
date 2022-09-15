import type { Handlers, RouteConfig } from "$fresh/server.ts";
import { generateTypeScriptFromAction } from "../../mod.ts";
import { BackBlaze } from "../modules/backblaze.ts";
import { env } from "../modules/env.ts";
import {
  getCdnUrl,
  getFilesList,
  getLatestVersion,
} from "../modules/jsdelivr.ts";
import { ACTIONS_PREFIX, transformResponse } from "../modules/utils.ts";

const bucketId = env.BACKBLAZE_BUCKET_ID;
const bucketName = env.BACKBLAZE_BUCKET_NAME;
const applicationKey = env.BACKBLAZE_SECRET;
const applicationKeyId = env.BACKBLAZE_ID;

export const handler: Handlers = {
  async GET(req, ctx) {
    let { org, repo, version } = ctx.params;
    let shouldCache = true;

    const url = new URL(req.url);

    if (!url.pathname.startsWith("/v0/")) {
      const location = new URL(`/v0${url.pathname}`, url.origin).href;
      return new Response(null, { status: 302, headers: { location } });
    }

    if (!org || !repo) {
      return new Response("Must both org and repository", { status: 404 });
    }

    if (!version) {
      shouldCache = false;
      version = await getLatestVersion(org, repo);

      if (!version) {
        // TODO(@ifiokjr) better error handling here for no recognised version
        return new Response("No recognized versions", { status: 404 });
      }
    }

    const files = await getFilesList({ org, repo, version });
    const actionYaml = files.find((file) =>
      ["/action.yml", "/action.yaml"].includes(file.name)
    );

    if (!actionYaml) {
      // Not a valid github action.
      return new Response(
        `'${org}/${repo}@${version}' is a not a valid GitHub Action. Are you sure it has an 'action.yml' file at the root?`,
        { status: 404 },
      );
    }

    const blaze = new BackBlaze({ applicationKey, applicationKeyId });
    await blaze.authorizeAccount();

    const uses = `${org}/${repo}@${version}`;
    const fileName = `${ACTIONS_PREFIX}${org}/${repo}/${version}/action.ts`;

    const possibleResponse = await fetch(blaze.fileUrl(bucketName, fileName));

    if (possibleResponse.ok) {
      return transformResponse({
        response: possibleResponse,
        shouldCache,
        org,
        repo,
        version,
      });
    }

    // get the url to use to upload
    const uploadUrlResponse = await blaze.getUploadUrl(bucketId);

    if (!uploadUrlResponse.success) {
      return new Response("Could not create the file", { status: 404 });
    }

    const { authorizationToken, uploadUrl } = uploadUrlResponse.data;

    // Create the file
    const yamlUrl = await getCdnUrl({
      org,
      path: actionYaml.name,
      repo,
      version,
    });
    const tsContent = await generateTypeScriptFromAction(yamlUrl, uses);
    const binary = new TextEncoder().encode(tsContent);

    // upload the file
    const result = await blaze.uploadFile(binary, {
      authorizationToken,
      fileName,
      uploadUrl,
      contentType: "application/typescript; charset=utf-8",
      contentLength: binary.length,
    });

    if (result.error) {
      // An error occurred when uploading the TypeScript file.
      return new Response(null, { status: 404 });
    }

    const response = await fetch(blaze.fileUrl(bucketName, fileName));
    return transformResponse({ response, shouldCache, org, repo, version });
  },
};

export const config: RouteConfig = {
  routeOverride:
    "{/v0}?/:org([a-z][a-z0-9_]+)/:repo([a-z][a-z0-9_]+){@:version}?",
};
