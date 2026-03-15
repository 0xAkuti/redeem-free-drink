"use client";

import { useEffect, useState } from "react";

export function useCouponValidity(code: string | null) {
  const [status, setStatus] = useState<"checking" | "ok" | "invalid" | "redeemed">("checking");

  useEffect(() => {
    if (code === null) {
      setStatus("invalid");
      return;
    }
    if (!code) {
      setStatus("invalid");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/coupons/status?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        if (!data.exists) {
          setStatus("invalid");
        } else if (data.redeemed) {
          setStatus("redeemed");
        } else {
          setStatus("ok");
        }
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return status;
}
