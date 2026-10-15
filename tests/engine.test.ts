import { describe, it, expect } from "vitest";
import data from "../src/data/catalog.json";
import {
  groupOrders,
  matchTests,
  parseOrders,
  makeLabels,
  allLabelText,
} from "../src/lib/engine";
import { emptyPatient, type LabTest, type Order } from "../src/lib/types";
const catalog = data as LabTest[];
const central = (alias: string) =>
  catalog.find(
    (t) => t.lab === "Central Lab" && [t.name, ...t.aliases].includes(alias),
  )!;
const order = (test: LabTest, overrides: Partial<Order> = {}): Order => ({
  id: crypto.randomUUID(),
  testId: test.id,
  ...overrides,
});
describe("source-linked grouping", () => {
  it("groups the eight-test example into four containers and four paper requests", () => {
    const orders = ["CBC", "ESR", "Na", "K", "Cl", "HbA1c", "TSH", "PCT"].map(
      (a) => order(central(a)),
    );
    const { containers, requests } = groupOrders(orders, catalog);
    expect(containers).toHaveLength(4);
    expect(requests).toHaveLength(4);
    expect(containers.map((g) => g.orders.length).sort()).toEqual([1, 2, 2, 3]);
    expect(
      requests.every((r) => r.templateId === "central-lab" && !r.issues.length),
    ).toBe(true);
  });
  it("separates every green-top test", () => {
    const { containers } = groupOrders(
      ["Plasma K", "iCa", "Ammonia"].map((a) => order(central(a))),
      catalog,
    );
    expect(containers).toHaveLength(3);
    expect(containers.every((g) => g.count === 1)).toBe(true);
  });
  it("uses one tube but two paper requests for ASMA and anti-LKM", () => {
    const g = groupOrders(
      ["ASMA", "Anti-LKM"].map((a) => order(central(a))),
      catalog,
    );
    expect(g.containers).toHaveLength(1);
    expect(g.requests).toHaveLength(2);
    expect(g.requests[0].containerIds).toEqual(g.requests[1].containerIds);
    expect(makeLabels(g.containers, { ...emptyPatient })).toHaveLength(1);
  });
  it("does not merge equal colors across sections or different specimens/sites", () => {
    const g = groupOrders(
      [
        order(central("Na")),
        order(central("TSH")),
        order(central("Na"), {
          specimen: "Pleural fluid",
          container: "cup",
          site: "left",
        }),
        order(central("Na"), {
          specimen: "Pleural fluid",
          container: "cup",
          site: "right",
        }),
      ],
      catalog,
    );
    expect(g.containers).toHaveLength(4);
  });
  it("isolates unknown requirements and resolves explicit corrections", () => {
    const test = central("Urinalysis");
    const o = order(test);
    expect(groupOrders([o], catalog).resolved[0].issues.length).toBeGreaterThan(
      0,
    );
    const fixed = { ...o, container: "cup" as const, reviewed: true };
    expect(groupOrders([fixed], catalog).resolved[0].issues).toEqual([]);
  });
  it("generates four labels for a confirmed IGRA set", () => {
    const test = central("IGRA");
    const o = order(test, { optionIndex: 0 });
    const g = groupOrders([o], catalog);
    expect(g.containers[0].count).toBe(4);
    expect(g.requests).toHaveLength(1);
    const labels = makeLabels(g.containers, {
      ...emptyPatient,
      lastName: "TEST",
      firstName: "ONLY",
      caseNumber: "SYNTHETIC",
    });
    expect(allLabelText(labels).split("COLLECTED BY:")).toHaveLength(5);
    expect(groupOrders([order(test)], catalog).resolved[0].issues).toContain(
      "Choose a tube set.",
    );
  });
  it("expands a multi-color tube set while keeping a single request", () => {
    const test = catalog.find((t) => t.name === "APAS Panel")!;
    const g = groupOrders(
      [order(test, { optionIndex: 0, reviewed: true })],
      catalog,
    );
    expect(g.containers.map((g) => [g.container, g.count])).toEqual([
      ["red", 2],
      ["blue", 4],
    ]);
    expect(g.requests).toHaveLength(1);
  });
  it("requires collection source for Microbiology and retains form gaps outside Central Lab", () => {
    const t = catalog.find((t) => t.name === "CSF Gram Stain/Culture")!;
    expect(groupOrders([order(t)], catalog).requests[0].issues).toContain(
      "Specify the collection site/source.",
    );
    const b = catalog.find(
      (t) => t.lab === "Blood Bank" && t.name === "Blood Typing",
    )!;
    expect(groupOrders([order(b)], catalog).requests[0].templateId).toBe("");
  });
});
describe("paste and labels", () => {
  it("keeps ambiguous destinations and unknown text visible", () => {
    const rows = parseOrders("CBC, TSH;unlisted test\nNa", catalog);
    expect(rows).toHaveLength(4);
    expect(rows[0].matches).toHaveLength(1);
    expect(rows[1].matches.length).toBeGreaterThan(1);
    expect(rows[2].matches).toHaveLength(0);
  });
  it("preserves complete test names containing commas before splitting", () => {
    const rows = parseOrders("Potassium, serum", catalog);
    expect(rows).toHaveLength(1);
    expect(rows[0].matches[0].name).toBe("Potassium, serum");
  });
  it("matches aliases without punctuation/case dependence", () => {
    expect(matchTests("hba1C", catalog)[0].name).toBe("HbA1c");
    expect(matchTests("anti-lkm-1", catalog)[0].name).toBe(
      "Anti-liver kidney microsomal antibody",
    );
  });
  it("produces exactly four lines with collection date/time blank until entered", () => {
    const g = groupOrders([order(central("CBC"))], catalog);
    const p = {
      ...emptyPatient,
      lastName: "TEST",
      firstName: "ONLY",
      caseNumber: "SYNTHETIC",
    };
    const labels = makeLabels(g.containers, p);
    expect(labels[0].text).toBe("TEST, ONLY\nSYNTHETIC\n\nCOLLECTED BY: ");
    expect(labels[0].text.split("\n")).toHaveLength(4);
    expect(
      allLabelText(makeLabels(g.containers, p, { [g.containers[0].id]: 2 })),
    ).toBe(`${labels[0].text}\n\n${labels[0].text}`);
  });
});
