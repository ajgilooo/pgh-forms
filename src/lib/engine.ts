import {
  centralSections,
  type LabTest,
  type Order,
  type Patient,
  type ResolvedOrder,
  type ContainerGroup,
  type RequestGroup,
  type LabelOutput,
} from "./types";

export const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export const fullName = (p: Patient) =>
  [p.lastName, [p.firstName, p.middleName].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
export function matchTests(input: string, catalog: LabTest[]) {
  const q = normalize(input);
  if (!q) return [];
  const exact = catalog.filter((t) =>
    [t.name, ...t.aliases].some((a) => normalize(a) === q),
  );
  if (exact.length) return exact;
  return catalog.filter((t) =>
    [t.name, ...t.aliases].some((a) => normalize(a).includes(q)),
  );
}
export function parseOrders(text: string, catalog: LabTest[]) {
  // Match the entire line before splitting so names containing commas remain intact.
  return text
    .split(/[\n;]+/)
    .flatMap((line) => {
      const exact = catalog.filter((t) =>
        [t.name, ...t.aliases].some(
          (a) => normalize(a) === normalize(line.trim()),
        ),
      );
      return exact.length
        ? [{ input: line.trim(), matches: exact }]
        : line
            .split(",")
            .filter((s) => s.trim())
            .map((input) => ({
              input: input.trim(),
              matches: matchTests(input.trim(), catalog),
            }));
    })
    .filter((x) => x.input);
}
export function resolveOrders(
  orders: Order[],
  catalog: LabTest[],
): ResolvedOrder[] {
  return orders.map((order) => {
    const test = catalog.find((t) => t.id === order.testId);
    if (!test)
      throw new Error(
        "An ordered test is no longer in the catalog. Remove it and select a replacement.",
      );
    const specimen = order.specimen ?? test.specimen,
      container = order.container ?? test.container;
    const lab = order.lab ?? test.lab,
      section = order.section ?? test.section;
    const issues: string[] = [];
    if (!specimen.trim() && container !== "none")
      issues.push("Specify the specimen.");
    if (container === "unknown") issues.push("Confirm the tube or container.");
    if (!lab.trim() || !section.trim())
      issues.push("Specify the destination and section.");
    if (test.needsReview && !order.reviewed)
      issues.push("Confirm the recorded requirements for this test.");
    if (test.options?.length && order.optionIndex === undefined)
      issues.push("Choose a tube set.");
    if (
      (section === "Microbiology" || specimen === "Other body fluid") &&
      !order.site?.trim()
    )
      issues.push("Specify the collection site/source.");
    return {
      order,
      test,
      specimen,
      site: order.site ?? "",
      container,
      lab,
      section,
      dedicated: order.dedicated ?? test.dedicated ?? false,
      issues,
    };
  });
}
export function groupOrders(orders: Order[], catalog: LabTest[]) {
  const resolved = resolveOrders(orders, catalog);
  const groups = new Map<string, ContainerGroup>();
  const requests = new Map<string, RequestGroup>();
  for (const r of resolved) {
    const option = r.test.options?.[r.order.optionIndex ?? -1];
    const isolated =
      r.dedicated ||
      r.container === "green" ||
      !!r.test.options ||
      r.issues.length > 0;
    const common = [r.lab, r.section, r.specimen, r.site];
    const key = JSON.stringify([
      ...common,
      r.container,
      isolated ? r.order.id : "shared",
    ]);
    const parts = option?.parts ?? [
      {
        container: r.container,
        count: r.container === "none" ? 0 : 1,
        instruction: "",
      },
    ];
    const ids: string[] = [];
    parts.forEach((part, i) => {
      const id = key + ":" + i;
      ids.push(id);
      const g = groups.get(id);
      if (g) {
        g.orders.push(r);
        g.issues.push(...r.issues);
      } else
        groups.set(id, {
          id,
          lab: r.lab,
          section: r.section,
          specimen: r.specimen,
          site: r.site,
          container: part.container,
          count: part.count,
          instruction: part.instruction,
          orders: [r],
          issues: [...r.issues],
          reason:
            r.container === "green"
              ? "Green-top tests require separate tubes."
              : r.test.options
                ? "Dedicated special tube set."
                : r.dedicated
                  ? "Dedicated specimen/container required."
                  : r.issues.length
                    ? "Kept separate until requirements are confirmed."
                    : "Same lab section, specimen, collection site, and compatible container.",
        });
    });
    const templateId =
      r.order.templateId ??
      (r.lab === "Central Lab" && centralSections.includes(r.section)
        ? "central-lab"
        : r.lab === "Surgical Pathology"
          ? "surgical-pathology"
          : "");
    const requestKey = JSON.stringify([
      key,
      templateId,
      r.test.separateRequest ? r.order.id : "shared",
    ]);
    const req = requests.get(requestKey);
    if (req) {
      req.orders.push(r);
      req.containerIds = [...new Set([...req.containerIds, ...ids])];
      req.issues.push(...r.issues);
    } else
      requests.set(requestKey, {
        id: requestKey,
        lab: r.lab,
        section: r.section,
        specimen: r.specimen,
        site: r.site,
        orders: [r],
        containerIds: ids,
        templateId,
        issues: [...r.issues],
      });
  }
  return {
    containers: [...groups.values()],
    requests: [...requests.values()],
    resolved,
  };
}
export function labelText(p: Patient) {
  return `${fullName(p)}\n${p.caseNumber}\n${[p.collectedDate, p.collectedTime].filter(Boolean).join(" ")}\nCOLLECTED BY: ${p.collectedBy}`;
}
export function makeLabels(
  groups: ContainerGroup[],
  p: Patient,
  counts: Record<string, number> = {},
): LabelOutput[] {
  return groups
    .filter((g) => g.count > 0)
    .map((g) => ({
      groupId: g.id,
      container: g.container,
      destination: `${g.lab} · ${g.section}`,
      count: counts[g.id] ?? g.count,
      text: labelText(p),
    }));
}
export function allLabelText(labels: LabelOutput[]) {
  return labels
    .flatMap((l) => Array.from({ length: l.count }, () => l.text))
    .join("\n\n");
}
