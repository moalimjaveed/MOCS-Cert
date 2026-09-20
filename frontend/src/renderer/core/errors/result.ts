/**
 * Explicit Result<T, E> pattern for fail-closed scientific computations.
 * Disallows throwing untyped runtime errors or silently returning undefined/null.
 */

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T; readonly error?: never }
  | { readonly ok: false; readonly error: E; readonly value?: never };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T; readonly error?: never } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E; readonly value?: never } {
  return !result.ok;
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (val: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function flatMapResult<T, U, E, E2 = E>(
  result: Result<T, E>,
  fn: (val: T) => Result<U, E2>
): Result<U, E | E2> {
  return result.ok ? fn(result.value) : result;
}

export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
}

export function unwrapResultOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
