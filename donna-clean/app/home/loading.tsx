export default function Loading() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      {/* Donna logo/avatar small */}
      <div className="w-16 h-16 rounded-full border-2 border-purple-500/40 overflow-hidden opacity-60">
        <img
          src="/donna-avatar.png"
          alt="Loading"
          className="w-full h-full object-cover"
        />
      </div>
      {/* Spinner */}
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      {/* Subtle text */}
      <p className="text-white/30 text-sm">
        Just a moment...
      </p>
    </div>
  );
}
