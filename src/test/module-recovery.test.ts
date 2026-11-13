import { describe, expect, it, vi } from "vitest";
import { isModuleLoadError, recoverModuleLoad } from "@/lib/module-recovery";

describe("page download recovery", () => {
  it.each([
    "Importing a module script failed.",
    "Failed to fetch dynamically imported module: /assets/auth.js",
    "error loading dynamically imported module",
    "Loading chunk auth failed",
  ])("recognizes %s", (message) => {
    expect(isModuleLoadError(new Error(message))).toBe(true);
  });

  it("reloads a failed page once, not indefinitely", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const reload = vi.fn();
    const error = new Error("Importing a module script failed.");
    expect(recoverModuleLoad(error, "/auth", storage, reload)).toBe(true);
    expect(recoverModuleLoad(error, "/auth", storage, reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload ordinary errors or when storage is unavailable", () => {
    const reload = vi.fn();
    const storage = { getItem: () => { throw new Error("Storage unavailable"); }, setItem: vi.fn() };
    expect(recoverModuleLoad(new Error("Invalid email"), "/auth", storage, reload)).toBe(false);
    expect(recoverModuleLoad(new Error("Importing a module script failed."), "/auth", storage, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});