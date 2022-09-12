import { arrayIncludes } from "./deps/just.ts";
import { Primitive } from "./deps/types.ts";
import { BaseContext } from "./types.ts";

const z$__context__$: BaseContext["z$__context__$"] = "$__CONTEXT__$";

export function createContext<Type>(
  keys: string[],
): Context<Type> {
  return Object.create({
    z$__context__$,
    z$__keys__$: keys,
    toString: () => keys.join("."),
    // [Symbol.toStringTag]: () => keys.join("."),
    toJSON: () => keys.join("."),
  });
}

export function isContext<Type = any>(value: unknown): value is Context<Type> {
  return (value as any)?.__context__ === z$__context__$;
}

const BUILTIN_KEYS = [
  "z$__context__$",
  "z$__keys__$",
  "toString",
] as const;

/**
 * Create the top level context object for the GitHub object.
 */
export function proxy<Type>(): Type {
  function create(ctx: BaseContext): BaseContext {
    return new Proxy(ctx, {
      get: (target, key) => {
        if (typeof key !== "string" || key === "toJSON") {
          return (target as any)[key];
        }

        if (arrayIncludes(BUILTIN_KEYS, key)) {
          return target[key];
        }

        return create(createContext([...target.z$__keys__$, key]));
      },
      set: () => {
        throw new ReferenceError("Context is readonly");
      },
    });
  }

  // @ts-expect-error This type would be very difficult to infer due to the
  // builder pattern.
  return create(createContext([]));
}

export type Context<Type> = BaseContext<Type> & Contextify<Type>;
type Contextify<Type> = Type extends BaseContext<infer T> ? Contextify<T>
  : Type extends Primitive ? {}
  : Type extends object
    ? Type extends Array<infer T>
      ? T[] extends Type ? Array<Context<T>> & { "*": Context<T> }
      : ContextifyObject<Type> & { "*": ContextifyObject<Type>[number] }
    : ContextifyObject<Type> & { "*": ContextifyObject<Type>[keyof Type] }
  : Type;
type ContextifyObject<Type> = { [Key in keyof Type]: Context<Type[Key]> };

type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;
export type IsAny<T> = IfAny<T, true, never>;
