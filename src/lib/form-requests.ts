import type { FormTemplate, RequestGroup } from "./types";

export function standaloneRequest(
  template: FormTemplate,
  id: string,
): RequestGroup {
  return {
    id,
    templateId: template.id,
    standalone: true,
    displayName: template.name,
    lab: "PhilHealth",
    section: "CF-2",
    specimen: "",
    site: "",
    orders: [],
    containerIds: [],
    issues: [],
  };
}
export function requestTitle(request: RequestGroup) {
  return (
    request.displayName ?? request.orders.map((o) => o.test.name).join(", ")
  );
}
export function exportPatientIssue(
  requests: RequestGroup[],
  patient: { lastName: string; firstName: string; caseNumber: string },
) {
  if (!patient.lastName.trim() || !patient.firstName.trim())
    return "Enter the patient’s last name and first name before generating forms.";
  if (requests.some((r) => !r.standalone) && !patient.caseNumber.trim())
    return "Enter the hospital case number before generating laboratory requests.";
}
