"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Indie_Flower } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { normalizeCouponCode } from "../../lib/coupon-code";
import { useCouponValidity } from "../hooks/useCoupon";
import VideoFirstFrame from "./VideoFirstFrame";

const indie = Indie_Flower({ subsets: ["latin"], weight: ["400"] });
const knobWidth = 56;

type HomePageClientProps = {
  initialCode: string | null;
};

export default function HomePageClient({ initialCode }: HomePageClientProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [sliderX, setSliderX] = useState(0);
  const router = useRouter();
  const code = initialCode === null ? null : normalizeCouponCode(initialCode);
  const status = useCouponValidity(code);
  const canRedeem = status === "ok" && !redeeming;

  const resetSlider = () => {
    setSliderX(0);
  };

  const getMaxOffset = () => {
    if (!trackRef.current) return 0;
    return Math.max(trackRef.current.clientWidth - knobWidth, 0);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canRedeem) {
      return;
    }

    event.preventDefault();
    setDragging(true);
  };

  const handlePointerUp = async () => {
    if (!dragging) return;

    setDragging(false);
    const maxOffset = getMaxOffset();
    const progress = maxOffset === 0 ? 0 : sliderX / maxOffset;

    if (progress < 0.8) {
      resetSlider();
      return;
    }

    if (!code) {
      router.replace("/error?reason=invalid");
      return;
    }

    if (redeeming) {
      return;
    }

    setRedeeming(true);
    try {
      const response = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        router.replace(`/redeemed?c=${encodeURIComponent(code)}`);
        return;
      }

      let reason = "server";
      if (response.status === 409) {
        reason = "redeemed";
      } else if (response.status === 404) {
        reason = "invalid";
      } else if (response.status === 403) {
        const payload = (await response.json().catch(() => null)) as { reason?: string } | null;
        reason = payload?.reason === "scheduled" ? "scheduled" : "expired";
      }
      router.replace(`/error?reason=${reason}&c=${encodeURIComponent(code)}`);
    } catch {
      router.replace(`/error?reason=server&c=${encodeURIComponent(code)}`);
    } finally {
      setRedeeming(false);
      resetSlider();
    }
  };

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!trackRef.current) return;

      const trackRect = trackRef.current.getBoundingClientRect();
      const startX = trackRect.left;
      const endX = trackRect.right - knobWidth;
      const nextX = Math.min(Math.max(event.clientX - knobWidth / 2, startX), endX);
      setSliderX(nextX - startX);
    };

    const handleGlobalPointerUp = () => {
      void handlePointerUp();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [dragging, sliderX, code, redeeming]);

  useEffect(() => {
    if (status === "invalid") {
      const suffix = code ? `&c=${encodeURIComponent(code)}` : "";
      router.replace(`/error?reason=invalid${suffix}`);
      return;
    }

    if (status === "redeemed") {
      const suffix = code ? `&c=${encodeURIComponent(code)}` : "";
      router.replace(`/error?reason=redeemed${suffix}`);
      return;
    }

    if (status === "scheduled") {
      const suffix = code ? `&c=${encodeURIComponent(code)}` : "";
      router.replace(`/error?reason=scheduled${suffix}`);
      return;
    }

    if (status === "expired") {
      const suffix = code ? `&c=${encodeURIComponent(code)}` : "";
      router.replace(`/error?reason=expired${suffix}`);
    }
  }, [status, code, router]);

  return (
    <main className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-between p-6 sm:p-8 pb-footer">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col items-center">
        <div className="pt-6 pb-4 text-center h-32 flex flex-col justify-center">
          <h1 className={`text-3xl font-bold font-thick leading-relaxed ${indie.className}`}>
            Thank you for your contribution to
            <span className="block">AI Fusion Labs!</span>
          </h1>
        </div>

        <div className="my-10 w-48 h-48 rounded-full overflow-hidden flex items-center justify-center">
          <VideoFirstFrame src="/coffee-logo.mp4" size={192} alt="Empty coffee cup" />
        </div>

        <div className="w-full">
          <div
            ref={trackRef}
            className="relative w-full max-w-sm mx-auto h-14 rounded-full bg-gray-200 flex items-center select-none touch-none"
          >
            <span className="absolute inset-0 flex items-center justify-center text-gray-600 pointer-events-none font-bold">
              {redeeming ? "Redeeming..." : status === "checking" ? "Checking your coupon..." : "Slide to Redeem →"}
            </span>
            <button
              onPointerDown={handlePointerDown}
              disabled={!canRedeem}
              className={`z-10 w-14 h-14 rounded-full bg-black text-white flex items-center justify-center shadow-md active:scale-[0.98] ${
                canRedeem ? "" : "opacity-60 cursor-not-allowed"
              }`}
              aria-label="Slide to redeem"
              style={{
                transform: `translateX(${sliderX}px)`,
                transition: dragging ? "none" : "transform 200ms ease",
              }}
            >
              ▶
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-gray-600">
            Please ask a staff member to redeem this for you when you are ready to order.
          </p>

          <footer className="w-full max-w-sm mx-auto mt-32 pb-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src="/webe-cafe-logo.jpg"
                  alt="webe cafe logo"
                  width={80}
                  height={80}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span>Vibe coded by AI Fusion Labs</span>
              <Image src="/aifusionlabs-logo.png" alt="AI Fusion Labs logo" width={30} height={30} />
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
