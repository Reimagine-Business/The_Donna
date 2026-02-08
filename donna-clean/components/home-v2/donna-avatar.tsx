"use client";

import { useState } from "react";
import Image from "next/image";

export function DonnaAvatar() {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative flex justify-center items-center py-8">
      {/* Glow ring background */}
      <div className="absolute inset-0 flex justify-center items-center">
        <div
          className="w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,165,0,0.3) 0%, rgba(255,105,180,0.2) 50%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />
      </div>

      {/* Orange-pink gradient ring */}
      <div className="relative w-56 h-56 rounded-full p-1 bg-gradient-to-br from-orange-400 via-pink-400 to-purple-400">
        {/* Inner dark circle */}
        <div className="w-full h-full rounded-full bg-[#0a0a1a] p-4 flex items-center justify-center overflow-hidden">
          {imgError ? (
            <DonnaFallback />
          ) : (
            <Image
              src="/images/donna/donna-avatar.png"
              alt="Donna - Your Financial Assistant"
              width={400}
              height={400}
              className="object-contain"
              priority
              unoptimized
              onError={() => setImgError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** SVG fallback when donna-avatar.png is not yet added */
function DonnaFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg
        viewBox="0 0 120 120"
        className="w-28 h-28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Head */}
        <circle cx="60" cy="40" r="24" fill="#B39DDB" />
        {/* Body */}
        <path
          d="M35 95 C35 70 85 70 85 95"
          fill="#9575CD"
        />
        {/* Eyes */}
        <circle cx="52" cy="37" r="3" fill="#1a1a2e" />
        <circle cx="68" cy="37" r="3" fill="#1a1a2e" />
        {/* Smile */}
        <path
          d="M52 47 Q60 54 68 47"
          stroke="#1a1a2e"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Headphones */}
        <path
          d="M36 35 Q36 15 60 15 Q84 15 84 35"
          stroke="#E0E0E0"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="30" y="30" width="8" height="14" rx="4" fill="#E0E0E0" />
        <rect x="82" y="30" width="8" height="14" rx="4" fill="#E0E0E0" />
        {/* Tablet */}
        <rect x="72" y="72" width="18" height="24" rx="3" fill="url(#tablet-grad)" />
        <defs>
          <linearGradient id="tablet-grad" x1="72" y1="72" x2="90" y2="96" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F8BBD0" />
            <stop offset="1" stopColor="#CE93D8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
