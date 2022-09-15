import {
  UnknownHandler,
  UnknownHandlerContext,
  UnknownPageProps,
} from "$fresh/server.ts";
import { tw } from "twind";

export async function handler(
  req: Request,
  ctx: UnknownHandlerContext,
): Promise<Response> {
  console.log(await req.text());
  console.log(ctx.state);
  return ctx.render();
}

export default function NotFoundPage({ url }: UnknownPageProps) {
  return (
    <main class={tw`p-8`}>
      <strong>404</strong>: Page not found - <em>&quot;{url.pathname}&quot;</em>
    </main>
  );
}
