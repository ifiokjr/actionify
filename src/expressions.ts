import { Context, proxy } from "./context.ts";
import { ActionData, ActionTemplate, BaseContext } from "./types.ts";

/**
 * An expression which is evaluated within the github action context.
 */
export class Expression<Type = unknown> {
  /**
   * Check whether the value is an expression.
   */
  static is(value: unknown): value is Expression {
    return value instanceof Expression;
  }

  static create<Type = unknown>(
    ...items: Array<ExpressionContent<Type> | string | undefined>
  ) {
    const expression = new Expression<Type>();

    if (items.length > 0) {
      expression.add(...items);
    }

    return expression;
  }

  declare z$: Type;

  #contents: Array<ExpressionContent<Type> | string> = [];

  private constructor() {}

  toString(): string {
    return this.#contents.map((item) => {
      return mapContentToString(item);
    }).join("");
  }

  add(...items: Array<ExpressionContent<Type> | string | undefined>) {
    this.#contents.push(
      ...items.filter((item): item is ExpressionContent<Type> | string => {
        return item !== undefined;
      }),
    );

    return this;
  }

  /**
   * @internal
   */
  cast<T = Type>() {
    return this as unknown as Expression<T>;
  }

  /**
   * Wrap the expression as an interpolation `${{ <EXPRESSION> }}` so that it
   * can be used in different scopes.
   */
  wrap() {
    return `$\{\{ ${this.toString()} }}`;
  }

  toJSON() {
    return this.wrap();
  }
}

/**
 * Wrap an expression or context as an interpolation `${{ <EXPRESSION> }}`.
 */
export function wrap(content: ExpressionContent) {
  return Expression.create(content).wrap();
}

/**
 * Returns `true` if `search` contains `item`. If `search` is an array, this function
 * returns true if the item is an element in the array. If search is a string,
 * this function returns true if the item is a substring of search. This
 * function is not case sensitive. Casts values to a string.
 */
export function contains(
  search: ExpressionContent,
  item: ExpressionContent,
) {
  return Expression
    .create("contains(", str(search), str(item), ")")
    .cast<boolean>();
}

/**
 * Negates the truthiness of the provided expression / value.
 */
export function not(content: ExpressionContent) {
  return Expression
    .create("!", str(content))
    .cast<boolean>();
}

/**
 * Wrap the expression in brackets to create a logical grouping.
 */
export function group<Type = unknown>(expression: Expression<Type>) {
  return Expression.create("(", expression, ")");
}

export enum Operator {
  LessThan = "<",
  LessThanOrEqual = "<=",
  GreaterThan = ">",
  GreaterThanOrEqual = ">=",
  Equal = "==",
  NotEqual = "!=",
  And = "&&",
  Or = "||",
}
type BooleanOperator =
  | `${Operator.LessThan}`
  | `${Operator.LessThanOrEqual}`
  | `${Operator.GreaterThan}`
  | `${Operator.GreaterThanOrEqual}`
  | `${Operator.Equal}`
  | `${Operator.NotEqual}`;

/**
 * Use a logical / boolean operator to compare the `leftHandSide` to the `rightHandSide`.
 */
export function op<Lhs, Rhs>(
  lhs: ExpressionContent<Lhs>,
  operator: `${Operator.And}`,
  rhs: ExpressionContent<Rhs>,
): Expression<Rhs>;
export function op<Lhs, Rhs>(
  lhs: ExpressionContent<Lhs>,
  operator: `${Operator.Or}`,
  rhs: ExpressionContent<Rhs>,
): Expression<Lhs | Rhs>;
export function op<Type extends SupportedPrimitives>(
  lhs: ExpressionContent<Type>,
  operator: BooleanOperator,
  rhs: ExpressionContent<Type>,
): Expression<boolean>;
export function op(
  lhs: ExpressionContent,
  operator: `${Operator}`,
  rhs: ExpressionContent,
): Expression {
  return Expression.create(str(lhs), " ", operator, " ", str(rhs));
}

export function and<Lhs, Rhs>(
  lhs: ExpressionContent<Lhs>,
  rhs: ExpressionContent<Rhs>,
) {
  return op(lhs, Operator.And, rhs);
}

export function or<Lhs, Rhs>(
  lhs: ExpressionContent<Lhs>,
  rhs: ExpressionContent<Rhs>,
) {
  return op(lhs, Operator.Or, rhs);
}

export function eq<Type extends SupportedPrimitives>(
  lhs: ExpressionContent<Type>,
  rhs: ExpressionContent<Type>,
) {
  return op(lhs, Operator.Equal, rhs);
}

export function lt<Type extends SupportedPrimitives>(
  lhs: ExpressionContent<Type>,
  rhs: ExpressionContent<Type>,
) {
  return op(lhs, Operator.LessThan, rhs);
}

export function lte<Type extends SupportedPrimitives>(
  lhs: ExpressionContent<Type>,
  rhs: ExpressionContent<Type>,
) {
  return op(lhs, Operator.LessThanOrEqual, rhs);
}

export function gt<Type extends SupportedPrimitives>(
  lhs: ExpressionContent<Type>,
  rhs: ExpressionContent<Type>,
) {
  return op(lhs, Operator.GreaterThan, rhs);
}

export function gte<Type extends SupportedPrimitives>(
  lhs: ExpressionContent<Type>,
  rhs: ExpressionContent<Type>,
) {
  return op(lhs, Operator.GreaterThanOrEqual, rhs);
}

