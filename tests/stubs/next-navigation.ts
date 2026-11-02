export class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}
export function redirect(url: string): never {
  throw new RedirectError(url);
}
export function unstable_rethrow(err: unknown): void {
  if (err instanceof RedirectError) throw err;
}
