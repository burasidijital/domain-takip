import { NextRequest } from "next/server";

const SECURE_TOKEN = "hizmet_takip_admin_token_2026";

export function isAuthenticated(req: NextRequest): boolean {
  // 1. Check matching headers (highly reliable in iframe localstorage fallbacks)
  const authHeader = req.headers.get("x-auth-token");
  if (authHeader === SECURE_TOKEN) {
    return true;
  }

  // 2. Fallback to cookies
  const cookieSession = req.cookies.get("session_token")?.value;
  if (cookieSession === SECURE_TOKEN) {
    return true;
  }

  return false;
}

export function getSessionToken() {
  return SECURE_TOKEN;
}
