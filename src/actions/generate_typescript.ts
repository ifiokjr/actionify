import { camelCase, isObject, isString, pascalCase } from "../deps/just.ts";
import { load } from "../deps/yaml.ts";
import { GitHubActionError } from "../errors.ts";
import { NAME, VERSION } from "../meta.ts";
import { GitHubAction } from "./types.ts";

interface GenerateTypeScriptFromActionProps {
  url: URL | string;
  uses: string;
  version?: string;
}

export async function generateTypeScriptFromAction(
  props: GenerateTypeScriptFromActionProps,
) {
  const { url, uses, version = VERSION } = props;
  const response = await fetch(new URL(url));
  const test = await response.text();
  const action = load(test);

  if (!isGitHubAction(action)) {
    throw new GitHubActionError(
      `The yaml file at given URL is not valid: ${url}`,
    );
  }
  const ts = convertToTypeScript({ action, uses, version });

  return { ts, action };
}

function isGitHubAction(value: unknown): value is GitHubAction {
  return isObject(value) && isString(value.name) && isString(value.runs?.using);
}

interface ConvertToTypeScriptProps {
  action: GitHubAction;
  uses: string;
  version?: string;
}

function convertToTypeScript(
  { action, uses, version = VERSION }: ConvertToTypeScriptProps,
): string {
  const props = getProps(action);
  const defaultFunctionName = camelCase(action.name);
  const defaultDescription = makeStringDocCommentSafe(action.description);
  return `\
import {
  type ActionTemplate,
  type DefaultStepInputs,
  e,
  step,
  type WithContext,
} from "https://deno.land/x/${NAME}@${version}/mod.ts";
${props.interface}
/** ${defaultDescription} */
export default function ${defaultFunctionName}<Base extends ActionTemplate = ActionTemplate>(${props.inputs}) {
  return step${getStepOutputs(action)}()
    .uses("${uses}")${props.with};
}

export const NAME = "${action.name}";
export const AUTHOR = "${action.author ?? ""}";
`;
}

function makeStringDocCommentSafe(comment: string): string {
  return comment.replaceAll("*/", "*./");
}

function getStepOutputs(action: GitHubAction) {
  const outputs = action.outputs;

  if (!outputs) {
    return "<Base>";
  }

  const names = Object.keys(outputs).map((name) => JSON.stringify(name)).join(
    " | ",
  );

  return `<Base & { stepOutputs: ${names} }>`;
}

function getProps(action: GitHubAction) {
  const propsInterfaceName = `${pascalCase(action.name)}Inputs`;
  const result = {
    interface: ``,
    inputs:
      `inputs: WithContext<DefaultStepInputs, Base, "jobs:jobId:steps:with"> = {}`,
    with:
      `\n    // @ts-expect-error Fix this later\n    .with(inputs as DefaultStepInputs)`,
  };
  const { inputs } = action;

  if (!inputs) {
    return result;
  }

  let propsIsRequired = false;
  const propsInterface: string[] = [];

  for (const [name, options] of Object.entries(inputs)) {
    const isRequired = options.required && !options.default;

    if (isRequired) {
      propsIsRequired = true;
    }

    const description: string[] = [];

    if (options.description) {
      for (const line of options.description.split("\n")) {
        description.push(line);
      }
    }

    if (options.default) {
      description.push(
        `@default ${
          isString(options.default)
            ? JSON.stringify(options.default)
            : options.default
        }`,
      );
    }

    if (description.length === 1) {
      propsInterface.push(
        `/** ${makeStringDocCommentSafe(description.join("\n"))} */`,
      );
    } else if (description.length >= 2) {
      propsInterface.push(
        `/**\n   * ${
          makeStringDocCommentSafe(description.join("\n   * "))
        }\n   */`,
      );
    }

    propsInterface.push(
      `${JSON.stringify(name)}${isRequired ? "" : "?"}: e.ExpressionValue;\n`,
    );
  }

  result.interface = `
export interface ${propsInterfaceName} extends DefaultStepInputs {
  ${propsInterface.join("\n  ")}}
`;

  result.inputs =
    `inputs: WithContext<${propsInterfaceName}, Base, "jobs:jobId:steps:with">${
      propsIsRequired ? "" : " = {}"
    }`;

  return result;
}