export function notEq<Type extends SupportedPrimitives>(
  lhs: ExpressionContent<Type>,
  rhs: ExpressionContent<Type>,
) {
  return op(lhs, Operator.NotEqual, rhs);
}

/**
 * Returns true when searchString starts with searchValue. This function is not
 * case sensitive. Casts values to a string.
 */
export function startsWith(
  searchString: ExpressionContent<string>,
  searchValue: ExpressionContent<string>,
) {
  return Expression
    .create("startsWith(", str(searchString), ", ", str(searchValue), ")")
    .cast<boolean>();
}

/**
 * Returns true if searchString ends with searchValue. This function is not case
 * sensitive. Casts values to a string.
 */
export function endsWith(
  searchString: ExpressionContent<string>,
  searchValue: ExpressionContent<string>,
) {
  return Expression
    .create("endsWith(", str(searchString), ", ", str(searchValue), ")")
    .cast<boolean>();
}

/**
 * Replaces values in the string, with the variable replaceValueN. Variables in
 * the string are specified using the {N} syntax, where N is an integer. You
 * must specify at least one replaceValue and string. There is no maximum for
 * the number of variables (replaceValueN) you can use. Escape curly braces
 * using double braces.
 */
export function format(
  stringToFormat: string,
  ...replacements: Array<ExpressionContent<string>>
) {
  const expression = Expression
    .create("format(", str(stringToFormat));

  if (replacements.length > 0) {
    for (const replacement of replacements) {
      expression.add(", ", str(replacement));
    }
  }

  expression.add(")");

  return expression.cast<string>();
}

/**
 * The value for `array` can be an `array` or a `string`. All values in `array` are
 * concatenated into a string. If you provide `optionalSeparator`, it is inserted
 * between the concatenated values. Otherwise, the default separator `,` is used.
 * Casts values to a string.
 */
export function join(
  array: ExpressionContent<string | string[]>,
  optionalSeparator?: ExpressionContent<string>,
) {
  const expression = Expression.create("join(", str(array));

  if (optionalSeparator) {
    expression.add(", ", str(optionalSeparator));
  }

  return expression.add(")").cast<string>();
}

/**
 * Concat a list of expressions and strings into usesable output.
 */
export function concat(
  first: ExpressionContent,
  second: ExpressionContent,
  ...rest: Array<ExpressionContent>
) {
  const all = [first, second, ...rest];

  return all.map((item) =>
    typeof item === "string" ? item : Expression.create(item).wrap()
  ).join("");
}

export function toJSON(value: ExpressionContent) {
  return Expression.create("toJSON(", str(value), ")").cast<string>();
}

export function fromJSON(value: ExpressionContent<string>) {
  return Expression.create("fromJSON(", str(value), ")");
}

export function hashFiles(...patterns: [string, ...string[]]) {
  const [path, ...rest] = patterns;
  const expression = Expression.create("hashFiles(", str(path));

  for (const pattern of rest) {
    expression.add(", ", str(pattern));
  }

  return expression.add(")").cast<string>();
}

/**
 * Causes the step to always execute, and returns true, even when canceled. A
 * job or step will not run when a critical failure prevents the task from
 * running. For example, if getting sources failed.
 */
export function always() {
  return Expression.create("always()").cast<boolean>();
}

/** Returns true when none of the previous steps have failed or been canceled. */
export function success() {
  return Expression.create("success()").cast<boolean>();
}

/**
 * Returns true if the workflow was canceled.
 */
export function cancelled() {
  return Expression.create("cancelled()").cast<boolean>();
}

/**
 * Returns true when any previous step of a job fails. If you have a chain of
 * dependent jobs, failure() returns true if any ancestor job fails.
 */
export function failure() {
  return Expression.create("failure()").cast<boolean>();
}

/**
 * Wrap content as an expression.
 */
export function expr<Type = unknown>(
  content: ExpressionContent<Type> | undefined,
) {
  return Expression.create(str(content));
}

export function context<
  Base extends ActionTemplate = ActionTemplate,
>(): Contextify<ActionData<Base>> {
  return proxy();
}

/**
 * Default context settings.
 */
export const ctx = context();

export type Contextify<Data> = {
  [Key in keyof Data]: Context<Data[Key]>;
};

export type ContextFunction<
  Type,
  Base extends ActionTemplate = ActionTemplate,
> = (ctx: Contextify<ActionData<Base>>) => Type;
export type WithContext<
  Type,
  Base extends ActionTemplate = ActionTemplate,
> =
  | Type
  | ContextFunction<Type, Base>;

type SupportedPrimitives = number | null | string | boolean;
type A = ExtractPrimitive<unknown>;
type B = unknown extends string ? "true" : "false";
type ExtractPrimitive<Type> = Type extends Array<infer T>
  ? T extends SupportedPrimitives ? T[] : never
  : Extract<Type, SupportedPrimitives>;
// type BaseType<Type = unknown> = true extends IsUnknown<Type> ? number | null | string | boolean :
export type ExpressionContent<
  Type = SupportedPrimitives,
> =
  | ExpressionValue<Type>
  | BaseContext<Type>;

export type ExpressionValue<Type = SupportedPrimitives> =
  | ExtractPrimitive<Type>
  | Expression<Type>;

function mapContentToString<Type = unknown>(
  content: ExpressionContent<Type> | string,
): string {
  if (Array.isArray(content)) {
    const values: string[] = [];

    for (const item in content) {
      values.push(mapContentToString(item));
    }

    return values.join(", ");
  }

  if (content == null) {
    return "";
  }

  return content.toString();
}

function str<Type>(value: Type): string | Type {
  return typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : value;
}
