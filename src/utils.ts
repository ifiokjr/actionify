import { isFunction } from "./deps/just.ts";
import { context } from "./expressions.ts";
import { ActionTemplate, WithContext } from "./types.ts";

export function getFromContext<Type, Base extends ActionTemplate>(
  value: WithContext<Type, Base>,
): Type {
  return isFunction(value) ? value(context()) : value;
}

export function normalizeEvaluationExpression(
  expression: string,
  isFunction: boolean | undefined,
): string {
  expression = expression.trim();

  if (isFunction) {
    try {
      new Function("(" + expression + ")");
    } catch {
      // This means we might have a function shorthand. Try another
      // time prefixing 'function '.
      if (expression.startsWith("async ")) {
        expression = "async function " + expression.substring("async ".length);
      } else {
        expression = "function " + expression;
      }
      try {
        new Function("(" + expression + ")");
      } catch {
        // We tried hard to serialize, but there's a weird beast here.
        throw new Error("Passed function is not well-serializable!");
      }
    }
  }

  if (/^(async)?\s*function(\s|\()/.test(expression)) {
    expression = "(" + expression + ")";
  }
  return expression;
}
