import { generateCouponCodes } from "../lib/coupon-code";
import { closeRedisClient, getCouponTtlFromEnv, seedCoupons } from "../lib/coupons";
import { parseCouponCliArgs } from "./lib/cli";

async function main() {
  const cliOptions = parseCouponCliArgs(process.argv.slice(2));
  const count = cliOptions.count ?? Number(process.env.COUNT || 50);
  const baseUrl = cliOptions.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000";
  const ttlSeconds = cliOptions.ttlSeconds ?? getCouponTtlFromEnv();

  console.log(`Generating ${count} production coupon codes...`);
  const codes = generateCouponCodes(count);
  await seedCoupons(codes, { ttlSeconds });

  console.log("\n✅ Generated codes:\n");
  for (const code of codes) {
    console.log(`${code},${baseUrl}/?c=${code}`);
  }
  
  console.log(`\n📊 Total: ${count} codes generated`);
  console.log(`🌐 Base URL: ${baseUrl}`);
  if (ttlSeconds) {
    console.log(`⏳ TTL: ${ttlSeconds} seconds`);
  }
  console.log("🛠️  Flags: --count <n> --base-url <url> --ttl <seconds>");
}

main()
  .catch((e) => {
    console.error("❌ Error generating codes:", e);
    process.exit(1);
  })
  .finally(async () => {
    await closeRedisClient();
  });
