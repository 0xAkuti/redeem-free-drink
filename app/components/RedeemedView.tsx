"use client";

import { useState } from "react";

export default function RedeemedView() {
  const [isShaking, setIsShaking] = useState(false);

  const handleCoffeeClick = () => {
    if (isShaking) return;

    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 600);
  };

  return (
    <>
      <div className="my-10 w-48 h-48 rounded-full overflow-hidden flex items-center justify-center">
        <video
          src="/coffee-logo.mp4"
          autoPlay
          muted
          playsInline
          onClick={handleCoffeeClick}
          className={`w-full h-full object-cover cursor-pointer transition-transform duration-75 ${
            isShaking ? "animate-shake" : ""
          }`}
          aria-label="Coffee cup - click to shake!"
          title="Click me to shake!"
        />
      </div>

      <div className="text-center">
        <p className="text-xl font-semibold">Redeemed!</p>
      </div>
    </>
  );
}
