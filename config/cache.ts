import { getLogger, globber, parse } from "./deps.ts";
import { cwd } from "./helpers.ts";

const decoder = new TextDecoder();
const log = getLogger();
const deps: string[] = [];
const args = parse(Deno.args, { boolean: ["reload"] });
const entries = globber({
  cwd,
  include: ["**/deps.ts", "**/deps/*.ts", "import_map.json"],
  excludeDirectories: true,
});

for await (const entry of entries) {
  deps.push(entry.relative);
}

const baseCommand = [
  "deno",
  "cache",
  "--lock=lock.json",
  "--import-map=import_map.json",
];

async function update() {
  log.info("Updating the `lock.json` file.");

  await Deno.run({
    cmd: [...baseCommand, "--reload", "--lock-write", ...deps],
    stdout: "piped",
    cwd: cwd.pathname,
  }).output();
}

async function load() {
  const CI = !!Deno.env.get("CI");
  log.info("Loading the cache from `lock.json`.");

  const command = Deno.run({
    cmd: [...baseCommand, ...deps],
    stdout: "inherit",
    stderr: "piped",
    cwd: cwd.pathname,
  });

  const [status, stderr] = await Promise.all([
    command.status(),
    command.stderrOutput(),
  ]);
  command.close();

  if (!status.success) {
    const error = decoder.decode(stderr);

    if (error.includes("No such file or directory") && !CI) {
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
