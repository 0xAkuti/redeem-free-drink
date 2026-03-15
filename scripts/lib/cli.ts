type CouponCliOptions = {
  baseUrl?: string;
  count?: number;
  ttlSeconds?: number | null;
};

function parseIntegerFlag(flagName: string, rawValue: string | undefined) {
  if (!rawValue) {
    throw new Error(`Missing value for ${flagName}`);
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }

  return value;
}

export function parseCouponCliArgs(argv: string[]) {
  const options: CouponCliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--count") {
      options.count = parseIntegerFlag(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--base-url") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --base-url");
      }
      options.baseUrl = value;
      index += 1;
      continue;
    }

    if (arg === "--ttl") {
      options.ttlSeconds = parseIntegerFlag(arg, argv[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}
