import { ExpressionValue } from "./expressions.ts";

interface CommandTypes {
  output?: string;
  env?: string;
}

interface DefaultCommandTypes {
  output: never;
  env: never;
}

/**
 * Actions can communicate with the runner machine to set environment variables,
 * output values used by other actions, add debug messages to the output logs,
 * and other tasks.
 *
 * Most workflow commands use the echo command in a specific format, while
 * others are invoked by writing to a file
 */
export class Command<Types extends CommandTypes> {
  static create<Types extends CommandTypes = DefaultCommandTypes>(
    value: string,
  ): Command<Types> {
    return new Command(value);
  }

  declare z$: Types;
  #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  toString() {
    return this.#value;
  }

  toJSON() {
    return this.toString();
  }
}

export type AnyCommand = Command<any>;

/**
 * Prints a debug message to the log. You must create a secret named
 * `ACTIONS_STEP_DEBUG` with the value `true` to see the debug messages set by
 * this command in the log.
 *
 * ```ts
 * import { step, commands } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
 *
 * const exampleStep = step()
 *   .run(commands.debug('This is a debug message'));
 * ```
 */
export function debug(
  message: ExpressionValue,
): Command<DefaultCommandTypes> {
  return Command.create(`echo ::debug::${message}`);
}

interface NoticeOptions {
  /**
   * Custom title
   */
  title?: ExpressionValue;

  /**
   * Filename
   */
  file?: ExpressionValue;

  /**
   * Column number, starting at 1
   */
  col?: ExpressionValue;

  /**
   * End column number
   */
  endColumn?: ExpressionValue;

  /**
   * Line number, starting at 1
   */
  line?: ExpressionValue;

  /**
   * End line number
   */
  endLine?: ExpressionValue;
}

/**
 * Creates a notice message and prints the message to the log. This message will
 * create an annotation, which can associate the message with a particular file
 * in your repository. Optionally, your message can specify a position within
 * the file.
 *
 * ```ts
 * import { step, commands } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
 *
 * const exampleStep = step()
 *   .run(commands.notice(
 *     'This is a notice', {
 *       file: 'app.js',
 *       line: 1,
 *       col: 5,
 *       endColumn: 7,
 *   }));
 * ```
 */
export function notice(
  message: ExpressionValue,
  options: NoticeOptions = {},
): Command<DefaultCommandTypes> {
  const props = Object.entries(options).map(([key, value]) => `${key}=${value}`)
    .join(",");
  return Command.create(`echo ::notice ${props}::${message}`);
}

/**
 * Creates a warning message and prints the message to the log. This message
 * will create an annotation, which can associate the message with a particular
 * file in your repository. Optionally, your message can specify a position
 * within the file.
 *
 * ```ts
 * import { step, commands } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
 *
 * const exampleStep = step()
 *   .run(commands.warning(
 *     'This is a warning', {
 *       file: 'app.js',
 *       line: 1,
 *       col: 5,
 *       endColumn: 7,
 *   }));
 * ```
 */
export function warning(
  message: ExpressionValue,
  options: NoticeOptions = {},
): Command<DefaultCommandTypes> {
  const props = Object.entries(options).map(([key, value]) => `${key}=${value}`)
    .join(",");
  return Command.create(`echo ::warning ${props}::${message}`);
}

/**
 * Creates an error message and prints the message to the log. This message will
 * create an annotation, which can associate the message with a particular file
 * in your repository. Optionally, your message can specify a position within
 * the file.
 *
 * ```ts
 * import { step, commands } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
 *
 * const exampleStep = step()
 *   .run(commands.error(
 *     'This is an error', {
 *       file: 'app.js',
 *       line: 1,
 *       col: 5,
 *       endColumn: 7,
 *   }));
 * ```
 */
export function error(
  message: ExpressionValue,
  options: NoticeOptions = {},
): Command<DefaultCommandTypes> {
  const props = Object.entries(options).map(([key, value]) => `${key}=${value}`)
    .join(",");
  return Command.create(`echo ::error ${props}::${message}`);
}

/**
 * Masking a value prevents a string or variable from being printed in the log.
 * Each masked word separated by whitespace is replaced with the * character.
 * You can use an environment variable or string for the mask's value. When you
 * mask a value, it is treated as a secret and will be redacted on the runner.
 * For example, after you mask a value, you won't be able to set that value as
 * an output.
 *
 * ```ts
 * import { step, commands } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
 *
 * const exampleStep = step()
 *   .run([
 *     commands.setSecret('$SOME_SECRET'),
 *     commands.setSecret('hide me'),
 *   ]);
 * ```
 */
