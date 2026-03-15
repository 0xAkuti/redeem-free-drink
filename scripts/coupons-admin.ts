import { closeRedisClient, getCouponTtlFromEnv, inspectCoupon, revokeCoupon, seedCoupons, summarizeCoupons } from "../lib/coupons";
import { normalizeCouponCode } from "../lib/coupon-code";

type AdminAction =
  | { type: "summary" }
  | { type: "inspect"; code: string }
  | { type: "revoke"; code: string }
  | { type: "import"; codes: string[]; ttlSeconds: number | null };

function usage() {
  return [
    "Usage:",
    "  npm run coupons -- --summary",
    "  npm run coupons -- --inspect CODE1234",
    "  npm run coupons -- --revoke CODE1234",
    "  npm run coupons -- --import CODE1234,ABCD5678 [--ttl 14400]",
    "",
    "Notes:",
    "  REDIS_URL must be set in the environment.",
    "  --ttl overrides COUPON_TTL_SECONDS for --import.",
  ].join("\n");
}

function parsePositiveInteger(flagName: string, rawValue: string | undefined) {
  if (!rawValue) {
    throw new Error(`Missing value for ${flagName}`);
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }

  return value;
}

function parseCodeList(rawValue: string | undefined) {
  if (!rawValue) {
    throw new Error("Missing value for --import");
  }

  const codes = rawValue
    .split(",")
    .map((code) => normalizeCouponCode(code))
    .filter(Boolean);

  if (codes.length === 0) {
    throw new Error("No valid coupon codes were provided");
  }

  return codes;
}

function parseAdminArgs(argv: string[]): AdminAction {
  let action: AdminAction | null = null;
  let ttlSeconds: number | null | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--summary") {
      action = { type: "summary" };
      continue;
    }

    if (arg === "--inspect") {
      action = { type: "inspect", code: normalizeCouponCode(argv[index + 1]) };
      index += 1;
      continue;
    }

    if (arg === "--revoke") {
      action = { type: "revoke", code: normalizeCouponCode(argv[index + 1]) };
      index += 1;
      continue;
    }

    if (arg === "--import") {
      action = { type: "import", codes: parseCodeList(argv[index + 1]), ttlSeconds: null };
      index += 1;
      continue;
    }

    if (arg === "--ttl") {
      ttlSeconds = parsePositiveInteger(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!action) {
    throw new Error(usage());
  }

  if (action.type === "import") {
    return {
      ...action,
      ttlSeconds: ttlSeconds ?? getCouponTtlFromEnv(),
    };
  }

  if (ttlSeconds !== undefined) {
    throw new Error("--ttl can only be used with --import");
  }

  return action;
}

async function main() {
  const action = parseAdminArgs(process.argv.slice(2));

  if (action.type === "summary") {
    const summary = await summarizeCoupons();
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (action.type === "inspect") {
    const coupon = await inspectCoupon(action.code);
    console.log(JSON.stringify(coupon, null, 2));
    return;
  }

  if (action.type === "revoke") {
    const result = await revokeCoupon(action.code);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const seededCodes = await seedCoupons(action.codes, { ttlSeconds: action.ttlSeconds });
  console.log(
    JSON.stringify(
      {
        imported: seededCodes.length,
        ttlSeconds: action.ttlSeconds,
        codes: seededCodes,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await closeRedisClient();
  });
