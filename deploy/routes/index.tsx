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
      <h1>actionify@{Meta.VERSION}</h1>
      <div dangerouslySetInnerHTML={{ __html: props.data.markdown }} />
    </main>
  );
}
