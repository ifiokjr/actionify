import { globber } from "./deps.ts";
import { getLogger, parse } from "./deps.ts";
import { cwd } from "./helpers.ts";

const decoder = new TextDecoder();
const log = getLogger();
const deps: string[] = [];
const args = parse(Deno.args, { boolean: ["reload"] });
const entries = globber({
  cwd,
  include: ["**/deps.ts", "**/deps/*.ts"],
  excludeDirectories: true,
});

for await (const entry of entries) {
  deps.push(entry.relative);
}

async function update() {
  log.info("Updating the `lock.json` file.");

  await Deno.run({
    cmd: ["deno", "cache", "--lock=lock.json", "--lock-write", ...deps],
    stdout: "piped",
    cwd: cwd.pathname,
  }).output();
}

async function load() {
  log.info("Loading the cache from `lock.json`.");

  const command = Deno.run({
    cmd: ["deno", "cache", "--lock=lock.json", "--reload", ...deps],
    stdout: "piped",
    stderr: "piped",
    cwd: cwd.pathname,
  });

  const [status, _, stderr] = await Promise.all([
    command.status(),
    command.output(),
    command.stderrOutput(),
  ]);
  command.close();

  if (!status.success) {
    const error = decoder.decode(stderr);

    if (error.includes("No such file or directory") && !Deno.env.get("CI")) {
      log.warning("No `lock.json` found. Creating a new one.");
      await update();
    } else {
      log.info(error);
      log.critical(
        `Error while reloading the cache.\n${error.split("error: ")[1]}`,
      );
      Deno.exit(1);
    }
  }
}

if (args.reload) {
  await load();
} else {
  await update();
}