export function setSecret(
  value: ExpressionValue,
): Command<DefaultCommandTypes> {
  return Command.create(`echo ::add-mask::${value}`);
}

/**
 * Sets an action's output parameter.
 *
 * ```ts
 * import { commands, e, step } from 'https://deno.land/x/actionify@0.1.0/mod.ts';
 *
 * const exampleStep = step()
 *   .run(commands.setOutput(
 *     'variableName',
 *     e.hashFiles('**package.json'),
 *   ));
 * ```
 */
export function setOutput<Output extends string>(
  name: Output,
  value: ExpressionValue,
): Command<{ output: Output; env: never }> {
  return Command.create(`echo "::set-output name=${name}::${value}"`);
}

/**
 * Creates an expandable group in the log. To create a group, use the group
 * command and specify a title. Anything you print to the log between the group
 * and endgroup commands is nested inside an expandable entry in the log.
 *
 * This can be used to run multiple commands in a single run command.
 *
 * ```ts
 * import { commands, e, step } from "https://deno.land/x/actionify@0.1.0/mod.ts";
 *
 * const exampleStep = step()
 *   .run(commands.group("My group", [
 *     commands.setOutput(
 *       "variableName",
 *       e.hashFiles("**package.json"),
 *     ),
 *     'Another command',
 *     commands.setOutput(
 *       "anotherOne",
 *       e.hashFiles("**lock.json"),
 *     ),
 *   ]));
 * ```
 */
export function group<Commands extends AnyCommand>(
  title: string,
  commands: Array<Commands | string>,
): Array<Commands | string> {
  return [`echo "::group::${title}"`, ...commands, `echo "::endgroup::"`];
}

/**
 * You can make an environment variable available to any subsequent steps in a
 * workflow job by defining or updating the environment variable and writing
 * this to the GITHUB_ENV environment file. The step that creates or updates the
 * environment variable does not have access to the new value, but all
 * subsequent steps in a job will have access. The names of environment
 * variables are case-sensitive, and you can include punctuation.
 *
 * Once an environment variable is added in this way it can be removed by
 * setting it to the empty string.
 *
 * ```ts
 * import { commands, step } from "https://deno.land/x/actionify@0.1.0/mod.ts";
 *
 * const addStep = step()
 *   .run(commands.exportVariable(
 *     "AWESOME_ENV",
 *     "this is the env",
 *   ));
 *
 * // Set the variable to an empty string.
 * const removeStep = step()
 *   .run(commands.exportVariable("AWESOME_ENV", ""));
 * ```
 *
 * If `isDynamic` is set to `true` the provided value is not wrapped in quotes
 * and will be run as an expression.
 */
export function exportVariable<Env extends string>(
  name: Env,
  value: ExpressionValue,
  isDynamic = false,
): Command<{ env: Env; output: never }> {
  const quotes = isDynamic ? "" : '"';
  return Command.create(
    `echo ${quotes}${name}=${value}${quotes} >> $GITHUB_ENV`,
  );
}

/**
 * If `isDynamic` is set to `true` the provided value is not wrapped in quotes
 * and will be run as an expression.
 */
export function exportMultilineVariable<Env extends string>(
  name: Env,
  value: ExpressionValue,
  isDynamic = false,
) {
  const random = getRandomValue("ENV");
  const quotes = isDynamic ? "" : '"';
  return Command.create(
    `echo "${name}<<${random}" >> $GITHUB_ENV\necho ${quotes}${value}${quotes} >> $GITHUB_ENV\necho "${random}" >> $GITHUB_ENV`,
  );
}

function getRandomValue(prefix = "") {
  return `${prefix}${crypto.randomUUID().split("-").join("").slice(0, 10)}`;
}

/**
 * Prepends a directory to the system PATH variable and automatically makes it
 * available to all subsequent actions in the current job; the currently running
 * action cannot access the updated path variable. To see the currently defined
 * paths for your job, you can use echo "$PATH" in a step or an action.
 *
 * ```ts
 * import { commands, step } from "https://deno.land/x/actionify@0.1.0/mod.ts";
 *
 * const pathStep = step()
 *   .run(commands.addPath("$HOME/.local/bin"));
 * ```
 */
export function addPath(path: ExpressionValue) {
  return Command.create(`echo "${path}" >> $GITHUB_PATH`);
}
