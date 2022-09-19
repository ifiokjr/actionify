import type { Handlers, RouteConfig } from "$fresh/server.ts";
import { generateTypeScriptFromAction, Meta } from "../../mod.ts";
import { BackBlaze } from "../modules/backblaze.ts";
import { env } from "../modules/env.ts";
import { getLatestVersion } from "../modules/gh.ts";
import { getCdnUrl, getFilesList } from "../modules/jsdelivr.ts";
import { supportsHtmlResponse, transformResponse } from "../modules/utils.ts";

const bucketId = env.BACKBLAZE_BUCKET_ID;
const bucketName = env.BACKBLAZE_BUCKET_NAME;
const applicationKey = env.BACKBLAZE_SECRET;
const applicationKeyId = env.BACKBLAZE_ID;

export const handler: Handlers = {
  async GET(req, ctx) {
    const supportHtml = supportsHtmlResponse(req.headers);
    let { org, repo, version, actionify } = ctx.params;
    let shouldCache = true;

    const url = new URL(req.url);

    if (!actionify) {
      const location =
        new URL(`/${Meta.VERSION}${url.pathname}`, url.origin).href;
      return new Response(null, { status: 302, headers: { location } });
    }

    if (!org || !repo) {
      return new Response(
        "Must supply both GitHub `organisation` and `repository`",
        { status: 404 },
      );
    }

    if (!version) {
      shouldCache = false;
      version = await getLatestVersion(org, repo);

      if (!version) {
        // TODO(@ifiokjr) better error handling here for no recognised version
        return new Response("No recognized versions", { status: 404 });
      } else {
        const location = new URL(`${url.pathname}@${version}`, url.origin).href;
        return new Response(null, { status: 302, headers: { location } });
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
    const tsFileName = `${actionify}/${org}/${repo}/${version}/action.ts`;
    const metaFileName = `meta/${org}/${repo}/${version}/meta.json`;

    const possibleResponse = await fetch(blaze.fileUrl(bucketName, tsFileName));

    if (possibleResponse.ok) {
      return transformResponse({
        response: possibleResponse,
        shouldCache,
        org,
        repo,
        version,
        supportHtml,
      });
    }

    // Create the file
    const yamlUrl = getCdnUrl({
      org,
      path: actionYaml.name,
      repo,
      version,
    });

    const { ts, action } = await generateTypeScriptFromAction({
      url: yamlUrl,
      uses,
      version: actionify,
    });
    const tsBinary = new TextEncoder().encode(ts);
    const metaBinary = new TextEncoder().encode(JSON.stringify(action));

    // upload the file
    const [result, _] = await Promise.all([
      blaze.upload(tsBinary, {
        bucketId,
        fileName: tsFileName,
        contentType: "application/typescript; charset=utf-8",
        contentLength: tsBinary.length,
      }),
      blaze.upload(metaBinary, {
        bucketId,
        fileName: metaFileName,
        contentType: "application/json; charset=utf-8",
        contentLength: metaBinary.length,
      }),
    ]);

    if (result.error) {
      // An error occurred when uploading the TypeScript file.
      return new Response(
        "Something went wrong when uploading the generated TypeScript file to storage! Open an issue on https://github.com/ifiokjr/actionify/issues.",
        { status: 404 },
      );
    }

    const response = await fetch(blaze.fileUrl(bucketName, tsFileName));
    return transformResponse({
      response,
      shouldCache,
      org,
      repo,
      version,
      supportHtml,
    });
  },
};

export const config: RouteConfig = {
  routeOverride:
    "{/:actionify(\\d+\\.\\d+\\.\\d+)}?/:org([a-z][a-z0-9_-]+)/:repo([a-z][a-z0-9_-]+){@:version}?",
};
