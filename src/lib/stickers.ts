// Original sticker set: system emoji composed with JustUs captions (no third-party artwork).
export type Sticker = { id: string; emoji: string; caption: string };
export type StickerCategory = { id: string; name: string; stickers: Sticker[] };

const make = (cat: string, items: [string, string][]): Sticker[] =>
  items.map(([emoji, caption], i) => ({ id: `${cat}:${i}`, emoji, caption }));

export const STICKER_CATEGORIES: StickerCategory[] = [
  { id: "love", name: "Cute Love", stickers: make("love", [["💖", "love you"], ["💌", "for you"], ["🥰", "adore you"], ["💘", "struck"], ["🌹", "my rose"], ["💞", "always"]]) },
  { id: "couple", name: "Couple", stickers: make("couple", [["👩‍❤️‍👨", "us"], ["💑", "together"], ["🤝", "team us"], ["🫶", "my person"], ["💍", "forever?"], ["🏡", "home is you"]]) },
  { id: "flirty", name: "Flirty", stickers: make("flirty", [["😘", "mwah"], ["😉", "hey you"], ["🔥", "hot"], ["😏", "oh really"], ["💋", "kiss"], ["🙈", "stop it"]]) },
  { id: "funny", name: "Funny", stickers: make("funny", [["🤪", "silly"], ["😂", "lol"], ["🥴", "dizzy for you"], ["🤡", "clown"], ["🍕", "feed me"], ["💤", "sleepy"]]) },
  { id: "sad", name: "Sad", stickers: make("sad", [["🥺", "miss you"], ["😢", "sad"], ["🌧️", "gloomy"], ["🫂", "hug me"], ["💔", "ouch"], ["😔", "sorry"]]) },
  { id: "animals", name: "Cute Animals", stickers: make("animals", [["🐻", "bear hug"], ["🐰", "hop to you"], ["🐱", "purr"], ["🐶", "puppy eyes"], ["🐧", "waddle"], ["🦦", "hold hands"]]) },
];

const ALL = new Map(STICKER_CATEGORIES.flatMap((c) => c.stickers.map((s) => [s.id, s] as const)));
export const getSticker = (id: string | null | undefined) => (id ? ALL.get(id) : undefined);
