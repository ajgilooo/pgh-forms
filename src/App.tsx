import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Clipboard,
  ClipboardList,
  Copy,
  Download,
  FileCheck2,
  FilePlus2,
  FileText,
  FlaskConical,
  LayoutTemplate,
  Leaf,
  LockKeyhole,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
  Info,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import catalogData from "./data/catalog.json";
import sourcesData from "./data/sources.json";
import {
  emptyPatient,
  containerNames,
  type Container,
  type LabTest,
  type Patient,
  type Order,
  type FormTemplate,
  type Source,
  type GenerationContext,
  type RequestGroup,
} from "./lib/types";
import {
  fullName,
  groupOrders,
  makeLabels,
  allLabelText,
  matchTests,
  parseOrders,
  normalize,
} from "./lib/engine";
import { assetUrl, builtInTemplates } from "./lib/templates";
import { bindingValue, generatePdf } from "./lib/pdf";
import {
  copyText,
  downloadBytes,
  loadSettings,
  saveSettings,
} from "./lib/storage";
import { TemplateEditor } from "./components/TemplateEditor";
import { CatalogEditor } from "./components/CatalogEditor";
import { PdfPreview } from "./components/PdfPreview";

const steps = [
  {
    name: "Patient details",
    short: "Patient",
    description: "Enter once, use everywhere",
    icon: UsersRound,
  },
  {
    name: "Choose tests",
    short: "Tests",
    description: "Paste a list or search",
    icon: FlaskConical,
  },
  {
    name: "Review groups",
    short: "Review",
    description: "Tubes and paper requests",
    icon: ClipboardList,
  },
  {
    name: "Forms & labels",
    short: "Output",
    description: "Download, copy, and go",
    icon: FileCheck2,
  },
];
type Pending = { id: string; input: string; matches: LabTest[] };
type Custom = Record<string, Record<string, string | boolean>>;
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label>
      {label}
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Tube({ color }: { color: Container }) {
  return (
    <span className={`tube-dot ${color}`} aria-label={containerNames[color]} />
  );
}

