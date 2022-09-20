/// <reference lib="deno.unstable" />

import { colors, diff, truncate } from "./deps/cli.ts";

export function formatLine(line: string, outputTruncateLength?: number) {
  const length = outputTruncateLength ??
      typeof Deno.consoleSize === "function"
    ? Deno.consoleSize(Deno.stdout.rid).columns ?? 80
    : 80;

  return truncate(line, length - 4);
}

export interface DiffOptions {
  outputTruncateLength?: number;
  outputDiffLines?: number;
  showLegend?: boolean;
}

/**
 * Returns unified diff between two strings with coloured ANSI output.
 */

export function unifiedDiff(
  actual: string,
  expected: string,
  options: DiffOptions = {},
) {
  if (actual === expected) {
    return "";
  }

  const { outputTruncateLength, outputDiffLines, showLegend = true } = options;

  const indent = "  ";
  const diffLimit = outputDiffLines || 15;

  const counts = {
    "+": 0,
    "-": 0,
  };
  let previousState: "-" | "+" | null = null;
  let previousCount = 0;
  function preprocess(line: string) {
    if (!line || line.match(/\\ No newline/)) {
      return;
    }

    const char = line[0] as "+" | "-";
    if ("-+".includes(char)) {
      if (previousState !== char) {
        previousState = char;
        previousCount = 0;
      }
      previousCount++;
      counts[char]++;
      if (previousCount === diffLimit) {
        return colors.dim(`${char} ...`);
      } else if (previousCount > diffLimit) {
        return;
      }
    }
    return line;
  }

  const msg = diff.createPatch("string", expected, actual);
  const lines = msg.split("\n").slice(5).map(preprocess).filter(
    Boolean,
  ) as string[];
  const isCompact = counts["+"] === 1 && counts["-"] === 1 &&
    lines.length === 2;

  let formatted = lines.map((line: string) => {
    line = line.replace(/\\"/g, '"');
    if (line[0] === "-") {
      line = formatLine(line.slice(1), outputTruncateLength);
      if (isCompact) {
        return colors.green(line);
      }
      return colors.green(`- ${formatLine(line, outputTruncateLength)}`);
    }
    if (line[0] === "+") {
      line = formatLine(line.slice(1), outputTruncateLength);
      if (isCompact) {
        return colors.red(line);
      }
      return colors.red(`+ ${formatLine(line, outputTruncateLength)}`);
    }
    if (line.match(/@@/)) {
      return "--";
    }
    return ` ${line}`;
  });

  if (showLegend) {
    // Compact mode
    if (isCompact) {
      formatted = [
        `${colors.green("- Expected")}   ${formatted[0]}`,
        `${colors.red("+ Received")}   ${formatted[1]}`,
      ];
    } else {
      if (formatted[0]?.includes('"')) {
        formatted[0] = formatted[0].replace('"', "");
      }

      const last = formatted.length - 1;
      const formattedLast = formatted[last];
      if (formattedLast?.endsWith('"')) {
        formatted[last] = formattedLast.slice(0, formattedLast.length - 1);
      }

      formatted.unshift(
        colors.green(`- Expected  - ${counts["-"]}`),
        colors.red(`+ Received  + ${counts["+"]}`),
        "",
      );
    }
  }

  return formatted.map((i) => indent + i).join("\n");
}
