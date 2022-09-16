/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import "./deps/dotenv.ts";
import { start } from "$fresh/server.ts";
import manifest from "./fresh.gen.ts";

import twindPlugin from "$fresh/plugins/twind.ts";
import { markdownPlugin } from "./markdown_plugin.ts";
import twindConfig from "./twind.config.ts";

await start(manifest, {
  port: 3000,
  plugins: [twindPlugin(twindConfig), markdownPlugin()],
});
