import { closeRedisClient, seedSundayCoupons } from "../lib/coupons";
import { buildSundayCoupons } from "../lib/coupon-schedule";
import { parseCouponCliArgs } from "./lib/cli";

async function main() {
  const cliOptions = parseCouponCliArgs(process.argv.slice(2));
  const baseUrl = cliOptions.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000";
  const years = cliOptions.years ?? Number(process.env.YEARS || 3);
  const coupons = buildSundayCoupons(years);
  await seedSundayCoupons(coupons);

  console.log("date,code,link");
  for (const coupon of coupons) {
    console.log(`${coupon.validOn},${coupon.code},${baseUrl}/?c=${coupon.code}`);
  }

  console.error(`Generated ${coupons.length} Sunday coupons for ${years} year(s).`);
  console.error("Flags: --years <n> --base-url <url>");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await closeRedisClient();
  });
