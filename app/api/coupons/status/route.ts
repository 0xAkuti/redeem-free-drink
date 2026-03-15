import { getCouponStatus } from "../../../../lib/coupons";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ exists: false, redeemed: false }, { status: 400 });
  }

  try {
    const status = await getCouponStatus(code);
    return NextResponse.json(
      {
        exists: status !== "missing",
        redeemed: status === "redeemed",
        status,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
