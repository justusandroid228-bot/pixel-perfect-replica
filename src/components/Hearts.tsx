import { Heart } from "lucide-react";

const HEARTS = [
  { left: "8%", size: 14, dur: 14, delay: 0 },
  { left: "22%", size: 10, dur: 18, delay: 4 },
  { left: "38%", size: 18, dur: 16, delay: 8 },
  { left: "55%", size: 12, dur: 20, delay: 2 },
  { left: "70%", size: 16, dur: 15, delay: 6 },
  { left: "86%", size: 11, dur: 19, delay: 10 },
];

export function FloatingHearts() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {HEARTS.map((h, i) => (
        <Heart
          key={i}
          className="animate-float-up absolute -bottom-8 fill-rose/40 text-rose/40"
          style={{ left: h.left, width: h.size, height: h.size, animationDuration: `${h.dur}s`, animationDelay: `${h.delay}s` }}
        />
      ))}
    </div>
  );
}

export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <div
      className="animate-heartbeat grid place-items-center rounded-full bg-heart shadow-glow"
      style={{ width: size, height: size }}
    >
      <Heart className="fill-primary-foreground text-primary-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

export function FullScreenLoader({ label = "Just a moment…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-romance" role="status">
      <BrandMark size={56} />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
