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
 * import { Step, commands } from 'https://deno.land/x/actionify/mod.ts';
 *
 * const step = Step
 *   .create()
 *   .run(commands.setDebug('This is a debug message'));
 * ```
 */
export function setDebug(
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
 * import { Step, commands } from 'https://deno.land/x/actionify/mod.ts';
 *
 * const step = Step
 *   .create()
 *   .run(commands.setNotice(
 *     'This is a notice', {
 *       file: 'app.js',
 *       line: 1,
 *       col: 5,
 *       endColumn: 7,
 *   }));
 * ```
 */
export function setNotice(
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
 * import { Step, commands } from 'https://deno.land/x/actionify/mod.ts';
 *
 * const step = Step
 *   .create()
 *   .run(commands.setWarning(
 *     'This is a warning', {
 *       file: 'app.js',
 *       line: 1,
 *       col: 5,
 *       endColumn: 7,
 *   }));
 * ```
 */
export function setWarning(
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
 * import { Step, commands } from 'https://deno.land/x/actionify/mod.ts';
 *
 * const step = Step
 *   .create()
 *   .run(commands.setError(
 *     'This is an error', {
 *       file: 'app.js',
 *       line: 1,
 *       col: 5,
 *       endColumn: 7,
 *   }));
 * ```
 */
export function setError(
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
 * import { Step, commands } from 'https://deno.land/x/actionify/mod.ts';
 *
 * const step = Step
 *   .create()
 *   .run([
 *     commands.setMask('$SOME_SECRET'),
 *     commands.setMask('hide me'),
 *   ]);
 * ```
 */
export function setMask(value: ExpressionValue): Command<DefaultCommandTypes> {
  return Command.create(`echo ::add-mask::${value}`);
}

/**
 * Sets an action's output parameter.
 *
 * ```ts
 * import { commands, e, Step } from 'https://deno.land/x/actionify/mod.ts';
 *
 * const step = Step
 *   .create()
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
 * import { commands, e, Step } from "https://deno.land/x/actionify/mod.ts";
 *
 * const step = Step
 *   .create()
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
 * ```ts
 * import { commands, Step } from "https://deno.land/x/actionify/mod.ts";
 *
 * const step = Step
 *   .create()
 *   .run(commands.setEnv(
 *     "AWESOME_ENV",
 *     "this is the env",
 *   ));
 * ```
 */
export function setEnv<Env extends string>(
  name: Env,
  value: ExpressionValue,
): Command<{ env: Env; output: never }> {
  return Command.create(`echo "${name}=${value}" >> $GITHUB_ENV`);
}
