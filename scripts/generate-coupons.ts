import { generateCouponCodes } from "../lib/coupon-code";
import { closeRedisClient, getCouponTtlFromEnv, seedCoupons } from "../lib/coupons";
import { parseCouponCliArgs } from "./lib/cli";

async function main() {
  const cliOptions = parseCouponCliArgs(process.argv.slice(2));
  const count = cliOptions.count ?? Number(process.env.COUNT || 10);
  const baseUrl = cliOptions.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000";
  const ttlSeconds = cliOptions.ttlSeconds ?? getCouponTtlFromEnv();
  const codes = generateCouponCodes(count);
  await seedCoupons(codes, { ttlSeconds });

  console.log("Generated codes:\n");
  for (const code of codes) {
    console.log(`${code},${baseUrl}/?c=${code}`);
  }

  if (ttlSeconds) {
    console.log(`\nCodes expire after ${ttlSeconds} seconds.`);
  }

  console.log("\nFlags: --count <n> --base-url <url> --ttl <seconds>");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await closeRedisClient();
  });
