// Minimal stand-in for next/headers in tests.
export async function headers(): Promise<Headers> {
  return new Headers({ "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" });
}
export async function cookies(): Promise<{ get: () => undefined }> {
  return { get: () => undefined };
}
