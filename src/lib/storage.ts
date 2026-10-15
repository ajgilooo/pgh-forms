import type { FormTemplate, LabTest } from "./types";
const KEY = "pgh-forms-settings-v1";
interface Settings {
  version: 1;
  templates: FormTemplate[];
  catalog: LabTest[];
}
export function loadSettings(): Settings {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (
      value?.version === 1 &&
      Array.isArray(value.templates) &&
      Array.isArray(value.catalog)
    )
      return value;
  } catch {
    /* A damaged settings file must not prevent the app opening. */
  }
  return { version: 1, templates: [], catalog: [] };
}
export function saveSettings(templates: FormTemplate[], catalog: LabTest[]) {
  // This function accepts only blank-template definitions and catalog records, never application state.
  const blank = templates.filter((t) => !t.builtIn);
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      templates: blank,
      catalog,
    } satisfies Settings),
  );
}
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
export function downloadBytes(
  bytes: Uint8Array | string,
  name: string,
  type: string,
) {
  const blob = new Blob(
    [typeof bytes === "string" ? bytes : new Uint8Array(bytes).buffer],
    { type },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function validateTemplate(value: unknown): FormTemplate {
  if (!value || typeof value !== "object")
    throw new Error("Invalid template file.");
  const t = value as FormTemplate;
  if (
    !t.id ||
    typeof t.name !== "string" ||
    !["pdf", "png", "jpg"].includes(t.fileType) ||
    !t.data?.startsWith("data:") ||
    !Array.isArray(t.pageSizes) ||
    !t.pageSizes.length ||
    !Array.isArray(t.fields)
  )
    throw new Error(
      "Choose a PGH Forms template export containing its blank background and fields.",
    );
  for (const page of t.pageSizes)
    if (
      !Number.isFinite(page.width) ||
      !Number.isFinite(page.height) ||
      page.width <= 0 ||
      page.height <= 0
    )
      throw new Error("Invalid template page size.");
  const ids = new Set<string>();
  for (const f of t.fields) {
    const page = t.pageSizes[f.page];
    if (
      !f.id ||
      ids.has(f.id) ||
      !page ||
      ![f.x, f.y, f.width, f.height, f.fontSize].every(Number.isFinite) ||
      f.x < 0 ||
      f.y < 0 ||
      f.width <= 0 ||
      f.height <= 0 ||
      f.fontSize < 4 ||
      f.x + f.width > page.width + 1 ||
      f.y + f.height > page.height + 1 ||
      !["text", "multiline", "datetime", "checkbox"].includes(f.kind) ||
      typeof f.binding !== "string"
    )
      throw new Error("Invalid or duplicate field mapping.");
    ids.add(f.id);
  }
  return { ...t, id: crypto.randomUUID(), builtIn: false, assetUrl: undefined };
}
