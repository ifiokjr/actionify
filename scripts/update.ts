import { globber, udd, type UddResult } from "./deps.ts";

const cwd = new URL("..", import.meta.url);

const entries = globber({
  cwd,
  include: ["**/deps.ts", "**/deps/*.ts", "**/import_map.json"],
  exclude: ["**/fixtures", "**/snapshots"],
  excludeDirectories: true,
});

const promises: Promise<UddResult[]>[] = [];

for await (const entry of entries) {
  promises.push(udd(entry.absolute, {}));
}

await Promise.all(promises);
