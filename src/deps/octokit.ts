import { Octokit as OctokitCore } from "https://cdn.skypack.dev/@octokit/core@4.0.5?dts";
import { paginateRest } from "https://cdn.skypack.dev/@octokit/plugin-paginate-rest@4.2.0?dts";
import { restEndpointMethods } from "https://cdn.skypack.dev/@octokit/plugin-rest-endpoint-methods@6.4.1?dts";
import { retry } from "https://cdn.skypack.dev/@octokit/plugin-retry@3.0.9?dts";
import { throttling } from "https://cdn.skypack.dev/@octokit/plugin-throttling@4.3.0?dts";
import { NAME, VERSION } from "../meta.ts";

export const Octokit = OctokitCore.plugin(
  restEndpointMethods,
  paginateRest,
  retry,
  throttling,
).defaults({
  userAgent: `${NAME}/${VERSION}`,
  throttle: {
    onRateLimit,
    onAbuseLimit,
  },
});

interface Options {
  method: string;
  url: string;
  request: {
    retryCount: number;
  };
}

interface HasLogger {
  log: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}

// istanbul ignore next no need to test internals of the throttle plugin
function onRateLimit(retryAfter: number, options: Options, octokit: HasLogger) {
  octokit.log.warn(
    `Request quota exhausted for request ${options.method} ${options.url}`,
  );

  if (options.request.retryCount === 0) {
    // only retries once
    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
    return true;
  }
}

// istanbul ignore next no need to test internals of the throttle plugin
function onAbuseLimit(
  retryAfter: number,
  options: Options,
  octokit: HasLogger,
) {
  octokit.log.warn(
    `Abuse detected for request ${options.method} ${options.url}`,
  );

  if (options.request.retryCount === 0) {
    // only retries once
    octokit.log.info(`Retrying after ${retryAfter} seconds!`);
    return true;
  }
}
