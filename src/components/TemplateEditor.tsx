import { useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Plus,
  Trash2,
  Save,
  Download,
  MousePointer2,
  CheckSquare,
  Type,
  Copy,
} from "lucide-react";
import { bindings, type FieldMapping, type FormTemplate } from "../lib/types";
import { assetUrl, templateBytes, toDataUrl } from "../lib/templates";
import { importBackground } from "../lib/pdf";
import { downloadBytes, validateTemplate } from "../lib/storage";
import { PdfPage } from "./PdfPreview";

export function TemplateEditor({
  templates,
  onSave,
  onDelete,
  onClose,
}: {
  templates: FormTemplate[];
  onSave: (t: FormTemplate) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FormTemplate | null>(null),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(""),
    [tool, setTool] = useState<"select" | "text" | "checkbox">("select");
  const [bytes, setBytes] = useState<Uint8Array>(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | {
        id: string;
        pointer: number;
        x: number;
        y: number;
        field: FieldMapping;
        resize: boolean;
      }
    | undefined
  >(undefined);
  const field = draft?.fields.find((f) => f.id === selected),
    size = draft?.pageSizes[page];
  useEffect(() => {
    let live = true;
    setBytes(undefined);
    if (draft?.fileType === "pdf")
      templateBytes(draft)
        .then((b) => {
          if (live) setBytes(b);
        })
        .catch((e) => setError(e.message));
    return () => {
      live = false;
    };
  }, [draft?.id, draft?.data, draft?.assetUrl]);
  function updateField(patch: Partial<FieldMapping>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            fields: d.fields.map((f) =>
              f.id === selected ? { ...f, ...patch } : f,
            ),
          }
        : d,
    );
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await importBackground(file);
      setDraft(result.template);
      setPage(0);
      setSelected("");
      setMessage(
        result.discardedValues
          ? "Existing field values were removed. Check that the background itself contains no patient information before saving."
          : "Background loaded. Add fields or bind the imported fields, then save your blank template.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function exportTemplate() {
    if (!draft) return;
    const data =
      draft.data ??
      toDataUrl(
        await templateBytes(draft),
        draft.fileType === "pdf"
          ? "application/pdf"
          : `image/${draft.fileType === "jpg" ? "jpeg" : "png"}`,
      );
    downloadBytes(
      JSON.stringify(
        { ...draft, data, assetUrl: undefined, builtIn: false },
        null,
        2,
      ),
      "pgh-blank-template.json",
      "application/json",
    );
  }
  async function importTemplate(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024)
        throw new Error("Template export is too large.");
      const t = validateTemplate(JSON.parse(await file.text()));
      setDraft(t);
      setPage(0);
      setSelected("");
      setMessage("Template imported. Review and save to this browser.");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addField(x = 30, y = 30) {
    if (!draft || !size) return;
    const f: FieldMapping = {
      id: crypto.randomUUID(),
      name: tool === "checkbox" ? "New checkbox" : "New field",
      kind: tool === "checkbox" ? "checkbox" : "text",
      binding: "manual",
      page,
      x: Math.min(x, size.width - 120),
      y: Math.min(y, size.height - 24),
      width: tool === "checkbox" ? 14 : 120,
      height: tool === "checkbox" ? 14 : 24,
      fontSize: 10,
    };
    setDraft({ ...draft, fields: [...draft.fields, f] });
    setSelected(f.id);
    setTool("select");
  }
  async function save() {
    if (!draft) return;
    setError("");
    try {
      const data =
        draft.data ??
        toDataUrl(
          await templateBytes(draft),
          draft.fileType === "pdf"
            ? "application/pdf"
            : `image/${draft.fileType === "jpg" ? "jpeg" : "png"}`,
        );
      const t = validateTemplate({ ...draft, data });
      t.id = draft.builtIn ? crypto.randomUUID() : draft.id;
      t.name = draft.builtIn ? `${draft.name} (custom)` : draft.name;
      onSave(t);
      setDraft(t);
      setMessage(
        "Blank template saved on this device. Select it for a request in Review groups.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">YOUR BLANK FORMS</span>
            <h2 id="template-title">Template studio</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close template studio"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="template-topbar">
          <label className="button secondary">
            <Upload size={16} /> Upload blank form
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              hidden
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <label className="button ghost">
            Import template
            <input
              type="file"
              accept=".json"
              hidden
              onChange={(e) => {
                void importTemplate(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <select
            aria-label="Open template"
            value={draft?.id ?? ""}
            onChange={(e) => {
              const t = templates.find((t) => t.id === e.target.value);
              if (t) {
                setDraft(structuredClone(t));
                setPage(0);
                setSelected("");
                setMessage("Built-in forms save as a separate custom copy.");
              }
            }}
          >
            <option value="">Open a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <p className="subtle template-note">
          Upload an empty form. Only blank backgrounds and mappings are saved;
          use the main workspace to enter patient information.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && <p className="notice">{message}</p>}
        {!draft ? (
          <div className="empty-state spacious">
            <div className="empty-icon">
              <Upload />
            </div>
            <h3>A familiar form, ready to fill.</h3>
            <p>
              Upload a PDF or image, place fields on the page,
              <br />
              and connect them to patient details and lab orders.
            </p>
          </div>
        ) : (
          <>
            <div className="editor-heading">
              <input
                aria-label="Template name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <div className="button-row">
                <button
                  className="small-button"
                  onClick={() => void exportTemplate()}
                >
                  <Download size={14} />
                  Export blank template
                </button>
                <button className="button" onClick={() => void save()}>
                  <Save size={16} />
                  {draft.builtIn ? "Save as custom template" : "Save template"}
                </button>
                {!draft.builtIn && (
                  <button
                    className="icon-button danger"
                    aria-label="Delete template"
                    onClick={() => {
                      onDelete(draft.id);
                      setDraft(null);
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </div>
            <div className="editor-grid">
              <div className="editor-paper-area">
                <div className="editor-tools">
                  <button
                    className={tool === "select" ? "active" : ""}
                    onClick={() => setTool("select")}
                  >
                    <MousePointer2 size={15} />
                    Select / drag
                  </button>
                  <button
                    className={tool === "text" ? "active" : ""}
                    onClick={() => setTool("text")}
                  >
                    <Type size={15} />
                    Place text
                  </button>
                  <button
                    className={tool === "checkbox" ? "active" : ""}
                    onClick={() => setTool("checkbox")}
                  >
                    <CheckSquare size={15} />
                    Place checkbox
                  </button>
                  <select
                    aria-label="Template page"
                    value={page}
                    onChange={(e) => {
                      setPage(+e.target.value);
                      setSelected("");
                    }}
                  >
                    {draft.pageSizes.map((_, i) => (
                      <option key={i} value={i}>
                        Page {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  ref={stage}
                  className={`template-stage ${tool !== "select" ? "placing" : ""}`}
                  style={{
                    aspectRatio: size
                      ? `${size.width}/${size.height}`
                      : undefined,
                  }}
                  onClick={(e) => {
                    if (
                      tool === "select" ||
                      !size ||
                      !stage.current ||
                      e.target !== e.currentTarget
                    )
                      return;
                    const rect = stage.current.getBoundingClientRect();
                    addField(
                      ((e.clientX - rect.left) / rect.width) * size.width,
                      ((e.clientY - rect.top) / rect.height) * size.height,
                    );
                  }}
                  onPointerMove={(e) => {
                    const d = drag.current;
                    if (!d || !size || !stage.current || !draft) return;
                    const rect = stage.current.getBoundingClientRect(),
                      dx = ((e.clientX - d.x) / rect.width) * size.width,
                      dy = ((e.clientY - d.y) / rect.height) * size.height;
                    const patch = d.resize
                      ? {
                          width: Math.max(
                            8,
                            Math.min(
                              size.width - d.field.x,
                              d.field.width + dx,
                            ),
                          ),
                          height: Math.max(
                            8,
                            Math.min(
                              size.height - d.field.y,
                              d.field.height + dy,
                            ),
                          ),
                        }
                      : {
                          x: Math.max(
                            0,
                            Math.min(
                              size.width - d.field.width,
                              d.field.x + dx,
                            ),
                          ),
                          y: Math.max(
                            0,
                            Math.min(
                              size.height - d.field.height,
                              d.field.y + dy,
                            ),
                          ),
                        };
                    setDraft({
                      ...draft,
                      fields: draft.fields.map((f) =>
                        f.id === d.id ? { ...f, ...patch } : f,
                      ),
                    });
                  }}
                  onPointerUp={() => {
                    drag.current = undefined;
                  }}
                >
                  <div className="template-background">
                    {draft.fileType === "pdf" ? (
                      bytes && <PdfPage bytes={bytes} page={page} />
                    ) : (
                      <img
                        alt="Blank form background"
                        src={draft.data ?? assetUrl(draft.assetUrl ?? "")}
                      />
                    )}
                  </div>
                  {draft.fields
                    .filter((f) => f.page === page)
                    .map((f) => (
                      <div
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Map ${f.name}`}
                        className={`mapped-field ${f.id === selected ? "selected" : ""} ${f.kind === "checkbox" ? "check-field" : ""}`}
                        style={{
                          left: `${(f.x / size!.width) * 100}%`,
                          top: `${(f.y / size!.height) * 100}%`,
                          width: `${(f.width / size!.width) * 100}%`,
                          height: `${(f.height / size!.height) * 100}%`,
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setSelected(f.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(f.id);
                        }}
                        onPointerDown={(e) => {
                          if (tool !== "select") return;
                          e.stopPropagation();
                          setSelected(f.id);
                          e.currentTarget.setPointerCapture(e.pointerId);
                          drag.current = {
                            id: f.id,
                            pointer: e.pointerId,
                            x: e.clientX,
                            y: e.clientY,
                            field: { ...f },
                            resize: false,
                          };
                        }}
                      >
                        <span>{f.kind === "checkbox" ? "✓" : f.name}</span>
                        <button
                          aria-label={`Resize ${f.name}`}
                          className="resize-handle"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setSelected(f.id);
                            e.currentTarget.setPointerCapture(e.pointerId);
                            drag.current = {
                              id: f.id,
                              pointer: e.pointerId,
                              x: e.clientX,
                              y: e.clientY,
                              field: { ...f },
                              resize: true,
                            };
                          }}
                        />
                      </div>
                    ))}
                </div>
              </div>
              <aside className="field-properties">
                <span className="eyebrow">FIELD PROPERTIES</span>
                {!field ? (
                  <>
                    <h3>Place, then connect.</h3>
                    <p className="subtle">
                      Choose a placement tool and click the page, or select an
                      existing field. Drag to move; use the corner to resize.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => addField()}
                    >
                      <Plus size={16} />
                      Add field
                    </button>
                  </>
                ) : (
                  <>
                    <label>
                      Field label
                      <input
                        value={field.name}
                        onChange={(e) => updateField({ name: e.target.value })}
                      />
                    </label>
                    <label>
                      Field type
                      <select
                        value={field.kind}
                        onChange={(e) =>
                          updateField({
                            kind: e.target.value as FieldMapping["kind"],
                          })
                        }
                      >
                        <option value="text">Text</option>
                        <option value="multiline">Multiline text</option>
                        <option value="datetime">Date / time</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                    </label>
                    <label>
                      Fill from
                      <select
                        value={field.binding}
                        onChange={(e) =>
                          updateField({ binding: e.target.value })
                        }
                      >
                        {!bindings.some(([id]) => id === field.binding) && (
                          <option value={field.binding}>{field.binding}</option>
                        )}
                        {bindings.map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="form-grid two">
                      {(["x", "y", "width", "height", "fontSize"] as const).map(
                        (key) => (
                          <label key={key}>
                            {key === "fontSize" ? "Font size" : key}
                            <input
                              type="number"
                              step="0.5"
                              min={key === "x" || key === "y" ? 0 : 4}
                              value={Math.round(field[key] * 10) / 10}
                              onChange={(e) => {
                                if (e.target.value !== "")
                                  updateField({ [key]: +e.target.value });
                              }}
                            />
                          </label>
                        ),
                      )}
                    </div>
                    <div className="button-row">
                      <button
                        className="small-button"
                        onClick={() => {
                          const f = {
                            ...field,
                            id: crypto.randomUUID(),
                            name: field.name + " copy",
                            y: Math.min(
                              size!.height - field.height,
                              field.y + field.height + 4,
                            ),
                          };
                          setDraft({ ...draft, fields: [...draft.fields, f] });
                          setSelected(f.id);
                        }}
                      >
                        <Copy size={14} />
                        Duplicate
                      </button>
                      <button
                        className="small-button danger"
                        onClick={() => {
                          setDraft({
                            ...draft,
                            fields: draft.fields.filter(
                              (f) => f.id !== selected,
                            ),
                          });
                          setSelected("");
                        }}
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </div>
                  </>
                )}
                <div className="field-count">
                  {draft.fields.length} fields · {draft.pageSizes.length} page
                  {draft.pageSizes.length > 1 ? "s" : ""}
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
