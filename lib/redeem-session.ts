import { createHmac, timingSafeEqual } from "crypto";

const redeemCookieName = "redeem_session";
const redeemCookieMaxAgeSeconds = 60;

function getRedeemSessionSecret() {
  const secret = process.env.REDEEM_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing REDEEM_SESSION_SECRET");
  }
  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getRedeemSessionSecret()).update(payload).digest("base64url");
}

export function getRedeemSessionCookieName() {
  return redeemCookieName;
}

export function getRedeemSessionCookieMaxAgeSeconds() {
  return redeemCookieMaxAgeSeconds;
}

export function createRedeemSession(code: string) {
  const expiresAt = Date.now() + redeemCookieMaxAgeSeconds * 1000;
  const payload = `${code}:${expiresAt}`;
  const signature = signPayload(payload);
  return `${payload}:${signature}`;
}

export function verifyRedeemSession(sessionValue: string | undefined) {
  if (!sessionValue) {
    return false;
  }

  const parts = sessionValue.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [code, expiresAtRaw, signature] = parts;
  if (!code || code.length !== 8) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = signPayload(`${code}:${expiresAtRaw}`);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
