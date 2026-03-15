import { normalizeCouponCode } from "./coupon-code";
import { getRedisClient } from "./redis";

export type CouponStatus = "available" | "redeemed" | "missing";
export type CouponDetails = {
  code: string;
  status: CouponStatus;
  createdAt: string | null;
  redeemedAt: string | null;
  ttlSeconds: number | null;
};

export type CouponSummary = {
  total: number;
  available: number;
  redeemed: number;
};

const definitionPrefix = "coupon:def:";
const redemptionPrefix = "coupon:red:";

function definitionKey(code: string) {
  return `${definitionPrefix}${code}`;
}

function redemptionKey(code: string) {
  return `${redemptionPrefix}${code}`;
}

function codeFromDefinitionKey(key: string) {
  return key.slice(definitionPrefix.length);
}

function parseOptionalTtl(rawValue: string | undefined) {
  if (!rawValue) return null;

  const ttl = Number(rawValue);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error("COUPON_TTL_SECONDS must be a positive integer");
  }

  return ttl;
}

export async function getCouponStatus(rawCode: string | null | undefined) {
  const code = normalizeCouponCode(rawCode);
  if (code.length !== 8) {
    return "missing" as const;
  }

  const redis = await getRedisClient();
  const [exists, redeemed] = await Promise.all([
    redis.exists(definitionKey(code)),
    redis.exists(redemptionKey(code)),
  ]);

  if (exists !== 1) {
    return "missing" as const;
  }

  return redeemed === 1 ? "redeemed" : "available";
}

export async function redeemCoupon(rawCode: string | null | undefined) {
  const code = normalizeCouponCode(rawCode);
  if (code.length !== 8) {
    return "missing" as const;
  }

  const redis = await getRedisClient();
  const now = new Date().toISOString();
  const result = await redis.eval(
    [
      "if redis.call('EXISTS', KEYS[1]) == 0 then",
      "  return 'missing'",
      "end",
      "if redis.call('EXISTS', KEYS[2]) == 1 then",
      "  return 'redeemed'",
      "end",
      "local ttl = redis.call('PTTL', KEYS[1])",
      "if ttl > 0 then",
      "  redis.call('PSETEX', KEYS[2], ttl, ARGV[1])",
      "else",
      "  redis.call('SET', KEYS[2], ARGV[1])",
      "end",
      "return 'available'",
    ].join("\n"),
    {
      keys: [definitionKey(code), redemptionKey(code)],
      arguments: [now],
    }
  );

  return result as CouponStatus;
}

export async function seedCoupons(codes: string[], options?: { ttlSeconds?: number | null }) {
  const normalizedCodes = codes.map((code) => normalizeCouponCode(code));
  const ttlSeconds = options?.ttlSeconds ?? null;
  const redis = await getRedisClient();
  const results = await Promise.all(
    normalizedCodes.map((code) => {
      const key = definitionKey(code);
      const value = new Date().toISOString();

      if (ttlSeconds) {
        return redis.set(key, value, { EX: ttlSeconds, NX: true });
      }

      return redis.set(key, value, { NX: true });
    })
  );

  const duplicates = normalizedCodes.filter((_, index) => results[index] !== "OK");

  if (duplicates.length > 0) {
    throw new Error(`Duplicate coupon codes already exist: ${duplicates.join(", ")}`);
  }

  return normalizedCodes;
}

export async function inspectCoupon(rawCode: string | null | undefined) {
  const code = normalizeCouponCode(rawCode);
  if (code.length !== 8) {
    throw new Error("Coupon codes must be 8 characters");
  }

  const redis = await getRedisClient();
  const [createdAt, redeemedAt, ttlMs] = await Promise.all([
    redis.get(definitionKey(code)),
    redis.get(redemptionKey(code)),
    redis.pTTL(definitionKey(code)),
  ]);

  const status: CouponStatus = !createdAt ? "missing" : redeemedAt ? "redeemed" : "available";

  return {
    code,
    status,
    createdAt,
    redeemedAt,
    ttlSeconds: ttlMs > 0 ? Math.ceil(ttlMs / 1000) : null,
  } satisfies CouponDetails;
}

export async function revokeCoupon(rawCode: string | null | undefined) {
  const code = normalizeCouponCode(rawCode);
  if (code.length !== 8) {
    throw new Error("Coupon codes must be 8 characters");
  }

  const redis = await getRedisClient();
  const deleted = await redis.del([definitionKey(code), redemptionKey(code)]);

  return {
    code,
    deleted,
  };
}

export async function summarizeCoupons() {
  const redis = await getRedisClient();
  let total = 0;
  let redeemed = 0;

  for await (const key of redis.scanIterator({ MATCH: `${definitionPrefix}*` })) {
    total += 1;
    const code = codeFromDefinitionKey(key);
    if (await redis.exists(redemptionKey(code))) {
      redeemed += 1;
    }
  }

  return {
    total,
    available: total - redeemed,
    redeemed,
  } satisfies CouponSummary;
}

export async function closeRedisClient() {
  if (!global.redisClientPromise) {
    return;
  }

  const client = await global.redisClientPromise;
  if (client.isOpen) {
    await client.quit();
  }
  global.redisClientPromise = undefined;
}

export function getCouponTtlFromEnv() {
  return parseOptionalTtl(process.env.COUPON_TTL_SECONDS);
}
