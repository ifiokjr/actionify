import { isFunction } from "./deps/just.ts";
import { context, WithContext } from "./expressions.ts";
import { ActionTemplate } from "./types.ts";

export function getFromContext<Type, Base extends ActionTemplate>(
  value: WithContext<Type, Base>,
): Type {
  return isFunction(value) ? value(context()) : value;
}
