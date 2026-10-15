import fields from "../data/pathology-fields.json";
import cf2Fields from "../data/cf2-fields.json";
import type { FieldMapping, FormTemplate } from "./types";
const f = (
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  binding: string,
  kind: FieldMapping["kind"] = "text",
  fontSize = 10,
): FieldMapping => ({
  id,
  name,
  page: 0,
  x,
  y,
  width,
  height,
  binding,
  kind,
  fontSize,
});
export const builtInTemplates: FormTemplate[] = [
  {
    id: "central-lab",
    name: "Central Lab · General request",
    fileType: "png",
    assetUrl: "forms/central-lab.png",
    builtIn: true,
    fourUp: true,
    pageSizes: [{ width: 422, height: 599 }],
    fields: [
      f("last", "Last name", 5, 155, 105, 17, "patient.lastName"),
      f("first", "First name", 141, 155, 105, 17, "patient.firstName"),
      f("middle", "Middle name", 277, 155, 138, 17, "patient.middleName"),
      f("birth", "Birthday", 5, 190, 128, 16, "patient.birthDate"),
      f("age", "Age", 141, 190, 39, 16, "patient.age"),
      f("sex", "Sex", 213, 190, 57, 16, "patient.sex"),
      f(
        "case",
        "Hospital case number",
        277,
        190,
        138,
        16,
        "patient.caseNumber",
      ),
      f("service", "Service / OPD clinic", 5, 225, 128, 16, "patient.service"),
      f("ward", "Ward / room / bed", 141, 225, 128, 16, "patient.ward"),
      f(
        "class",
        "MSS classification",
        277,
        225,
        138,
        16,
        "patient.classification",
      ),
      f(
        "tests",
        "Examinations desired",
        7,
        265,
        405,
        56,
        "request.tests",
        "multiline",
        11,
      ),
      f(
        "diagnosis",
        "Diagnosis",
        7,
        357,
        187,
        82,
        "patient.diagnosis",
        "multiline",
        11,
      ),
      f(
        "requester",
        "Requested by",
        209,
        360,
        202,
        31,
        "patient.requestedBy",
        "multiline",
        10,
      ),
      f("reqtime", "Time requested", 209, 420, 91, 20, "patient.requestTime"),
      f("reqdate", "Date requested", 307, 420, 105, 20, "patient.requestDate"),
      f(
        "specimen",
        "Specimen",
        5,
        461,
        75,
        27,
        "request.specimen",
        "multiline",
        9,
      ),
      f(
        "site",
        "Collection site",
        91,
        461,
        105,
        27,
        "request.site",
        "multiline",
        9,
      ),
      f(
        "collector",
        "Collected by",
        209,
        466,
        203,
        43,
        "patient.collectedBy",
        "multiline",
        10,
      ),
      f(
        "collecttime",
        "Time collected",
        209,
        537,
        91,
        20,
        "patient.collectedTime",
      ),
      f(
        "collectdate",
        "Date collected",
        307,
        537,
        105,
        20,
        "patient.collectedDate",
      ),
      f("stat", "STAT", 340, 24, 10, 10, "priority.stat", "checkbox"),
      f("routine", "Routine", 340, 39, 10, 10, "priority.routine", "checkbox"),
    ],
  },
  {
    id: "surgical-pathology",
    name: "Surgical Pathology · Consultation",
    fileType: "pdf",
    assetUrl: "forms/surgical-pathology.pdf",
    builtIn: true,
    pageSizes: [
      { width: 595.32, height: 841.92 },
      { width: 595.32, height: 841.92 },
    ],
    fields: fields as FieldMapping[],
  },
  {
    id: "philhealth-cf2",
    name: "PhilHealth · CF-2 Claim Form 2",
    fileType: "pdf",
    assetUrl: "forms/philhealth-cf2.pdf",
    builtIn: true,
    pageSizes: [
      { width: 612, height: 936 },
      { width: 612, height: 936 },
    ],
    fields: cf2Fields as FieldMapping[],
    sourceUrl:
      "https://www.philhealth.gov.ph/downloads/claim/ClaimForm2_092018.pdf",
    revision: "September 2018",
  },
];

export function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}
export async function templateBytes(
  template: FormTemplate,
): Promise<Uint8Array> {
  if (template.data) {
    const b = atob(template.data.split(",")[1]);
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  }
  if (!template.assetUrl) throw new Error("Template background missing.");
  const r = await fetch(assetUrl(template.assetUrl));
  if (!r.ok) throw new Error("Could not load the blank template.");
  return new Uint8Array(await r.arrayBuffer());
}
export function toDataUrl(bytes: Uint8Array, type: string) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${type};base64,${btoa(binary)}`;
}
