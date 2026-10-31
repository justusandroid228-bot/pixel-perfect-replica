import { useState } from "react";
import { STICKER_CATEGORIES, type Sticker } from "@/lib/stickers";
import { cn } from "@/lib/utils";

export function StickerPicker({ onPick }: { onPick: (s: Sticker) => void }) {
  const [cat, setCat] = useState(STICKER_CATEGORIES[0]!.id);
  const current = STICKER_CATEGORIES.find((c) => c.id === cat) ?? STICKER_CATEGORIES[0]!;
  return (
    <div className="border-t border-border bg-card/95 px-3 pb-2 pt-2">
      <div role="tablist" aria-label="Sticker categories" className="flex gap-1.5 overflow-x-auto pb-2">
        {STICKER_CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === cat}
            onClick={() => setCat(c.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
              c.id === cat ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-secondary-foreground",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {current.stickers.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s)}
            aria-label={`Send sticker: ${s.caption}`}
            className="flex flex-col items-center rounded-2xl bg-secondary/40 py-2 transition active:scale-95"
          >
            <span className="text-4xl leading-none" aria-hidden>{s.emoji}</span>
            <span className="mt-1 text-[11px] font-semibold text-primary">{s.caption}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
