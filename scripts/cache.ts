import { expandGlob, getLogger, parse } from "./deps.ts";

const decoder = new TextDecoder();
const log = getLogger();
const deps: string[] = [];
const args = parse(Deno.args, { boolean: ["reload"] });
const cwd = new URL("..", import.meta.url).pathname;
const iterator = expandGlob("**/deps.ts", { includeDirs: false });

for await (const dep of iterator) {
  deps.push(dep.path);
}

async function update() {
  log.info("Updating the `lock.json` file.");

  await Deno.run({
    cmd: ["deno", "cache", "--lock=lock.json", "--lock-write", ...deps],
    stdout: "piped",
    cwd,
  }).output();
}

async function load() {
  log.info("Loading the cache from `lock.json`.");

  const command = Deno.run({
    cmd: ["deno", "cache", "--lock=lock.json", "--reload", ...deps],
    stdout: "piped",
    stderr: "piped",
    cwd,
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
      log.critical(
        "Error while reloading the cache.",
        error.split("error: ")[1],
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
