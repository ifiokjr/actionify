import {
  defineWorkflows,
  e,
  Runner,
  Shell,
  workflow,
} from "https://deno.land/x/actionify@0.3.0/mod.ts";

const napi = workflow({ name: "napi" })
  .env({
    DEBUG: "napi:*",
    APP_NAME: "example",
    MACOSX_DEPLOYMENT_TARGET: "10.13",
  })
  .on("push", {
    branches: ["main"],
    "tags-ignore": ["**"],
    "paths-ignore": [
      "**/*.md",
      "LICENSE",
      "**/*.gitignore",
      ".editorconfig",
      "docs/**",
    ],
  })
  .on("pull_request")
  .job("build", (job) => {
    return job
      .if((ctx) =>
        e.not(
          e.contains(
            e.event(ctx.github, "push").head_commit.message,
            "skip ci",
          ),
        )
      )
      .strategy({ "fail-fast": false, matrix: createMatrix() })
      .runsOn((ctx) => e.expr(ctx.matrix.settings.host))
      .name((ctx) =>
        e.concat("stable -", e.expr(ctx.matrix.settings.target), "- node@16")
      )
      .steps(
        (step) => step.name("Checkout").uses("actions/checkout@3.0.2"),
        (step, ctx) => {
          return step
            .name("Setup node")
            .uses("actions/setup-node@v3")
            .with({ "node-version": 16, "check-latest": true, cache: "yarn" })
            .if(e.not(ctx.matrix.settings.docker));
        },
        (step, ctx) => {
          return step
            .name("Install")
            .uses("actions-rs/toolchain@v1")
            .if(e.not(ctx.matrix.settings.docker))
            .with({
              profile: "minimal",
              override: true,
              toolchain: "stable",
              target: e.expr(ctx.matrix.settings.target),
            });
        },
        (step, ctx) => {
          return step
            .name("Cache cargo")
            .uses("actions/cache@v3")
            .with({
              path: [
                "~/.cargo/registry/index/",
                "~/.cargo/registry/cache/",
                "~/.cargo/git/db/",
                ".cargo-cache",
                "target/",
              ].join("\n"),
              key: e.concat(
                ctx.matrix.settings.target,
                "-cargo-",
                ctx.matrix.settings.host,
              ),
            });
        },
        (step, ctx) => {
          return step
            .name("Cache NPM dependencies")
            .uses("actions/cache@v3")
            .with({
              path: ".yarn/cache",
              key: e.concat(
                "npm-cache-build-",
                ctx.matrix.settings.target,
                "-node@16",
              ),
            });
        },
        (step, ctx) => {
          return step
            .name("Setup toolchain")
            .run(e.expr(ctx.matrix.settings.setup))
            .if(ctx.matrix.settings.setup!)
            .shell(Shell.Bash);
        },
        (step, ctx) => {
          return step
            .name("Setup node x86")
            .if(e.eq(ctx.matrix.settings.target, "i686-pc-windows-msvc"))
            .run('yarn config set supportedArchitectures.cpu "ia32"')
            .shell(Shell.Bash);
        },
        (step) => {
          return step
            .name("Install dependencies")
            .run("yarn install");
        },
        (step, ctx) => {
          return step
            .name("Setup node x86")
            .uses("actions/setup-node@v3")
            .if(e.eq(ctx.matrix.settings.target, "i686-pc-windows-msvc"))
            .with({
              "node-version": 16,
              "check-latest": true,
              cache: "yarn",
              architecture: "x86",
            });
        },
        (step, ctx) => {
          return step
            .name("Build in docker")
            .uses("addnab/docker-run-action@v3")
            .if(ctx.matrix.settings.docker)
            .with({
              image: e.expr(ctx.matrix.settings.docker),
              options: e.concat(
                "--user 0:0 -v ",
                ctx.github.workspace,
                "/.cargo-cache/git/db:/usr/local/cargo/git/db -v ",
                ctx.github.workspace,
                "/.cargo/registry/cache:/usr/local/cargo/registry/cache -v ",
                ctx.github.workspace,
                "/.cargo/registry/index:/usr/local/cargo/registry/index -v ",
                ctx.github.workspace,
                ":/build -w /build",
              ),
              run: e.expr(ctx.matrix.settings.build),
            });
        },
        (step, ctx) => {
          return step
            .name("Build")
            .run(e.wrap(ctx.matrix.settings.build))
            .if(e.not(ctx.matrix.settings.docker))
            .shell(Shell.Bash);
        },
        (step, ctx) => {
          return step
            .name("Upload artifact")
            .uses("actions/upload-artifact@v3")
            .with({
              name: e.concat("bindings-", ctx.matrix.settings.target),
              path: e.concat(ctx.env.APP_NAME, ".*.node"),
              "if-no-files-found": "error",
            });
        },
      );
  });

