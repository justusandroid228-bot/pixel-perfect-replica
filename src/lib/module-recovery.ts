/** Browsers use different messages when a lazily loaded page cannot download. */
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Loading chunk .+ failed/i.test(message);
}

/** Only retry once per address, so an unavailable page cannot reload forever. */
export function recoverModuleLoad(error: unknown, address: string, storage: Pick<Storage, "getItem" | "setItem">, reload: () => void): boolean {
  if (!isModuleLoadError(error)) return false;
  const key = `justus:module-recovery:${address}`;
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, "retried");
  } catch {
    // Without storage we cannot safely bound automatic reloads.
    return false;
  }
  reload();
  return true;
}