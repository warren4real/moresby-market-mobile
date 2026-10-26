export const AUTH_STORAGE_KEY = "marketples-auth-v1";
type Storage = { getItem: (key: string) => Promise<string | null> };
const validFlow = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(value);

// auth-js 2.118's default exchange reads window.location.href when a runtime
// exposes window/document. Native DOM globals need not include browser location.
// Resolve the SDK's persisted PKCE slot explicitly, then use its public exchange
// API. The fixed-key match preserves the SDK's legacy/latest-flow semantics.
export async function nativeFlowOptions(
  storage: Storage,
  flowId?: string,
): Promise<{ flowId: string }> {
  if (flowId) {
    if (!validFlow(flowId))
      throw Object.assign(new Error("Invalid authentication flow"), {
        code: "invalid_flow",
      });
    return { flowId };
  }
  const raw = await storage.getItem(`${AUTH_STORAGE_KEY}-flows-code-verifier`);
  const legacyRaw = await storage.getItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  const index: unknown = raw ? JSON.parse(raw) : null,
    legacy: unknown = legacyRaw ? JSON.parse(legacyRaw) : null;
  if (Array.isArray(index) && typeof legacy === "string") {
    for (const id of [...index].reverse().filter(validFlow)) {
      const slot = await storage.getItem(
        `${AUTH_STORAGE_KEY}-flow-${id}-code-verifier`,
      );
      if (slot && JSON.parse(slot) === legacy) return { flowId: id };
    }
  }
  throw Object.assign(new Error("Request a fresh link on this phone"), {
    code: "pkce_code_verifier_not_found",
  });
}

export function authLinkFailure(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "pkce_code_verifier_not_found") return "missing_verifier";
  if (
    code === "flow_state_expired" ||
    code === "flow_state_not_found" ||
    code === "otp_expired"
  )
    return "expired_link";
  if ((error as { name?: string })?.name === "AuthRetryableFetchError")
    return "network";
  return "exchange_failed";
}
