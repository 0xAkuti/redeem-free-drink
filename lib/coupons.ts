import { normalizeCouponCode } from "./coupon-code";
import { getUtcDateString, type SundayCoupon } from "./coupon-schedule";
import { getRedisClient } from "./redis";

export type CouponStatus = "available" | "redeemed" | "missing" | "scheduled" | "expired";
export type CouponDetails = {
  code: string;
  status: CouponStatus;
  createdAt: string | null;
  redeemedAt: string | null;
  ttlSeconds: number | null;
  validOn: string | null;
};

export type CouponSummary = {
  total: number;
  available: number;
  redeemed: number;
  scheduled: number;
  expired: number;
};

type CouponDefinition = {
  createdAt: string;
  validOn: string | null;
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

function serializeCouponDefinition(definition: CouponDefinition) {
  return JSON.stringify(definition);
}

function parseCouponDefinition(rawValue: string | null): CouponDefinition | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<CouponDefinition>;
    if (typeof parsed.createdAt === "string") {
      return {
        createdAt: parsed.createdAt,
        validOn: typeof parsed.validOn === "string" ? parsed.validOn : null,
      };
    }
  } catch {
    // Legacy plain-string definitions fall through below.
  }

  return {
    createdAt: rawValue,
    validOn: null,
  };
}

function getCouponWindowStatus(definition: CouponDefinition, today = getUtcDateString()) {
  if (!definition.validOn) {
    return "available" as const;
  }

  if (today < definition.validOn) {
    return "scheduled" as const;
  }

  if (today > definition.validOn) {
    return "expired" as const;
  }

  return "available" as const;
}

export async function getCouponStatus(rawCode: string | null | undefined) {
  const code = normalizeCouponCode(rawCode);
  if (code.length !== 8) {
    return "missing" as const;
  }

  const redis = await getRedisClient();
  const [definitionRaw, redeemed] = await Promise.all([
    redis.get(definitionKey(code)),
    redis.exists(redemptionKey(code)),
  ]);
  const definition = parseCouponDefinition(definitionRaw);

  if (!definition) {
    return "missing" as const;
  }

  const windowStatus = getCouponWindowStatus(definition);
  if (windowStatus !== "available") {
    return windowStatus;
  }

  return redeemed === 1 ? "redeemed" : "available";
}

export async function redeemCoupon(rawCode: string | null | undefined) {
  const code = normalizeCouponCode(rawCode);
  if (code.length !== 8) {
    return "missing" as const;
  }

  const redis = await getRedisClient();
  const definition = parseCouponDefinition(await redis.get(definitionKey(code)));
  if (!definition) {
    return "missing" as const;
  }

  const windowStatus = getCouponWindowStatus(definition);
  if (windowStatus !== "available") {
    return windowStatus;
  }

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
      const value = serializeCouponDefinition({
        createdAt: new Date().toISOString(),
        validOn: null,
      });

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

export async function seedSundayCoupons(coupons: SundayCoupon[]) {
  const redis = await getRedisClient();
  const createdAt = new Date().toISOString();
  const results = await Promise.all(
    coupons.map(({ code, validOn }) =>
      redis.set(
        definitionKey(normalizeCouponCode(code)),
        serializeCouponDefinition({ createdAt, validOn }),
        { NX: true }
      )
    )
  );

  const duplicates = coupons.filter((_, index) => results[index] !== "OK");
  if (duplicates.length > 0) {
    throw new Error(`Duplicate coupon codes already exist: ${duplicates.map((coupon) => coupon.code).join(", ")}`);
  }

  return coupons.map((coupon) => ({
    ...coupon,
    code: normalizeCouponCode(coupon.code),
  }));
}

export async function inspectCoupon(rawCode: string | null | undefined) {
  const code = normalizeCouponCode(rawCode);
  if (code.length !== 8) {
    throw new Error("Coupon codes must be 8 characters");
  }

  const redis = await getRedisClient();
  const [definitionRaw, redeemedAt, ttlMs] = await Promise.all([
    redis.get(definitionKey(code)),
    redis.get(redemptionKey(code)),
    redis.pTTL(definitionKey(code)),
  ]);
  const definition = parseCouponDefinition(definitionRaw);

  let status: CouponStatus = "missing";
  if (definition) {
    status = redeemedAt ? "redeemed" : getCouponWindowStatus(definition);
  }

  return {
    code,
    status,
    createdAt: definition?.createdAt ?? null,
    redeemedAt,
    ttlSeconds: ttlMs > 0 ? Math.ceil(ttlMs / 1000) : null,
    validOn: definition?.validOn ?? null,
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
  let available = 0;
  let redeemed = 0;
  let scheduled = 0;
  let expired = 0;

  for await (const key of redis.scanIterator({ MATCH: `${definitionPrefix}*` })) {
    total += 1;
    const code = codeFromDefinitionKey(key);
    const [definitionRaw, isRedeemed] = await Promise.all([
      redis.get(key),
      redis.exists(redemptionKey(code)),
    ]);
    const definition = parseCouponDefinition(definitionRaw);
    if (!definition) {
      continue;
    }
    if (isRedeemed) {
      redeemed += 1;
      continue;
    }

    const status = getCouponWindowStatus(definition);
    if (status === "scheduled") {
      scheduled += 1;
    } else if (status === "expired") {
      expired += 1;
    } else {
      available += 1;
    }
  }

  return {
    total,
    available,
    redeemed,
    scheduled,
    expired,
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
