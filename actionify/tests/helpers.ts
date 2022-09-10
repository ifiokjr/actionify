import { assertSnapshot } from "./deps.ts";

export function snapshot<Content>(t: Deno.TestContext, content: Content) {
  return assertSnapshot(t, content, {
    dir: "./snapshots",
    serializer: (actual) =>
      typeof actual === "string"
        ? actual
        : Deno.inspect(Array.isArray(actual) ? actual.sort() : actual, {
          colors: false,
          depth: 100,
          iterableLimit: Infinity,
          strAbbreviateSize: 100_000,
          trailingComma: true,
          sorted: true,
        }),
  });
}

export const cwd = new URL(".", import.meta.url);
