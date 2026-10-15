export type Container =
  "red" | "purple" | "blue" | "green" | "cup" | "special" | "none" | "unknown";
export const containerNames: Record<Container, string> = {
  red: "Red top",
  purple: "Purple top",
  blue: "Blue top",
  green: "Green top",
  cup: "Specimen cup",
  special: "Special container",
  none: "No specimen",
  unknown: "Needs confirmation",
};
export const centralSections = [
  "Clinical Chemistry",
  "Clinical Microscopy",
  "Hematology",
  "Immunopathology",
  "Microbiology",
];
export interface TubePart {
  container: Container;
  count: number;
  instruction: string;
}
export interface TubeOption {
  name: string;
  parts: TubePart[];
}
export interface LabTest {
  id: string;
  name: string;
  aliases: string[];
  lab: string;
  section: string;
  specimen: string;
  container: Container;
  requirements: string;
  sourceIds: string[];
  dedicated?: boolean;
  separateRequest?: boolean;
  needsReview?: boolean;
  options?: TubeOption[];
}
export interface Patient {
  lastName: string;
  firstName: string;
  middleName: string;
  caseNumber: string;
  birthDate: string;
  age: string;
  sex: string;
  service: string;
  ward: string;
  classification: string;
  diagnosis: string;
  requestedBy: string;
  requestDate: string;
  requestTime: string;
  collectedDate: string;
  collectedTime: string;
  collectedBy: string;
  priority: "Routine" | "STAT";
  contact: string;
  whiteCard: string;
}
export const emptyPatient: Patient = {
  lastName: "",
  firstName: "",
  middleName: "",
  caseNumber: "",
  birthDate: "",
  age: "",
  sex: "",
  service: "",
  ward: "",
  classification: "",
  diagnosis: "",
  requestedBy: "",
  requestDate: "",
  requestTime: "",
  collectedDate: "",
  collectedTime: "",
  collectedBy: "",
  priority: "Routine",
  contact: "",
  whiteCard: "",
};
export interface Order {
  id: string;
  testId: string;
  specimen?: string;
  site?: string;
  container?: Container;
  lab?: string;
  section?: string;
  notes?: string;
  reviewed?: boolean;
  dedicated?: boolean;
  optionIndex?: number;
  templateId?: string;
}
export interface ResolvedOrder {
  order: Order;
  test: LabTest;
  specimen: string;
  site: string;
  container: Container;
  lab: string;
  section: string;
  dedicated: boolean;
  issues: string[];
}
export interface ContainerGroup {
  id: string;
  lab: string;
  section: string;
  specimen: string;
  site: string;
  container: Container;
  count: number;
  instruction: string;
  orders: ResolvedOrder[];
  reason: string;
  issues: string[];
}
export interface RequestGroup {
  id: string;
  lab: string;
  section: string;
  specimen: string;
  site: string;
  orders: ResolvedOrder[];
  containerIds: string[];
  templateId: string;
  issues: string[];
}
export interface LabelOutput {
  groupId: string;
  container: Container;
  destination: string;
  count: number;
  text: string;
}
export interface Source {
  id: string;
  date: string;
  text: string;
}
export type FieldKind = "text" | "multiline" | "datetime" | "checkbox";
export interface FieldMapping {
  id: string;
  name: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  kind: FieldKind;
  binding: string;
  nativeName?: string;
}
export interface FormTemplate {
  id: string;
  name: string;
  fileType: "pdf" | "png" | "jpg";
  assetUrl?: string;
  data?: string;
  pageSizes: { width: number; height: number }[];
  fields: FieldMapping[];
  builtIn?: boolean;
  fourUp?: boolean;
}
export interface GenerationContext {
  patient: Patient;
  request: RequestGroup;
  custom: Record<string, string | boolean>;
}
export const bindings = [
  ["manual", "Manual entry"],
  ["patient.fullName", "Patient · full name"],
  ...Object.keys(emptyPatient)
    .filter((k) => k !== "priority")
    .map((k) => [
      `patient.${k}`,
      `Patient · ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`,
    ]),
  ["request.tests", "Request · tests"],
  ["request.specimen", "Request · specimen"],
  ["request.site", "Request · collection site"],
  ["request.section", "Request · lab section"],
  ["request.lab", "Request · destination"],
  ["priority.stat", "Priority · STAT checkbox"],
  ["priority.routine", "Priority · routine checkbox"],
] as [string, string][];
