import { Plugin } from "$fresh/server.ts";
import { CSS } from "./deps/markdown.ts";

export function markdownPlugin(): Plugin {
  return {
    name: "markdown_styles_plugin",
    render: (ctx) => {
      ctx.render();
      return ({ styles: [{ cssText: CSS }] });
    },
  };
}
