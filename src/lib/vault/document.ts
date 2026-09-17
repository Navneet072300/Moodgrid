import type { VaultDocument } from "./types";

export function withoutEntry(document: VaultDocument, id: string): VaultDocument {
  const removed = document.entries.find((entry) => entry.id === id);
  if (!removed) throw new Error("This moment is no longer in your journal.");
  const entries = document.entries.filter((entry) => entry.id !== id);
  const removedTags = new Set(removed.tags.map((tag) => tag.id));
  const usedTags = new Set(entries.flatMap((entry) => entry.tags.map((tag) => tag.id)));
  return { ...document, entries, tags: document.tags.filter((tag) => !removedTags.has(tag.id) || usedTags.has(tag.id)) };
}

export function withoutSticker(document: VaultDocument, id: string): VaultDocument {
  const sticker = document.stickers.find((item) => item.id === id);
  if (!sticker) throw new Error("This sticker is no longer in your library.");
  const uses = document.entries.filter((entry) => entry.sticker_id === id).length;
  if (uses) throw new Error(`Used in ${uses} moment${uses === 1 ? "" : "s"}. Change or delete those moments first.`);
  return {
    ...document,
    stickers: document.stickers.filter((item) => item.id !== id),
    pendingStickerDeletes: [...new Set([...(document.pendingStickerDeletes ?? []), sticker.storage_path])],
  };
}

export function validateStickerDeletes(document: VaultDocument, user: string): void {
  for (const path of document.pendingStickerDeletes ?? []) {
    const [owner, filename, extra] = path.split("/");
    if (owner !== user || extra !== undefined || !/^[0-9a-f-]{36}\.bin$/i.test(filename ?? "") || document.stickers.some((item) => item.storage_path === path)) {
      throw new Error("Sticker deletion ownership verification failed.");
    }
  }
}
