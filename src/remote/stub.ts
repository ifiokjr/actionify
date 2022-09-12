import { step } from "../step.ts";

export default function sample(..._args: any[]) {
  return step().uses("actions/checkout");
}
