import { describe, it, expect } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { PDFDocument, PDFCheckBox, PDFTextField, PDFName } from "pdf-lib";
import { builtInTemplates } from "../src/lib/templates";
import { bindingValue, generatePdf } from "../src/lib/pdf";
import {
  standaloneRequest,
  exportPatientIssue,
} from "../src/lib/form-requests";
import { emptyPatient, type GenerationContext } from "../src/lib/types";
import { groupOrders } from "../src/lib/engine";

const template = builtInTemplates.find((t) => t.id === "philhealth-cf2")!;
const fontBytes = await readFile("public/fonts/LiberationSans-Regular.ttf");
const options = {
  fontBytes,
  loadTemplate: (t: typeof template) => readFile("public/" + t.assetUrl),
};
const context = (): GenerationContext => ({
  patient: {
    ...emptyPatient,
    lastName: "Testonly",
    firstName: "Synthetic",
    middleName: "Sample",
  },
  request: standaloneRequest(template, "cf2-test"),
  custom: {},
});

describe("PhilHealth CF-2", () => {
  it("works without lab orders, specimens or a hospital case number", () => {
    const ctx = context();
    expect(ctx.request.orders).toEqual([]);
    expect(ctx.request.containerIds).toEqual([]);
    expect(groupOrders([], []).containers).toEqual([]);
    expect(exportPatientIssue([ctx.request], ctx.patient)).toBeUndefined();
    expect(
      exportPatientIssue([{ ...ctx.request, standalone: false }], ctx.patient),
    ).toContain("hospital case number");
    expect(
      exportPatientIssue([ctx.request], { ...ctx.patient, lastName: "" }),
    ).toContain("last name");
  });
  it("keeps all field mappings on the original two pages", () => {
    expect(template.pageSizes).toEqual([
      { width: 612, height: 936 },
      { width: 612, height: 936 },
    ]);
    expect(template.fields.length).toBeGreaterThan(200);
    expect(new Set(template.fields.map((f) => f.id)).size).toBe(
      template.fields.length,
    );
    for (const f of template.fields) {
      const page = template.pageSizes[f.page];
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(page.width);
      expect(f.y + f.height).toBeLessThanOrEqual(page.height);
    }
  });
  it("reuses capitalized names and leaves certifications, dates and fees blank by default", async () => {
    const ctx = context();
    const result = await generatePdf(
      [{ template, context: ctx }],
      true,
      options,
    );
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPages().map((p) => p.getSize())).toEqual(template.pageSizes);
    expect(doc.getForm().getTextField("request1.patient-last").getText()).toBe(
      "TESTONLY",
    );
    expect(ctx.patient.lastName).toBe("Testonly");
    expect(
      doc
        .getForm()
        .getFields()
        .filter((f) => f instanceof PDFCheckBox && f.isChecked()),
    ).toHaveLength(0);
    expect(
      doc.getForm().getTextField("request1.consent-name").getText() ?? "",
    ).toBe("");
    expect(
      doc.getForm().getTextField("request1.charges-grand").getText() ?? "",
    ).toBe("");
    expect(
      doc.getForm().getTextField("request1.admitted-date-month").getText() ??
        "",
    ).toBe("");
  });
  it("writes dates, 12-hour times and character boxes from one input each", () => {
    const ctx = context();
    ctx.custom = {
      "admitted-date": "2026-10-15",
      "admitted-time": "00:05",
      "hci-pan": "H9300XXXX",
      "professional-1-pan": "1234-1234567-8",
    };
    const value = (id: string) =>
      bindingValue(
        template.fields.find((f) => f.id === id)!,
        ctx,
      );
    expect(value("admitted-date-month")).toBe("10");
    expect(value("admitted-date-day")).toBe("15");
    expect(value("admitted-date-year")).toBe("2026");
    expect(value("admitted-time-hour")).toBe("12");
    expect(value("admitted-time-minute")).toBe("05");
    expect(value("admitted-time-am")).toBe(true);
    expect(value("admitted-time-pm")).toBe(false);
    ctx.custom["admitted-time"] = "13:35";
    expect(value("admitted-time-hour")).toBe("01");
    expect(value("admitted-time-pm")).toBe(true);
    expect(value("hci-pan-0")).toBe("H");
    expect(value("professional-1-pan-11")).toBe("8");
    ctx.custom["hci-pan"] = "H1234567890";
    expect(() => value("hci-pan-0")).toThrow("9 character boxes");
    ctx.custom["admitted-date"] = "2026-02-30";
    expect(() => value("admitted-date-month")).toThrow("valid calendar date");
  });
  it("rejects conflicting single-choice selections", async () => {
    const ctx = context();
    ctx.custom = { "disposition-improved": true, "disposition-expired": true };
    await expect(
      generatePdf([{ template, context: ctx }], true, options),
    ).rejects.toThrow("Patient disposition");
  });
  it("exports editable and print versions with representative values across both pages", async () => {
    const ctx = context(),
      checkedGroups = new Set<string>();
    for (const f of template.fields.filter((f) => f.binding === "manual")) {
      const key = f.valueKey ?? f.id;
      if (key in ctx.custom) continue;
      if (f.inputType === "date") ctx.custom[key] = "2026-10-15";
      else if (f.inputType === "time") ctx.custom[key] = "13:35";
      else if (f.characterCount) ctx.custom[key] = "1".repeat(f.characterCount);
      else if (f.kind === "checkbox") {
        ctx.custom[key] =
          !f.exclusiveGroup || !checkedGroups.has(f.exclusiveGroup);
        if (f.exclusiveGroup) checkedGroups.add(f.exclusiveGroup);
      } else ctx.custom[key] = "TEST";
    }
    ctx.custom["hci-name"] = "SYNTHETIC TEST HOSPITAL";
    ctx.custom["admission-diagnosis"] = "SYNTHETIC EXAMPLE";
    const editable = await generatePdf(
        [{ template, context: ctx }],
        true,
        options,
      ),
      print = await generatePdf([{ template, context: ctx }], false, options);
    const doc = await PDFDocument.load(editable.bytes);
    expect(
      doc.getForm().getTextField("request1.admitted-date-year").getText(),
    ).toBe("2026");
    expect(
      doc.getForm().getCheckBox("request1.admitted-time-pm").isChecked(),
    ).toBe(true);
    expect(
      doc.getForm().getTextField("request1.hci-representative").getText(),
    ).toBe("TEST");
    expect(
      doc
        .getForm()
        .getFields()
        .filter((f) => f instanceof PDFTextField),
    ).toHaveLength(template.fields.filter((f) => f.kind !== "checkbox").length);
    const flat = await PDFDocument.load(print.bytes);
    expect(flat.catalog.has(PDFName.of("AcroForm"))).toBe(false);
    for (const p of flat.getPages())
      expect(p.node.Annots()?.size() ?? 0).toBe(0);
    await mkdir("tmp/qa", { recursive: true });
    await writeFile("tmp/qa/cf2-editable.pdf", editable.bytes);
    await writeFile("tmp/qa/cf2-print.pdf", print.bytes);
  });
});
