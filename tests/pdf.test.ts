import { describe, it, expect } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, PDFName, PDFTextField, PDFCheckBox } from "pdf-lib";
import { generatePdf, importBackground } from "../src/lib/pdf";
import { builtInTemplates } from "../src/lib/templates";
import {
  emptyPatient,
  type GenerationContext,
  type FormTemplate,
  type LabTest,
  type Order,
} from "../src/lib/types";
import { groupOrders } from "../src/lib/engine";
import catalogData from "../src/data/catalog.json";
const catalog = catalogData as LabTest[];
const fontBytes = await readFile("public/fonts/LiberationSans-Regular.ttf");
const loadTemplate = (t: FormTemplate) => readFile("public/" + t.assetUrl);
const patient = {
  ...emptyPatient,
  lastName: "TESTONLY",
  firstName: "SYNTHETIC",
  caseNumber: "TEST-000",
  age: "30",
  sex: "Female",
  diagnosis: "Synthetic QA example",
  priority: "STAT" as const,
};
function ctx(alias = "CBC"): GenerationContext {
  const t = catalog.find(
    (t) => t.lab === "Central Lab" && [t.name, ...t.aliases].includes(alias),
  )!;
  const order: Order = { id: crypto.randomUUID(), testId: t.id };
  return {
    patient,
    request: groupOrders([order], catalog).requests[0],
    custom: {},
  };
}
const options = { fontBytes, loadTemplate };
describe("generated PDFs", () => {
  it("packs four and five distinct requests into one and two A4 pages", async () => {
    const aliases = ["CBC", "Na", "HbA1c", "TSH", "Plasma K"];
    const items = aliases.map((alias) => ({
      template: builtInTemplates[0],
      context: ctx(alias),
    }));
    const four = await generatePdf(items.slice(0, 4), true, options);
    const five = await generatePdf(items, true, options);
    expect(four.pages).toBe(1);
    expect(five.pages).toBe(2);
    const doc = await PDFDocument.load(five.bytes);
    const fields = doc.getForm().getFields();
    expect(new Set(fields.map((f) => f.getName())).size).toBe(fields.length);
    expect(doc.getForm().getTextField("request1.tests").getText()).toBe(
      "Complete Blood Count",
    );
    expect(doc.getForm().getTextField("request2.tests").getText()).toBe(
      "Sodium",
    );
    expect(doc.getForm().getCheckBox("request1.stat").isChecked()).toBe(true);
    expect(doc.getForm().getCheckBox("request1.routine").isChecked()).toBe(
      false,
    );
    expect(
      doc.getForm().getTextField("request5.collecttime").getText() ?? "",
    ).toBe("");
    await mkdir("tmp/qa", { recursive: true });
    await writeFile("tmp/qa/five-editable.pdf", five.bytes);
    await writeFile("tmp/qa/four-editable.pdf", four.bytes);
  });
  it("removes widgets and AcroForm for the printable version", async () => {
    const result = await generatePdf(
      [{ template: builtInTemplates[0], context: ctx() }],
      false,
      options,
    );
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.catalog.has(PDFName.of("AcroForm"))).toBe(false);
    for (const p of doc.getPages())
      expect(p.node.Annots()?.size() ?? 0).toBe(0);
    await writeFile("tmp/qa/one-print.pdf", result.bytes);
  });
  it("retains pathology layout, independent fields and native service checkbox mappings", async () => {
    const test = catalog.find(
      (t) => t.lab === "Surgical Pathology" && t.name === "CSF Cytology",
    )!;
    const request = groupOrders([{ id: "sp", testId: test.id }], catalog)
      .requests[0];
    const context = { patient, request, custom: {} };
    const result = await generatePdf(
      [
        { template: builtInTemplates[1], context },
        { template: builtInTemplates[1], context },
      ],
      true,
      options,
    );
    expect(result.pages).toBe(4);
    const doc = await PDFDocument.load(result.bytes);
    expect(
      doc
        .getForm()
        .getFields()
        .filter((f) => f instanceof PDFCheckBox && f.isChecked()),
    ).toHaveLength(2);
    expect(
      doc
        .getForm()
        .getFields()
        .filter((f) => f instanceof PDFTextField && f.getText() === "TESTONLY"),
    ).toHaveLength(2);
    await writeFile("tmp/qa/pathology-editable.pdf", result.bytes);
  });
  it("rejects overflow rather than truncating text", async () => {
    const context = ctx();
    context.patient = { ...patient, lastName: "A".repeat(120) };
    await expect(
      generatePdf([{ template: builtInTemplates[0], context }], true, options),
    ).rejects.toThrow("Text is too long");
    context.patient = {
      ...patient,
      diagnosis: "A long synthetic clinical paragraph. ".repeat(100),
    };
    await expect(
      generatePdf([{ template: builtInTemplates[0], context }], true, options),
    ).rejects.toThrow("field height");
  });
  it("supports Filipino characters with an embedded bundled font", async () => {
    const context = ctx();
    context.patient = { ...patient, lastName: "PEÑA", firstName: "NIÑO" };
    const result = await generatePdf(
      [{ template: builtInTemplates[0], context }],
      true,
      options,
    );
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getForm().getTextField("request1.last").getText()).toBe("PEÑA");
  });
  it("reports unsupported symbols instead of silently losing clinical text", async () => {
    const context = ctx();
    context.patient = { ...patient, diagnosis: "Synthetic 🧪 symbol" };
    await expect(
      generatePdf([{ template: builtInTemplates[0], context }], true, options),
    ).rejects.toThrow("not supported by the PDF font");
  });
});
describe("blank template imports", () => {
  it("imports fields and multiple pages while removing pre-existing values", async () => {
    const doc = await PDFDocument.create();
    const p = doc.addPage();
    doc.addPage();
    const text = doc.getForm().createTextField("Existing field");
    text.addToPage(p, { x: 20, y: 500, width: 200, height: 30 });
    text.setText("SYNTHETIC PRIVATE VALUE");
    const check = doc.getForm().createCheckBox("Existing checkbox");
    check.addToPage(p, { x: 20, y: 450, width: 15, height: 15 });
    check.check();
    const input = new File(
      [new Uint8Array(await doc.save()).buffer],
      "blank-test.pdf",
      { type: "application/pdf" },
    );
    const result = await importBackground(input);
    expect(result.discardedValues).toBe(true);
    expect(result.template.pageSizes).toHaveLength(2);
    expect(result.template.fields).toHaveLength(2);
    const bytes = Uint8Array.from(
      atob(result.template.data!.split(",")[1]),
      (c) => c.charCodeAt(0),
    );
    const blank = await PDFDocument.load(bytes);
    expect(blank.getForm().getFields()).toHaveLength(0);
    expect(new TextDecoder().decode(bytes)).not.toContain(
      "SYNTHETIC PRIVATE VALUE",
    );
  });
  it("accepts image backgrounds", async () => {
    const input = new File(
      [new Uint8Array(await readFile("public/forms/central-lab.png")).buffer],
      "lab.png",
      { type: "image/png" },
    );
    const result = await importBackground(input);
    expect(result.template.fileType).toBe("png");
    expect(result.template.pageSizes[0].width).toBeCloseTo(595.28);
  });
});
