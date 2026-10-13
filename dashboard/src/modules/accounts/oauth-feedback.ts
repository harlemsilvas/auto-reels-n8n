export const oauthErrorCodes = [
  "access_denied", "invalid_oauth_state", "missing_oauth_code", "no_facebook_pages",
  "no_instagram_account", "meta_configuration_unavailable", "oauth_callback_error",
] as const;
export type OAuthErrorCode = typeof oauthErrorCodes[number];
export type OAuthFeedback = { kind: "error"; code: OAuthErrorCode } |
  { kind: "connected"; accountId: string | null } | null;

export function readOAuthFeedback(params: URLSearchParams): OAuthFeedback {
  if (params.has("error")) {
    const code = oauthErrorCodes.find(item => item === params.get("error")) ?? "oauth_callback_error";
    return { kind: "error", code };
  }
  if (params.get("connected") === "true") {
    const id = params.get("accountId");
    return { kind: "connected", accountId: id && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ? id.toLowerCase() : null };
  }
  return null;
}
