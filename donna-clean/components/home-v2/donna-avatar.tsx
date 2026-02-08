"use client";

import Image from "next/image";

export function DonnaAvatar() {
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
        <div className="w-full h-full rounded-full bg-[#0a0a1a] p-4 flex items-center justify-center">
          {/* Donna avatar image */}
          <div className="relative w-full h-full">
            <Image
              src="/images/donna/donna-avatar.png"
              alt="Donna - Your Financial Assistant"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
