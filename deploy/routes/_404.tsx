import {
  UnknownHandler,
  UnknownHandlerContext,
  UnknownPageProps,
} from "$fresh/server.ts";
import { tw } from "twind";
import { getLogger } from "../deps/std.ts";

export function handler(req: Request, ctx: UnknownHandlerContext) {
  getLogger().info(req);
  return ctx.render();
}

export default function NotFoundPage({ url }: UnknownPageProps) {
  return (
    <main class={tw`p-8 m-auto container`}>
      <strong>404</strong>: Page not found - <em>&quot;{url.pathname}&quot;</em>
    </main>
  );
}
