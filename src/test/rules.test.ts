import { describe, expect, it } from "vitest";
import { checkMedia, deliveryState, isTypingFresh, mergeMessages, normalizeInviteCode, MB } from "@/lib/rules";

describe("invite codes", () => {
  it("normalizes pasted codes", () => {
    expect(normalizeInviteCode(" ju-abcd-efgh ")).toBe("JU-ABCD-EFGH");
    expect(normalizeInviteCode("ABCDEFGH")).toBe("JU-ABCD-EFGH");
  });
  it("rejects ambiguous characters and wrong length", () => {
    expect(normalizeInviteCode("JU-ABCD-EFG0")).toBeNull();
    expect(normalizeInviteCode("JU-ABCD-EFG")).toBeNull();
  });
});

describe("media limits", () => {
  it("photo max 10 MB", () => {
    expect(checkMedia({ type: "image/jpeg", size: 10 * MB }).ok).toBe(true);
    expect(checkMedia({ type: "image/jpeg", size: 10 * MB + 1 }).ok).toBe(false);
  });
  it("video max 25 MB", () => {
    expect(checkMedia({ type: "video/mp4", size: 25 * MB }).ok).toBe(true);
    expect(checkMedia({ type: "video/mp4", size: 25 * MB + 1 }).ok).toBe(false);
  });
  it("rejects unsupported types", () => {
    expect(checkMedia({ type: "application/pdf", size: 10 }).ok).toBe(false);
  });
});

describe("delivery state", () => {
  const m = { created_at: "2026-01-01T00:00:00Z" };
  it("pending is sending, never sent", () => expect(deliveryState({ ...m, pending: true }, undefined, null)).toBe("sending"));
  it("failed wins", () => expect(deliveryState({ ...m, failed: true }, undefined, null)).toBe("failed"));
  it("read via partner read position", () => expect(deliveryState(m, undefined, "2026-01-02T00:00:00Z")).toBe("read"));
  it("delivered", () => expect(deliveryState(m, { delivered_at: "x", read_at: null }, null)).toBe("delivered"));
});

describe("typing + merge", () => {
  it("typing expires after 6s", () => {
    const now = Date.parse("2026-01-01T00:00:10Z");
    expect(isTypingFresh("2026-01-01T00:00:05Z", now)).toBe(true);
    expect(isTypingFresh("2026-01-01T00:00:03Z", now)).toBe(false);
  });
  it("dedupes by client_id and sorts", () => {
    const out = mergeMessages(
      [{ id: "a", client_id: "1", created_at: "2" }],
      [{ id: "a2", client_id: "1", created_at: "2" }, { id: "b", client_id: "2", created_at: "1" }],
    );
    expect(out.map((x) => x.id)).toEqual(["b", "a2"]);
  });
});
