import type { FieldMapping, FormTemplate } from "../lib/types";

export function FormFields({
  template,
  values,
  onChange,
}: {
  template: FormTemplate;
  values: Record<string, string | boolean>;
  onChange: (values: Record<string, string | boolean>) => void;
}) {
  const unique = new Map<string, FieldMapping>();
  for (const field of template.fields.filter((f) => f.binding === "manual")) {
    const key = field.valueKey ?? field.id;
    if (!unique.has(key)) unique.set(key, field);
  }
  const groups = new Map<string, FieldMapping[]>();
  for (const field of unique.values()) {
    const key = field.group ?? "Additional details";
    groups.set(key, [...(groups.get(key) ?? []), field]);
  }
  function set(field: FieldMapping, value: string | boolean) {
    const next = { ...values, [field.valueKey ?? field.id]: value };
    if (field.exclusiveGroup && value === true)
      for (const other of template.fields) {
        if (
          other.exclusiveGroup === field.exclusiveGroup &&
          other.id !== field.id
        )
          next[other.valueKey ?? other.id] = false;
      }
    onChange(next);
  }
  function fields(items: FieldMapping[]) {
    return (
      <div className="form-grid two">
        {items.map((field) => (
          <label
            className={field.kind === "multiline" ? "span-two" : ""}
            key={field.valueKey ?? field.id}
          >
            {field.kind === "checkbox" ? (
              <span className="inline-check">
                <input
                  type="checkbox"
                  checked={values[field.valueKey ?? field.id] === true}
                  onChange={(e) => set(field, e.target.checked)}
                />
                {field.name}
              </span>
            ) : (
              <>
                {field.name}
                {field.kind === "multiline" ? (
                  <textarea
                    rows={3}
                    value={String(values[field.valueKey ?? field.id] ?? "")}
                    onChange={(e) => set(field, e.target.value)}
                  />
                ) : (
                  <input
                    type={
                      field.inputType ??
                      (field.kind === "datetime" ? "datetime-local" : "text")
                    }
                    value={String(values[field.valueKey ?? field.id] ?? "")}
                    onChange={(e) => set(field, e.target.value)}
                  />
                )}
              </>
            )}
          </label>
        ))}
      </div>
    );
  }
  if (!unique.size)
    return (
      <p className="subtle">
        This template uses patient and order details only. Edit them in the
        earlier steps.
      </p>
    );
  if (groups.size === 1 && groups.has("Additional details"))
    return fields([...unique.values()]);
  return (
    <div className="form-field-sections">
      {[...groups.entries()].map(([name, items], i) => (
        <details key={name} open={i === 0}>
          <summary>
            {name}
            <span>
              {items.length} {items.length === 1 ? "field" : "fields"}
            </span>
          </summary>
          {fields(items)}
        </details>
      ))}
    </div>
  );
}