export default defineWorkflows({
  workflows: [napi],
  rootDirectory: import.meta.resolve("./"),
});

function createMatrix() {
  return {
    settings: [
      {
        host: Runner.MacOSLatest,
        target: "x86_64-apple-darwin",
        build: ["yarn build", "strip -x *.node"].join("\n"),
      },
      {
        host: Runner.MacOSLatest,
        target: "aarch64-apple-darwin",
        build: [
          "sudo rm -Rf /Library/Developer/CommandLineTools/SDKs/*;",
          "export CC=$(xcrun -f clang);",
          "export CXX=$(xcrun -f clang++);",
          "SYSROOT=$(xcrun --sdk macosx --show-sdk-path);",
          'export CFLAGS="-isysroot $SYSROOT -isystem $SYSROOT";',
          "yarn build --target aarch64-apple-darwin",
          "strip -x *.node",
        ].join("\n"),
      },
      {
        host: Runner.WindowsLatest,
        target: "x86_64-pc-windows-msvc",
        build: "yarn build",
      },
      {
        host: Runner.WindowsLatest,
        target: "i686-pc-windows-msvc",
        build: ["yarn build --target i686-pc-windows-msvc", "yarn test"]
          .join("\n"),
      },
      {
        host: Runner.WindowsLatest,
        target: "aarch64-pc-windows-msvc",
        docker: "ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-alpine",
        build: "yarn build --target aarch64-pc-windows-msvc",
      },
      {
        host: Runner.UbuntuLatest,
        target: "x86_64-unknown-linux-gnu",
        docker: "ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-debian",
        build:
          "set -e && yarn build --target x86_64-unknown-linux-gnu && strip *.node",
      },
      {
        host: Runner.UbuntuLatest,
        target: "aarch64-unknown-linux-gnu",
        docker: "ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-debian-aarch64",
        build:
          "set -e && yarn build --target aarch64-unknown-linux-gnu && aarch64-unknown-linux-gnu-strip *.node",
      },
      {
        host: Runner.UbuntuLatest,
        target: "armv7-unknown-linux-gnueabihf",
        setup: [
          "sudo apt-get update",
          "sudo apt-get install gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf -y",
        ].join("\n"),
        build: [
          "yarn build --target=armv7-unknown-linux-gnueabihf",
          "arm-linux-gnueabihf-strip *.node",
        ].join("\n"),
      },
      {
        host: Runner.UbuntuLatest,
        target: "aarch64-linux-android",
        build: [
          'export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang"',
          'export CC="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang"',
          'export CXX="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android24-clang++"',
          'export AR="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"',
          'export PATH="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin:${PATH}"',
          "yarn build --target aarch64-linux-android",
          "${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip *.node",
        ].join("\n"),
      },
      {
        host: Runner.UbuntuLatest,
        target: "armv7-linux-androideabi",
        build: [
          'export CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/armv7a-linux-androideabi24-clang"',
          'export CC="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/armv7a-linux-androideabi24-clang"',
          'export CXX="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/armv7a-linux-androideabi24-clang++"',
          'export AR="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-ar"',
          'export PATH="${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin:${PATH}"',
          "yarn build --target armv7-linux-androideabi",
          "${ANDROID_NDK_LATEST_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip *.node",
        ].join("\n"),
      },
      {
        host: Runner.UbuntuLatest,
        target: "aarch64-unknown-linux-musl",
        docker: "ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-alpine",
        build: [
          "set -e &&",
          "rustup target add aarch64-unknown-linux-musl &&",
          "yarn build --target aarch64-unknown-linux-musl &&",
          "/aarch64-linux-musl-cross/bin/aarch64-linux-musl-strip *.node",
        ].join("\n"),
      },
    ],
  };
}
