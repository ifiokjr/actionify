import { Handlers, PageProps } from "$fresh/server.ts";
import { tw } from "twind";
import { Meta } from "../../mod.ts";
import { render } from "../deps/markdown.ts";

interface Props {
  markdown: string;
}

export const handler: Handlers<Props> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const response = await fetch(import.meta.resolve("./index.md"));
    const text = await response.text();
    const markdown = render(text, { baseUrl: url.origin, allowIframes: false });

    return ctx.render({ markdown });
  },
};

export default function Home(props: PageProps<Props>) {
  return (
    <main
      data-color-mode="light"
      data-light-theme="light"
      data-dark-theme="dark"
      class={tw`p-7 markdown-body container m-auto`}
    >
      <div class={tw`flex w-full justify-between mb-8 gap-4`}>
        <h1>
          <code>actionify@{Meta.VERSION}</code>
        </h1>
        <div class={tw``}>
          <a href="https://github.com/ifiokjr/actionify">
            <img
              width="150"
              height="150"
              src="/logo.svg"
              alt="svg logo"
              title="SVG Logo"
            />
          </a>
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: props.data.markdown }} />
    </main>
  );
}
