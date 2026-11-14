import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import capacitor from "../../capacitor.config";

vi.mock("@lovable.dev/vite-tanstack-config", () => ({ defineConfig: (options: unknown) => options }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Android output contract", () => {
  it("builds the static client directly in Capacitor's dist directory", async () => {
    vi.stubEnv("CAPACITOR", "1");
    const { default: config } = await import("../../vite.config");
    expect(capacitor.webDir).toBe("dist");
    expect(config).toMatchObject({
      nitro: false,
      vite: { environments: {
        client: { build: { outDir: "dist" } },
        server: { build: { outDir: ".tanstack/mobile-server" } },
      } },
      tanstackStart: { spa: { enabled: true, prerender: { outputPath: "/index.html" } } },
    });
  });

  it("keeps the separate hosted build in SSR mode", async () => {
    vi.stubEnv("CAPACITOR", "0");
    const { default: config } = await import("../../vite.config");
    expect(config).not.toHaveProperty("nitro");
    expect(config).not.toHaveProperty("tanstackStart.spa");
  });

  it("makes npm run build select the Android bundle", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.build).toBe("CAPACITOR=1 vite build");
    expect(pkg.scripts["build:web"]).toBe("vite build");
  });
});