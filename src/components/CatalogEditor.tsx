import { useState } from "react";
import { BookOpen, Plus, Save, Search, X } from "lucide-react";
import {
  containerNames,
  type Container,
  type LabTest,
  type Source,
} from "../lib/types";
import { normalize } from "../lib/engine";

export function CatalogEditor({
  catalog,
  sources,
  onSave,
  onClose,
}: {
  catalog: LabTest[];
  sources: Source[];
  onSave: (test: LabTest) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(""),
    [draft, setDraft] = useState<LabTest>(),
    [optionText, setOptionText] = useState("[]"),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const matches = catalog
    .filter((t) =>
      normalize([t.name, t.lab, t.section, ...t.aliases].join(" ")).includes(
        normalize(search),
      ),
    )
    .slice(0, 100);
  function open(test: LabTest) {
    setDraft(structuredClone(test));
    setOptionText(JSON.stringify(test.options ?? [], null, 2));
    setSaved(false);
    setError("");
  }
  function update(patch: Partial<LabTest>) {
    if (draft) {
      setDraft({ ...draft, ...patch });
      setSaved(false);
    }
  }
  function save() {
    if (!draft) return;
    try {
      if (!draft.name.trim() || !draft.lab.trim() || !draft.section.trim())
        throw new Error("Enter a test name, laboratory, and section.");
      const options = JSON.parse(optionText);
      if (
        !Array.isArray(options) ||
        options.some(
          (o) =>
            typeof o.name !== "string" ||
            !Array.isArray(o.parts) ||
            !o.parts.length ||
            o.parts.some(
              (p: { container: string; count: number; instruction: string }) =>
                !Object.keys(containerNames).includes(p.container) ||
                !Number.isInteger(p.count) ||
                p.count < 1 ||
                p.count > 100 ||
                typeof p.instruction !== "string",
            ),
        )
      )
        throw new Error(
          "Each tube-set option needs a name and parts with a valid container, positive integer count, and instruction.",
        );
      onSave({ ...draft, options: options.length ? options : undefined });
      setSaved(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal catalog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">SOURCE-LINKED RULES</span>
            <h2 id="catalog-title">Lab catalog</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close lab catalog"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <p className="subtle">
          Based on your supplied guide. Changes are saved only in this browser;
          existing orders are marked for review when their rule changes.
        </p>
        <div className="catalog-layout">
          <aside>
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Search catalog editor"
                placeholder="Search tests or labs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              className="small-button catalog-add"
              onClick={() =>
                open({
                  id: crypto.randomUUID(),
                  name: "",
                  aliases: [],
                  lab: "Central Lab",
                  section: "Clinical Chemistry",
                  specimen: "",
                  container: "unknown",
                  requirements: "",
                  sourceIds: [],
                  needsReview: true,
                })
              }
            >
              <Plus size={15} />
              Add a test
            </button>
            <div className="catalog-list">
              {matches.map((t) => (
                <button
                  key={t.id}
                  className={draft?.id === t.id ? "active" : ""}
                  onClick={() => open(t)}
                >
                  <strong>{t.name}</strong>
                  <span>
                    {t.lab} · {t.section}
                  </span>
                </button>
              ))}
              {matches.length === 100 && (
                <p className="subtle">Refine your search to see more.</p>
              )}
            </div>
          </aside>
          <div className="catalog-detail">
            {!draft ? (
              <div className="empty-state">
                <BookOpen size={36} />
                <h3>Every rule has a reason.</h3>
                <p>
                  Select a test to inspect its source,
                  <br />
                  update requirements, or change grouping.
                </p>
              </div>
            ) : (
              <>
                <div className="form-grid two">
                  <label className="span-two">
                    Test name
                    <input
                      value={draft.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Laboratory / destination
                    <input
                      value={draft.lab}
                      onChange={(e) => update({ lab: e.target.value })}
                    />
                  </label>
                  <label>
                    Section
                    <input
                      value={draft.section}
                      onChange={(e) => update({ section: e.target.value })}
                    />
                  </label>
                  <label>
                    Specimen
                    <input
                      value={draft.specimen}
                      onChange={(e) => update({ specimen: e.target.value })}
                    />
                  </label>
                  <label>
                    Container
                    <select
                      value={draft.container}
                      onChange={(e) =>
                        update({ container: e.target.value as Container })
                      }
                    >
                      {Object.entries(containerNames).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="span-two">
                    Aliases (one per line)
                    <textarea
                      rows={3}
                      value={draft.aliases.join("\n")}
                      onChange={(e) =>
                        update({ aliases: e.target.value.split("\n") })
                      }
                    />
                  </label>
                  <label className="span-two">
                    Recorded requirements
                    <textarea
                      rows={4}
                      value={draft.requirements}
                      onChange={(e) => update({ requirements: e.target.value })}
                    />
                  </label>
                </div>
                <div className="check-list">
                  <label>
                    <input
                      type="checkbox"
                      checked={!!draft.dedicated}
                      onChange={(e) => update({ dedicated: e.target.checked })}
                    />
                    Dedicated container; do not combine
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!draft.separateRequest}
                      onChange={(e) =>
                        update({ separateRequest: e.target.checked })
                      }
                    />
                    Separate paper request, even if container is shared
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={!!draft.needsReview}
                      onChange={(e) =>
                        update({ needsReview: e.target.checked })
                      }
                    />
                    Require confirmation for each order
                  </label>
                </div>
                <details>
                  <summary>Special tube-set options</summary>
                  <p className="subtle">
                    For multi-tube tests, edit the set definitions. Example: a
                    part contains container “purple”, count 2, and an
                    instruction.
                  </p>
                  <textarea
                    className="code-input"
                    aria-label="Tube-set definitions"
                    rows={9}
                    value={optionText}
                    onChange={(e) => {
                      setOptionText(e.target.value);
                      setSaved(false);
                    }}
                  />
                </details>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <div className="button-row">
                  <button className="button" onClick={save}>
                    <Save size={16} />
                    Save local rule
                  </button>
                  {saved && (
                    <span className="success">Saved on this device</span>
                  )}
                </div>
                <div className="source-records">
                  <h3>Source entries</h3>
                  {draft.sourceIds.length === 0 ? (
                    <p className="subtle">
                      User-defined rule / supplied Surgical Pathology form.
                    </p>
                  ) : (
                    draft.sourceIds.map((id) => {
                      const src = sources.find((s) => s.id === id);
                      return src ? (
                        <details key={id}>
                          <summary>
                            {src.date.split(" UTC")[0]} ·{" "}
                            {src.text.split("\n")[0]}
                          </summary>
                          <pre>{src.text}</pre>
                        </details>
                      ) : null;
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