export default function App() {
  const [settings] = useState(loadSettings);
  const [catalog, setCatalog] = useState<LabTest[]>(() => {
    const edits = new Map(settings.catalog.map((t) => [t.id, t]));
    return [
      ...catalogData.map((t) => edits.get(t.id) ?? (t as LabTest)),
      ...settings.catalog.filter(
        (t) => !catalogData.some((b) => b.id === t.id),
      ),
    ];
  });
  const [savedCatalog, setSavedCatalog] = useState(settings.catalog),
    [customTemplates, setCustomTemplates] = useState(settings.templates);
  const templates = useMemo(
    () => [...builtInTemplates, ...customTemplates],
    [customTemplates],
  );
  const [patient, setPatient] = useState<Patient>({ ...emptyPatient }),
    [orders, setOrders] = useState<Order[]>([]),
    [step, setStep] = useState(0);
  const [search, setSearch] = useState(""),
    [labFilter, setLabFilter] = useState("all"),
    [paste, setPaste] = useState(""),
    [pending, setPending] = useState<Pending[]>([]);
  const [modal, setModal] = useState<"templates" | "catalog" | "guide" | null>(
      null,
    ),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [clipboardFallback, setClipboardFallback] = useState("");
  const [labelCounts, setLabelCounts] = useState<Record<string, number>>({}),
    [custom, setCustom] = useState<Custom>({}),
    [excluded, setExcluded] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
      bytes: Uint8Array;
      pages: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState<string[]>([]);
  const generation = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const grouped = useMemo(
    () => groupOrders(orders, catalog),
    [orders, catalog],
  );
  const labels = makeLabels(grouped.containers, patient, labelCounts);
  const unresolved = grouped.resolved.filter((r) => r.issues.length).length;
  const filteredCatalog = catalog.filter(
    (t) => labFilter === "all" || t.lab === labFilter,
  );
  const matches = (
    search
      ? matchTests(search, filteredCatalog)
      : filteredCatalog.filter(
          (t) =>
            [
              "CBC",
              "Na",
              "K",
              "Cl",
              "HbA1c",
              "TSH",
              "PCT",
              "CRP",
              "ESR",
              "Crea",
              "BUN",
            ].some((a) => t.aliases.includes(a)) && t.lab === "Central Lab",
        )
  ).slice(0, 50);
  const selectedRequests = grouped.requests.filter(
    (r) => r.templateId && !excluded.includes(r.id),
  );
  const missingTemplates = grouped.requests.filter(
    (r) => !r.templateId || !templates.some((t) => t.id === r.templateId),
  );
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    generation.current++;
    setPreview(null);
    setError("");
  }, [patient, orders, catalog, custom, excluded, customTemplates]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModal(null);
        setClipboardFallback("");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!modal && !clipboardFallback) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog
      ?.querySelector<HTMLElement>("button,input,select,textarea,[tabindex]")
      ?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab" || !dialog) return;
      const nodes = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal, !!clipboardFallback]);
  function persist(t: FormTemplate[], c: LabTest[]) {
    try {
      saveSettings(t, c);
    } catch {
      setError(
        "Browser storage is full or unavailable. Your changes work for this session; export blank templates to keep a copy.",
      );
    }
  }
  function patchPatient(key: keyof Patient, value: string) {
    setPatient((p) => ({ ...p, [key]: value }));
  }
  function patchOrder(id: string, patch: Partial<Order>) {
    setOrders((o) => o.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }
  function addTest(t: LabTest) {
    if (orders.some((o) => o.testId === t.id)) {
      setToast("This test is already in the order list.");
      return;
    }
    setOrders((o) => [...o, { id: crypto.randomUUID(), testId: t.id }]);
  }
  function go(n: number) {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function clearPatient() {
    generation.current++;
    setPatient({ ...emptyPatient });
    setOrders([]);
    setPaste("");
    setSearch("");
    setPending([]);
    setCustom({});
    setLabelCounts({});
    setExcluded([]);
    setExpanded([]);
    setPreview(null);
    setClipboardFallback("");
    setStep(0);
    setError("");
    setToast("Patient details and orders cleared.");
  }
  function parseList() {
    const results = parseOrders(paste, catalog);
    const additions: Order[] = [];
    const unresolvedRows: Pending[] = [];
    for (const row of results) {
      if (row.matches.length === 1) {
        if (
          !orders.some((o) => o.testId === row.matches[0].id) &&
          !additions.some((o) => o.testId === row.matches[0].id)
        )
          additions.push({
            id: crypto.randomUUID(),
            testId: row.matches[0].id,
          });
      } else unresolvedRows.push({ ...row, id: crypto.randomUUID() });
    }
    setOrders((o) => [...o, ...additions]);
    setPending((p) => [...p, ...unresolvedRows]);
    setPaste("");
    setToast(
      `${additions.length} tests added${unresolvedRows.length ? `; ${unresolvedRows.length} ${unresolvedRows.length === 1 ? "entry needs" : "entries need"} a choice` : ""}.`,
    );
  }
  async function copy(text: string) {
    if (await copyText(text)) {
      setToast("Copied. Ready to paste into Niimbot.");
    } else setClipboardFallback(text);
  }
  function context(request: RequestGroup): GenerationContext {
    return { patient, request, custom: custom[request.id] ?? {} };
  }
  async function pdf(editable: boolean, download: boolean) {
    setError("");
    if (
      !patient.lastName.trim() ||
      !patient.firstName.trim() ||
      !patient.caseNumber.trim()
    ) {
      setError(
        "Enter the patient’s last name, first name, and case number before generating forms.",
      );
      return;
    }
    if (pending.length) {
      setError(
        "Resolve or explicitly remove unmatched pasted entries in Choose tests.",
      );
      return;
    }
    if (selectedRequests.some((r) => r.issues.length)) {
      setError(
        "Resolve the selected requests’ specimen and tube requirements in Review groups.",
      );
      return;
    }
    if (!selectedRequests.length) {
      setError("Select at least one request with a mapped template.");
      return;
    }
    setBusy(true);
    const token = ++generation.current;
    try {
      const items = selectedRequests.map((request) => ({
        template: templates.find((t) => t.id === request.templateId)!,
        context: context(request),
      }));
      const result = await generatePdf(items, editable);
      if (token !== generation.current) return;
      setPreview({ bytes: result.bytes, pages: result.pages });
      if (download)
        downloadBytes(
          result.bytes,
          `pgh-requests-${editable ? "editable" : "print"}.pdf`,
          "application/pdf",
        );
      setToast(
        `${result.pages} PDF page${result.pages === 1 ? "" : "s"} ready.`,
      );
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const patientInput = (
    key: keyof Patient,
    label: string,
    type = "text",
    placeholder = "",
    hint?: string,
  ) => (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={patient[key]}
        placeholder={placeholder}
        onChange={(e) => patchPatient(key, e.target.value)}
      />
    </Field>
  );
  const labelReady =
    !!patient.lastName.trim() &&
    !!patient.firstName.trim() &&
    !!patient.caseNumber.trim() &&
    !unresolved &&
    !pending.length;
  return (
    <div className="app-shell">
      <aside className="sidebar" inert={!!modal || !!clipboardFallback}>
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          onClick={(e) => {
            e.preventDefault();
            go(0);
          }}
        >
          <span className="brand-mark">
            <FileText size={24} />
          </span>
          <span>
            PGH<span className="brand-light">Forms</span>
            <small>THE PAPERWORK WORKSPACE</small>
          </span>
        </a>
        <div className="sidebar-caption">YOUR WORKFLOW</div>
        <nav className="step-nav">
          {steps.map((s, i) => (
            <button
              key={s.name}
              className={step === i ? "current" : step > i ? "complete" : ""}
              onClick={() => go(i)}
            >
              <span className="step-number">
                {step > i ? (
                  <Check size={15} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span>
                <strong>{s.name}</strong>
                <small>{s.description}</small>
              </span>
              {step === i && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-tools">
          <span className="sidebar-caption">MAKE IT YOURS</span>
          <button onClick={() => setModal("templates")}>
            <LayoutTemplate size={18} />
            Template studio<span>{templates.length}</span>
          </button>
          <button onClick={() => setModal("catalog")}>
            <Settings2 size={18} />
            Lab catalog<span>{catalog.length}</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="private-badge">
            <LockKeyhole size={16} />
            <span>Patient details stay here.</span>
          </div>
          <p>
            Current session only.
            <br />
            Clear or refresh to start fresh.
          </p>
          <span className="sidebar-footer">
            Made for a little less paperwork.
          </span>
        </div>
      </aside>
      <main inert={!!modal || !!clipboardFallback}>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{steps[step].name}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="text-button mobile-tools"
              aria-label="Open template studio"
              onClick={() => setModal("templates")}
            >
              <LayoutTemplate size={16} />
            </button>
            <button
              className="text-button"
              aria-label="How it works"
              onClick={() => setModal("guide")}
            >
              <Info size={15} />
              <span>How it works</span>
            </button>
            <button className="clear-button" onClick={clearPatient}>
              <Trash2 size={14} />
              Clear patient
            </button>
          </div>
        </header>
        <div className="mobile-step-nav">
          {steps.map((s, i) => (
            <button
              key={s.short}
              className={i === step ? "active" : ""}
              onClick={() => go(i)}
            >
              {i + 1}
              <span>{s.short}</span>
            </button>
          ))}
        </div>
        <div className="workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">
                STEP {String(step + 1).padStart(2, "0")} OF 04
              </span>
              <h1 ref={heading} tabIndex={-1}>
                {
                  [
                    "One patient. Every form.",
                    "What labs are we sending?",
                    "A place for every test.",
                    "Ready for the next step.",
                  ][step]
                }
              </h1>
              <p>
                {
                  [
                    "Enter the details once. We’ll carry them through your requests and labels.",
                    "Paste your orders or find tests in the catalog. We’ll sort out the paperwork.",
                    "Review the containers and requests before you generate your forms.",
                    "Download your requests and copy your tube labels into Niimbot.",
                  ][step]
                }
              </p>
            </div>
            <span className="session-badge">
              <span />
              Session only
            </span>
          </div>
          {patient.caseNumber && step > 0 && (
            <div className="patient-strip">
              <span className="patient-avatar">
                <UsersRound size={18} />
              </span>
              <strong>{fullName(patient) || "Patient"}</strong>
              <span className="case-badge">{patient.caseNumber}</span>
              {patient.ward && <span>{patient.ward}</span>}
              <button onClick={() => go(0)}>Edit details</button>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {step === 0 && (
            <div className="patient-layout">
              <div className="patient-main">
                <section className="card">
                  <div className="card-heading">
                    <span className="card-icon">
                      <UsersRound size={19} />
                    </span>
                    <div>
                      <h2>Patient information</h2>
                      <p>The essentials that go on every request.</p>
                    </div>
                    <span className="required-hint">* For PDF export</span>
                  </div>
                  <div className="form-grid three">
                    {patientInput(
                      "lastName",
                      "Last name *",
                      "text",
                      "e.g. Dela Cruz",
                    )}
                    {patientInput(
                      "firstName",
                      "First name *",
                      "text",
                      "e.g. Juan",
                    )}
                    {patientInput(
                      "middleName",
                      "Middle name",
                      "text",
                      "Optional",
                    )}
                  </div>
                  <div className="form-grid patient-demographics">
                    {patientInput(
                      "caseNumber",
                      "Hospital case number *",
                      "text",
                      "Hospital case number",
                    )}
                    {patientInput("birthDate", "Date of birth", "date")}
                    {patientInput("age", "Age", "text", "Age / unit")}
                    <Field label="Sex">
                      <select
                        value={patient.sex}
                        onChange={(e) => patchPatient("sex", e.target.value)}
                      >
                        <option value="">Select</option>
                        <option>Male</option>
                        <option>Female</option>
                      </select>
                    </Field>
                  </div>
                  <div className="form-divider" />
                  <div className="form-grid three">
                    {patientInput(
                      "service",
                      "Service / OPD clinic",
                      "text",
                      "e.g. Internal Medicine",
                    )}
                    {patientInput(
                      "ward",
                      "Ward / room / bed",
                      "text",
                      "e.g. Ward 1 · Bed 5",
                    )}
                    {patientInput(
                      "classification",
                      "MSS classification",
                      "text",
                      "Optional",
                    )}
                  </div>
                  <details className="extra-details">
                    <summary>
                      Additional contact and white card details
                      <ChevronDown size={15} />
                    </summary>
                    <div className="form-grid two">
                      {patientInput("contact", "Contact number")}
                      {patientInput("whiteCard", "White card number")}
                    </div>
                  </details>
                </section>
                <section className="card">
                  <div className="card-heading">
                    <span className="card-icon">
                      <ClipboardList size={19} />
                    </span>
                    <div>
                      <h2>Request details</h2>
                      <p>Shared across this set of forms.</p>
                    </div>
                  </div>
                  <Field label="Clinical diagnosis">
                    <textarea
                      rows={3}
                      value={patient.diagnosis}
                      onChange={(e) =>
                        patchPatient("diagnosis", e.target.value)
                      }
                      placeholder="Diagnosis or clinical indication"
                    />
                  </Field>
                  <div className="form-grid two">
                    {patientInput(
                      "requestedBy",
                      "Requested by",
                      "text",
                      "Doctor’s printed name",
                    )}
                    <Field label="Priority">
                      <div className="segmented">
                        {(["Routine", "STAT"] as const).map((p) => (
                          <button
                            key={p}
                            aria-label={p}
                            className={patient.priority === p ? "active" : ""}
                            onClick={() => patchPatient("priority", p)}
                          >
                            {p === "STAT" && <span className="stat-dot" />}
                            {p}
                          </button>
                        ))}
                      </div>
                    </Field>
                    {patientInput("requestDate", "Date requested", "date")}
                    {patientInput("requestTime", "Time requested", "time")}
                  </div>
                </section>
                <div className="step-footer">
                  <span>
                    <ShieldCheck size={16} />
                    Nothing is uploaded or saved.
                  </span>
                  <button className="button" onClick={() => go(1)}>
                    Choose tests
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
              <aside className="patient-aside">
                <div className="intro-card">
                  <span className="pill">
                    <Leaf size={14} />A LITTLE LESS PAPERWORK
                  </span>
                  <h2>
                    Familiar forms.
                    <br />A smoother shift.
                  </h2>
                  <p>
                    Patient details, lab grouping,
                    <br />
                    and tube labels in one place.
                  </p>
                  <div className="paper-stack">
                    <div className="paper-back" />
                    <div className="paper-front">
                      <img
                        src={assetUrl("forms/central-lab.png")}
                        alt="Your original PGH laboratory request form"
                      />
                      <span className="paper-check">
                        <CheckCheck size={24} />
                      </span>
                    </div>
                  </div>
                  <div className="intro-features">
                    <div>
                      <span>
                        <Check size={14} />
                      </span>
                      Automatic lab grouping
                    </div>
                    <div>
                      <span>
                        <Check size={14} />
                      </span>
                      Four requests per A4 sheet
                    </div>
                    <div>
                      <span>
                        <Check size={14} />
                      </span>
                      Copy labels into Niimbot
                    </div>
                  </div>
                </div>
                <div className="source-note">
                  <BookIcon />
                  <div>
                    <strong>Your guide, kept close.</strong>
                    <p>
                      Lab rules come from your supplied export. Open the catalog
                      to review dates, instructions, and exceptions.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
          {step === 1 && (
            <>
              <div className="tests-layout">
                <div>
                  <section className="card paste-card">
                    <div className="card-heading">
                      <span className="card-icon">
                        <Clipboard size={19} />
                      </span>
                      <div>
                        <h2>Already have a list?</h2>
                        <p>
                          Paste tests separated by commas, lines, or semicolons.
                        </p>
                      </div>
                    </div>
                    <textarea
                      aria-label="Paste lab orders"
                      rows={3}
                      placeholder="CBC, Na, K, Cl, HbA1c, TSH, PCT, ESR"
                      value={paste}
                      onChange={(e) => setPaste(e.target.value)}
                    />
                    <div className="paste-actions">
                      <span className="subtle">
                        You’ll choose between tests with the same name.
                      </span>
                      <button
                        className="button secondary"
                        disabled={!paste.trim()}
                        onClick={parseList}
                      >
                        <Plus size={16} />
                        Add from list
                      </button>
                    </div>
                  </section>
                  {pending.length > 0 && (
                    <section className="card pending-card">
                      <div className="card-heading">
                        <span className="card-icon amber">
                          <CircleAlert size={19} />
                        </span>
                        <div>
                          <h2>
                            {pending.length}{" "}
                            {pending.length === 1
                              ? "entry needs"
                              : "entries need"}{" "}
                            your choice
                          </h2>
                          <p>
                            Nothing from your pasted list is silently discarded.
                          </p>
                        </div>
                      </div>
                      {pending.map((row) => (
                        <div className="pending-row" key={row.id}>
                          <strong>{row.input}</strong>
                          <select
                            aria-label={`Resolve ${row.input}`}
                            value=""
                            onChange={(e) => {
                              const t = catalog.find(
                                (t) => t.id === e.target.value,
                              );
                              if (t) {
                                addTest(t);
                                setPending((p) =>
                                  p.filter((r) => r.id !== row.id),
                                );
                              }
                            }}
                          >
                            <option value="">
                              {row.matches.length
                                ? "Choose the test and destination…"
                                : "No match — search the catalog or add a local test"}
                            </option>
                            {row.matches.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} — {t.lab} / {t.section} ·{" "}
                                {t.specimen || "specimen needed"}
                              </option>
                            ))}
                          </select>
                          <button
                            className="icon-button"
                            aria-label={`Remove unmatched entry ${row.input}`}
                            onClick={() =>
                              setPending((p) =>
                                p.filter((r) => r.id !== row.id),
                              )
                            }
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                  <section className="card search-card">
                    <div className="section-title">
                      <h2>Find a test</h2>
                      <span className="count-pill">
                        {catalog.length} in your catalog
                      </span>
                    </div>
                    <div className="search-controls">
                      <div className="search-input">
                        <Search size={18} />
                        <input
                          placeholder="Search tests, abbreviations, or panels…"
                          aria-label="Search tests"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                          <button
                            className="icon-button"
                            aria-label="Clear search"
                            onClick={() => setSearch("")}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <select
                        aria-label="Filter by laboratory"
                        value={labFilter}
                        onChange={(e) => setLabFilter(e.target.value)}
                      >
                        <option value="all">All laboratories</option>
                        {[...new Set(catalog.map((t) => t.lab))].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="catalog-results">
                      {!search && (
                        <span className="eyebrow popular-title">
                          COMMONLY REQUESTED
                        </span>
                      )}
                      {matches.length === 0 ? (
                        <div className="empty-state">
                          <Search />
                          <h3>No matching tests.</h3>
                          <p>
                            Try an abbreviation or add the test in the lab
                            catalog.
                          </p>
                          <button
                            className="small-button"
                            onClick={() => setModal("catalog")}
                          >
                            Open lab catalog
                          </button>
                        </div>
                      ) : (
                        matches.map((t) => (
                          <div className="test-result" key={t.id}>
                            <Tube color={t.container} />
                            <div>
                              <strong>{t.name}</strong>
                              <span>
                                {t.lab} · {t.section}
                                {t.specimen ? ` · ${t.specimen}` : ""}
                              </span>
                            </div>
                            <button
                              className={`add-test ${orders.some((o) => o.testId === t.id) ? "added" : ""}`}
                              aria-label={`Add ${t.name} from ${t.lab}`}
                              disabled={orders.some((o) => o.testId === t.id)}
                              onClick={() => addTest(t)}
                            >
                              {orders.some((o) => o.testId === t.id) ? (
                                <Check size={17} />
                              ) : (
                                <Plus size={17} />
                              )}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    {matches.length === 50 && (
                      <p className="subtle">
                        Showing 50 matches. Refine your search for more.
                      </p>
                    )}
                  </section>
                </div>
                <aside>
                  <section className="card order-basket">
                    <div className="section-title">
                      <h2>Your orders</h2>
                      <span className="count-pill">{orders.length}</span>
                    </div>
                    {!orders.length ? (
                      <div className="empty-state">
                        <FlaskConical size={33} />
                        <h3>A fresh set of requests.</h3>
                        <p>
                          Add tests from the catalog
                          <br />
                          or paste your lab orders.
                        </p>
                      </div>
                    ) : (
                      <>
                        {grouped.resolved.map((r) => (
                          <div className="basket-item" key={r.order.id}>
                            <Tube color={r.container} />
                            <div>
                              <strong>{r.test.name}</strong>
                              <span>
                                {r.lab} · {r.section}
                              </span>
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`Remove ${r.test.name}`}
                              onClick={() =>
                                setOrders((o) =>
                                  o.filter((v) => v.id !== r.order.id),
                                )
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <div className="basket-summary">
                          <div>
                            <span>Containers</span>
                            <strong>
                              {grouped.containers.reduce(
                                (n, g) => n + g.count,
                                0,
                              )}
                            </strong>
                          </div>
                          <div>
                            <span>Paper requests</span>
                            <strong>{grouped.requests.length}</strong>
                          </div>
                        </div>
                        <button className="button full" onClick={() => go(2)}>
                          Review groups
                          <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </section>
                  <div className="tip-card">
                    <Info size={17} />
                    <p>
                      Same color doesn’t always mean one tube. We also check the
                      lab section, specimen, and special instructions.
                    </p>
                  </div>
                </aside>
              </div>
              <div className="step-footer">
                <button className="text-button" onClick={() => go(0)}>
                  <ArrowLeft size={16} />
                  Patient details
                </button>
                <button
                  className="button"
                  disabled={!orders.length}
                  onClick={() => go(2)}
                >
                  Review groups
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="summary-cards">
                <div>
                  <FlaskConical size={21} />
                  <strong>
                    {grouped.containers.reduce((n, g) => n + g.count, 0)}
                  </strong>
                  <span>tubes / containers</span>
                </div>
                <div>
                  <FileText size={21} />
                  <strong>{grouped.requests.length}</strong>
                  <span>paper requests</span>
                </div>
                <div className={unresolved ? "needs-attention" : ""}>
                  <CircleAlert size={21} />
                  <strong>{unresolved}</strong>
                  <span>orders to confirm</span>
                </div>
              </div>
              {!orders.length ? (
                <EmptyOrders onClick={() => go(1)} />
              ) : (
                <>
                  <div className="review-section-title">
                    <div>
                      <h2>Specimen groups</h2>
                      <p>
                        Containers are grouped separately from request forms.
                      </p>
                    </div>
                    <span className="count-pill">
                      {orders.length} ordered tests
                    </span>
                  </div>
                  <div className="group-list">
                    {grouped.containers.map((g, i) => (
                      <section className="card group-card" key={g.id}>
                        <header>
                          <div className="group-number">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div className="group-main-title">
                            <h3>
                              <Tube color={g.container} />
                              {containerNames[g.container]}
                              <span className="count-pill">× {g.count}</span>
                            </h3>
                            <p>
                              {g.lab} · {g.section} ·{" "}
                              {g.specimen || "Specify specimen"}
                              {g.site && ` · ${g.site}`}
                            </p>
                          </div>
                          <span
                            className={`status-pill ${g.issues.length ? "warning" : "ready"}`}
                          >
                            {g.issues.length ? (
                              <CircleAlert size={13} />
                            ) : (
                              <Check size={13} />
                            )}{" "}
                            {g.issues.length ? "Needs review" : "Grouped"}
                          </span>
                        </header>
                        <div className="group-test-chips">
                          {g.orders.map((r) => (
                            <span key={r.order.id}>
                              {r.test.name}
                              {r.test.separateRequest && (
                                <small>separate request</small>
                              )}
                            </span>
                          ))}
                        </div>
                        <div className="group-reason">
                          <Info size={14} />
                          {g.reason}
                        </div>
                        {g.instruction && (
                          <p className="requirements">{g.instruction}</p>
                        )}
                        <details open={g.issues.length > 0}>
                          <summary>
                            Requirements & manual corrections
                            <ChevronDown size={15} />
                          </summary>
                          {g.orders.map((r) => (
                            <div className="order-correction" key={r.order.id}>
                              <strong>{r.test.name}</strong>
                              <p className="requirements">
                                {r.test.requirements}
                              </p>
                              {r.issues.length > 0 && (
                                <ul className="issue-list">
                                  {r.issues.map((issue) => (
                                    <li key={issue}>{issue}</li>
                                  ))}
                                </ul>
                              )}
                              <div className="form-grid three">
                                <label>
                                  Specimen
                                  <input
                                    value={r.specimen}
                                    placeholder="Spell out specimen name"
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        specimen: e.target.value,
                                        reviewed: false,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Collection site / source
                                  <input
                                    value={r.site}
                                    placeholder="e.g. left pleural fluid"
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        site: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Tube / container
                                  <select
                                    value={r.container}
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        container: e.target.value as Container,
                                        reviewed: false,
                                      })
                                    }
                                  >
                                    {Object.entries(containerNames).map(
                                      ([id, label]) => (
                                        <option key={id} value={id}>
                                          {label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </label>
                                <label>
                                  Destination
                                  <input
                                    value={r.lab}
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        lab: e.target.value,
                                        reviewed: false,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Lab section
                                  <input
                                    value={r.section}
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        section: e.target.value,
                                        reviewed: false,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Order notes
                                  <input
                                    value={r.order.notes ?? ""}
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        notes: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                              </div>
                              {r.test.options?.length && (
                                <label className="tube-options">
                                  Tube-set choice
                                  <select
                                    value={r.order.optionIndex ?? ""}
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        optionIndex:
                                          e.target.value === ""
                                            ? undefined
                                            : +e.target.value,
                                        reviewed: false,
                                      })
                                    }
                                  >
                                    <option value="">
                                      Choose a confirmed set…
                                    </option>
                                    {r.test.options.map((o, i) => (
                                      <option key={i} value={i}>
                                        {o.name}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <div className="check-list">
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={r.dedicated}
                                    onChange={(e) =>
                                      patchOrder(r.order.id, {
                                        dedicated: e.target.checked,
                                      })
                                    }
                                  />
                                  Keep this test in a dedicated container
                                </label>
                                {r.test.needsReview && (
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={!!r.order.reviewed}
                                      onChange={(e) =>
                                        patchOrder(r.order.id, {
                                          reviewed: e.target.checked,
                                        })
                                      }
                                    />
                                    I confirmed these collection requirements
                                    for this order
                                  </label>
                                )}
                              </div>
                            </div>
                          ))}
                        </details>
                      </section>
                    ))}
                  </div>
                  <section className="card request-assignments">
                    <div className="card-heading">
                      <span className="card-icon">
                        <FileText size={19} />
                      </span>
                      <div>
                        <h2>Request forms</h2>
                        <p>
                          Choose the correct blank template for each request.
                        </p>
                      </div>
                    </div>
                    {grouped.requests.map((r, i) => (
                      <div className="request-assignment" key={r.id}>
                        <span className="assignment-number">{i + 1}</span>
                        <div>
                          <strong>
                            {r.orders.map((o) => o.test.name).join(", ")}
                          </strong>
                          <span>
                            {r.lab} · {r.section}
                          </span>
                        </div>
                        <select
                          aria-label={`Template for request ${i + 1}`}
                          value={r.templateId}
                          onChange={(e) =>
                            r.orders.forEach((o) =>
                              patchOrder(o.order.id, {
                                templateId: e.target.value,
                              }),
                            )
                          }
                        >
                          <option value="">
                            Upload / map this lab’s form…
                          </option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    {missingTemplates.length > 0 && (
                      <div className="inline-notice">
                        <Info size={17} />
                        <span>
                          {missingTemplates.length} requests need a mapped form.
                          Orders and labels remain available.
                        </span>
                        <button
                          className="text-button"
                          onClick={() => setModal("templates")}
                        >
                          Open template studio
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              <div className="step-footer">
                <button className="text-button" onClick={() => go(1)}>
                  <ArrowLeft size={16} />
                  Choose tests
                </button>
                <button
                  className="button"
                  disabled={!orders.length}
                  onClick={() => go(3)}
                >
                  Forms & labels
                  <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              {!orders.length ? (
                <EmptyOrders onClick={() => go(1)} />
              ) : (
                <div className="output-layout">
                  <div>
                    <section className="card export-card">
                      <div className="card-heading">
                        <span className="card-icon">
                          <FileCheck2 size={20} />
                        </span>
                        <div>
                          <h2>Your request forms</h2>
                          <p>
                            Print-ready or editable. Always preview before
                            printing.
                          </p>
                        </div>
                        <span className="count-pill">
                          {selectedRequests.length} selected
                        </span>
                      </div>
                      {grouped.requests.map((r, i) => {
                        const t = templates.find((t) => t.id === r.templateId);
                        const isExpanded = expanded.includes(r.id);
                        return (
                          <div className="export-request" key={r.id}>
                            <div className="export-request-heading">
                              <input
                                type="checkbox"
                                aria-label={`Include request ${i + 1}`}
                                checked={!!t && !excluded.includes(r.id)}
                                disabled={!t}
                                onChange={(e) =>
                                  setExcluded((v) =>
                                    e.target.checked
                                      ? v.filter((id) => id !== r.id)
                                      : [...v, r.id],
                                  )
                                }
                              />
                              <div>
                                <strong>
                                  {r.orders.map((o) => o.test.name).join(", ")}
                                </strong>
                                <span>
                                  {t
                                    ? t.name
                                    : "Template needed — assign in Review groups"}
                                  {r.issues.length
                                    ? " · requirements unresolved"
                                    : ""}
                                </span>
                              </div>
                              {t && (
                                <button
                                  className="small-button"
                                  onClick={() =>
                                    setExpanded((v) =>
                                      isExpanded
                                        ? v.filter((id) => id !== r.id)
                                        : [...v, r.id],
                                    )
                                  }
                                >
                                  {isExpanded ? "Close" : "Form fields"}
                                  <ChevronDown size={13} />
                                </button>
                              )}
                            </div>
                            {t && isExpanded && (
                              <div className="manual-fields">
                                <p className="subtle">
                                  Patient and order fields fill automatically.
                                  Enter only the extra details needed for this
                                  form. Leave receiving-lab and signature areas
                                  blank unless appropriate.
                                </p>
                                {t.fields.filter((f) => f.binding === "manual")
                                  .length === 0 ? (
                                  <p className="subtle">
                                    This template uses patient and order details
                                    only. Edit them in the earlier steps.
                                  </p>
                                ) : (
                                  <div className="form-grid two">
                                    {t.fields
                                      .filter((f) => f.binding === "manual")
                                      .map((f) => (
                                        <label
                                          className={
                                            f.kind === "multiline"
                                              ? "span-two"
                                              : ""
                                          }
                                          key={f.id}
                                        >
                                          {f.kind === "checkbox" ? (
                                            <span className="inline-check">
                                              <input
                                                type="checkbox"
                                                checked={
                                                  custom[r.id]?.[f.id] === true
                                                }
                                                onChange={(e) =>
                                                  setCustom((c) => ({
                                                    ...c,
                                                    [r.id]: {
                                                      ...c[r.id],
                                                      [f.id]: e.target.checked,
                                                    },
                                                  }))
                                                }
                                              />
                                              {f.name}
                                            </span>
                                          ) : (
                                            <>
                                              {f.name}
                                              {f.kind === "multiline" ? (
                                                <textarea
                                                  rows={3}
                                                  value={String(
                                                    custom[r.id]?.[f.id] ?? "",
                                                  )}
                                                  onChange={(e) =>
                                                    setCustom((c) => ({
                                                      ...c,
                                                      [r.id]: {
                                                        ...c[r.id],
                                                        [f.id]: e.target.value,
                                                      },
                                                    }))
                                                  }
                                                />
                                              ) : (
                                                <input
                                                  value={String(
                                                    custom[r.id]?.[f.id] ?? "",
                                                  )}
                                                  onChange={(e) =>
                                                    setCustom((c) => ({
                                                      ...c,
                                                      [r.id]: {
                                                        ...c[r.id],
                                                        [f.id]: e.target.value,
                                                      },
                                                    }))
                                                  }
                                                />
                                              )}
                                            </>
                                          )}
                                        </label>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {missingTemplates.length > 0 && (
                        <p className="inline-notice">
                          <Info size={16} />
                          {missingTemplates.length} requests are omitted until
                          you map their forms.
                        </p>
                      )}
                      <div className="export-actions">
                        <button
                          className="button secondary"
                          disabled={busy || !selectedRequests.length}
                          onClick={() => void pdf(true, false)}
                        >
                          {busy ? (
                            <LoaderCircle size={16} className="spin" />
                          ) : (
                            <FileText size={16} />
                          )}
                          Preview PDF
                        </button>
                        <button
                          className="button"
                          disabled={busy || !selectedRequests.length}
                          onClick={() => void pdf(false, true)}
                        >
                          <Download size={16} />
                          Print PDF
                        </button>
                        <button
                          className="button secondary"
                          disabled={busy || !selectedRequests.length}
                          onClick={() => void pdf(true, true)}
                        >
                          <FilePlus2 size={16} />
                          Editable PDF
                        </button>
                      </div>
                      <p className="export-footnote">
                        Central Lab: four requests per A4 page. Other forms keep
                        their original layout.
                      </p>
                    </section>
                    {preview && (
                      <PdfPreview bytes={preview.bytes} pages={preview.pages} />
                    )}
                  </div>
                  <aside className="labels-column">
                    <section className="card labels-card">
                      <div className="card-heading">
                        <span className="card-icon">
                          <Copy size={19} />
                        </span>
                        <div>
                          <h2>Tube labels</h2>
                          <p>Four lines. Ready for Niimbot.</p>
                        </div>
                      </div>
                      <div className="form-grid two">
                        {patientInput(
                          "collectedDate",
                          "Collection date",
                          "date",
                        )}
                        {patientInput(
                          "collectedTime",
                          "Collection time",
                          "time",
                        )}
                      </div>
                      {patientInput(
                        "collectedBy",
                        "Collected by",
                        "text",
                        "Leave blank until collected",
                      )}
                      <div className="label-example">
                        <span className="eyebrow">LABEL TEXT</span>
                        <pre>
                          {fullName(patient) || "NAME"}
                          {"\n"}
                          {patient.caseNumber || "CASE NUMBER"}
                          {"\n"}
                          {[patient.collectedDate, patient.collectedTime]
                            .filter(Boolean)
                            .join(" ") || "DATE TIME"}
                          {"\n"}COLLECTED BY: {patient.collectedBy}
                        </pre>
                      </div>
                      {!labelReady && (
                        <p className="label-warning">
                          Enter patient name and case number, and resolve
                          collection requirements before copying labels.
                        </p>
                      )}
                      <div className="label-groups">
                        {labels.map((l, i) => (
                          <div className="label-group" key={l.groupId}>
                            <div>
                              <Tube color={l.container} />
                              <div>
                                <strong>{containerNames[l.container]}</strong>
                                <span>{l.destination}</span>
                              </div>
                            </div>
                            <div className="label-controls">
                              <label>
                                Count
                                <input
                                  aria-label={`Label count for container ${i + 1}`}
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={l.count}
                                  onChange={(e) =>
                                    setLabelCounts((c) => ({
                                      ...c,
                                      [l.groupId]: Math.max(
                                        0,
                                        Math.min(
                                          100,
                                          Math.floor(+e.target.value),
                                        ),
                                      ),
                                    }))
                                  }
                                />
                              </label>
                              <button
                                className="small-button"
                                disabled={!labelReady || !l.count}
                                onClick={() =>
                                  void copy(
                                    Array.from(
                                      { length: l.count },
                                      () => l.text,
                                    ).join("\n\n"),
                                  )
                                }
                              >
                                <Copy size={14} />
                                Copy label{l.count > 1 ? "s" : ""}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        className="button full"
                        disabled={
                          !labelReady || !labels.some((l) => l.count > 0)
                        }
                        onClick={() => void copy(allLabelText(labels))}
                      >
                        <Copy size={16} />
                        Copy all labels
                        <span className="button-count">
                          {labels.reduce((n, l) => n + l.count, 0)}
                        </span>
                      </button>
                    </section>
                    <div className="tip-card">
                      <ShieldCheck size={18} />
                      <p>
                        Collection time stays blank until you enter it. Your
                        downloaded PDFs and copied labels are yours to handle.
                      </p>
                    </div>
                  </aside>
                </div>
              )}
              <div className="step-footer">
                <button className="text-button" onClick={() => go(2)}>
                  <ArrowLeft size={16} />
                  Review groups
                </button>
                <button className="text-button" onClick={clearPatient}>
                  Start a new patient
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <Leaf size={13} />
              PGH Forms
            </span>
            <span>
              Based on supplied lab guidance · Review requirements with the
              receiving lab.
            </span>
            <button onClick={() => setModal("catalog")}>
              View sources
              <ArrowRight size={12} />
            </button>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === "templates" && (
        <TemplateEditor
          templates={templates}
          onClose={() => setModal(null)}
          onSave={(t) => {
            const next = [...customTemplates.filter((x) => x.id !== t.id), t];
            setCustomTemplates(next);
            persist(next, savedCatalog);
          }}
          onDelete={(id) => {
            const next = customTemplates.filter((t) => t.id !== id);
            setCustomTemplates(next);
            persist(next, savedCatalog);
            setOrders((o) =>
              o.map((x) =>
                x.templateId === id ? { ...x, templateId: "" } : x,
              ),
            );
          }}
        />
      )}
      {modal === "catalog" && (
        <CatalogEditor
          catalog={catalog}
          sources={sourcesData as Source[]}
          onClose={() => setModal(null)}
          onSave={(t) => {
            const next = [...savedCatalog.filter((x) => x.id !== t.id), t];
            setSavedCatalog(next);
            setCatalog((c) =>
              c.some((x) => x.id === t.id)
                ? c.map((x) => (x.id === t.id ? t : x))
                : [...c, t],
            );
            setOrders((o) =>
              o.map((x) => (x.testId === t.id ? { ...x, reviewed: false } : x)),
            );
            persist(customTemplates, next);
          }}
        />
      )}
      {modal === "guide" && (
        <div className="modal-backdrop">
          <section
            className="modal guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
          >
            <header className="modal-header">
              <h2 id="guide-title">A little less paperwork.</h2>
              <button
                className="icon-button"
                aria-label="Close guide"
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </header>
            <ol className="guide-list">
              <li>
                <strong>Enter your patient once.</strong>
                <p>
                  Name and case number are required for export. Other fields
                  remain blank until entered.
                </p>
              </li>
              <li>
                <strong>Paste or choose tests.</strong>
                <p>
                  Choose a destination when names overlap. Unmatched entries
                  remain visible until resolved or removed.
                </p>
              </li>
              <li>
                <strong>Review the groups.</strong>
                <p>
                  Same section, specimen, site, and compatible container can
                  share. Green tops and dedicated tests stay separate; some
                  shared tubes need separate paper requests.
                </p>
              </li>
              <li>
                <strong>Preview, download, copy.</strong>
                <p>
                  Central Lab prints four requests per A4 sheet. Map other forms
                  in Template studio. Copy four-line labels into your own
                  Niimbot app.
                </p>
              </li>
            </ol>
            <div className="notice">
              <LockKeyhole size={18} />
              <p>
                Patient information is held only in memory. Refreshing or
                clearing removes it. Only blank templates and catalog changes
                are stored on this device.
              </p>
            </div>
            <p className="subtle">
              The lab guide contains historical entries from 2023–2025. Current
              availability, schedules, fees, volumes and compatibility require
              confirmation with the receiving lab.
            </p>
          </section>
        </div>
      )}
      {clipboardFallback && (
        <div className="modal-backdrop">
          <section
            className="modal guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-title"
          >
            <header className="modal-header">
              <h2 id="copy-title">Select and copy your labels</h2>
              <button
                className="icon-button"
                aria-label="Close label text"
                onClick={() => setClipboardFallback("")}
              >
                <X />
              </button>
            </header>
            <p>
              Your browser couldn’t access the clipboard. Select this text and
              use your device’s Copy command.
            </p>
            <textarea
              className="code-input"
              aria-label="Labels for manual copying"
              rows={12}
              readOnly
              value={clipboardFallback}
              onFocus={(e) => e.target.select()}
              autoFocus
            />
          </section>
        </div>
      )}
    </div>
  );
}
function BookIcon() {
  return <FileText size={20} />;
}
function EmptyOrders({ onClick }: { onClick: () => void }) {
  return (
    <div className="card empty-state spacious">
      <FlaskConical size={38} />
      <h3>Start with your lab orders.</h3>
      <p>Add a test or paste a list to see your grouped requests here.</p>
      <button className="button" onClick={onClick}>
        Choose tests
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
