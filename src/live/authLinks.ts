import { authLinkFailure } from "../services/nativeAuth";
export const AUTH_REDIRECT = "moresbymarket://auth/callback";

type AuthLink = { code: string; flowId?: string } | { error: string } | null;
export function parseAuthLink(url: string): AuthLink {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "moresbymarket:" ||
      parsed.hostname !== "auth" ||
      parsed.pathname !== "/callback"
    )
      return null;
    const params = parsed.searchParams;
    if (params.has("error")) return { error: "link_rejected" };
    const code = params.get("code");
    if (!code) return { error: "missing_code" };
    const flowId = params.get("sb_flow_id");
    if (flowId && !/^[a-zA-Z0-9_-]{8,64}$/.test(flowId))
      return { error: "invalid_flow" };
    return { code, ...(flowId ? { flowId } : {}) };
  } catch {
    return null;
  }
}

// iOS can deliver the launch URL through both the initial URL and URL event.
// A one-use code must be exchanged only once, even while its request is pending.
export function createAuthLinkHandler(
  exchange: (
    code: string,
    options?: { flowId: string },
  ) => Promise<{ error: unknown }>,
  onFailure: (reason: string) => void,
) {
  const handled = new Set<string>();
  return async (url: string) => {
    const link = parseAuthLink(url);
    if (!link) return;
    const identity = "code" in link ? link.code : link.error;
    if (handled.has(identity)) return;
    handled.add(identity);
    // Keep only a bounded in-memory history; never persist or log auth URLs.
    if (handled.size > 20) handled.delete(handled.values().next().value!);
    if ("error" in link) {
      onFailure(link.error);
      return;
    }
    try {
      const result = await exchange(
        link.code,
        link.flowId ? { flowId: link.flowId } : undefined,
      );
      if (result.error) throw result.error;
    } catch (error) {
      onFailure(authLinkFailure(error));
    }
  };
}
