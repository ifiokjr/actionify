import { globber, udd, type UddResult } from "./deps.ts";
import { cwd } from "./helpers.ts";

const entries = globber({
  cwd,
  include: ["**/deps.ts", "**/deps/*.ts"],
  exclude: ["**/fixtures", "**/snapshots"],
  excludeDirectories: true,
});

const promises: Promise<UddResult[]>[] = [];

for await (const entry of entries) {
  promises.push(udd(entry.absolute, {}));
}

await Promise.all(promises);
