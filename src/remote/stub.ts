import { step } from "../step.ts";
import type { ActionTemplate, WithContext } from "../types.ts";

export default function sample(_prop: WithContext<object, ActionTemplate>) {
  return step().uses("actions/checkout");
}
