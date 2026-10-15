import { describe, it, expect, vi, afterEach } from "vitest";
import {
  copyText,
  loadSettings,
  saveSettings,
  validateTemplate,
} from "../src/lib/storage";
describe("patient-data isolation and reusable templates", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("only serializes explicit template and catalog settings, with no patient state", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => store.set(k, v),
      getItem: (k: string) => store.get(k) ?? null,
    });
    saveSettings([], []);
    expect([...store.keys()]).toEqual(["pgh-forms-settings-v1"]);
    expect(JSON.parse([...store.values()][0])).toEqual({
      version: 1,
      templates: [],
      catalog: [],
    });
    expect(loadSettings().catalog).toEqual([]);
  });
  it("survives denied browser storage and clipboard access", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(loadSettings().templates).toEqual([]);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    });
    expect(await copyText("test")).toBe(false);
  });
  it("validates reusable template exports and gives imported templates independent IDs", () => {
    const template = {
      id: "test",
      name: "Blank template",
      fileType: "png",
      data: "data:image/png;base64,aA==",
      pageSizes: [{ width: 100, height: 100 }],
      fields: [
        {
          id: "f",
          name: "Test",
          page: 0,
          x: 5,
          y: 5,
          width: 50,
          height: 20,
          fontSize: 10,
          kind: "text",
          binding: "patient.lastName",
        },
      ],
    };
    const imported = validateTemplate(JSON.parse(JSON.stringify(template)));
    expect(imported.id).not.toBe(template.id);
    expect(imported.fields).toEqual(template.fields);
    expect(() =>
      validateTemplate({
        ...template,
        fields: [{ ...template.fields[0], width: 1000 }],
      }),
    ).toThrow();
  });
});
