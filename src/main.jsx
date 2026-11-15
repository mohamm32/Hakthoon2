import React, { useState, useMemo, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  MessageCircle,
  Activity,
  HeartPulse,
  Database,
  FlaskConical,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Upload,
  Settings2,
  Bell,
  Search,
  Plus,
  X,
  ShieldCheck,
  Info,
  Radio,
  Video,
  Watch,
  Globe2,
  Bone,
  Footprints,
  FileText,
  Stethoscope,
  UserRound,
  Menu,
  Orbit,
  Link2,
  RotateCcw,
  ExternalLink,
  ClipboardList,
  AlertCircle,
  SlidersHorizontal,
  WifiOff,
  Target,
} from "lucide-react";
import {
  crew as allCrew,
  demoRecords,
  analyze,
  parseCSV,
  toCSV,
  studies,
} from "./engine.mjs";
import { Logo, LineChart, BodyFigure } from "./Visuals";
import MovementLab, { download } from "./MovementLab";
import ChatbotPage from "./ChatbotPage.jsx";
import { BackendGate, BackendSettings, useBackend, useWorkspaceField } from "./Backend.jsx";
import "./style.css";

const navs = [
  ["overview", LayoutDashboard, "Mission overview", "نظرة عامة"],
  ["movement", Activity, "Movement lab", "مختبر الحركة"],
  ["health", HeartPulse, "Health records", "السجل الصحي"],
  ["sources", Database, "Data connections", "مصادر البيانات"],
  ["research", FlaskConical, "Research & insights", "البحث والتحليل"],
  ["chatbot", MessageCircle, "Ask SOL", "مساعد SOL"],
  ["backend", Settings2, "Backend & accounts", "Backend & accounts"],
];
const clinicalDefaults = [
  {
    id: "m1",
    name: "Lumbar paraspinal lean fraction",
    value: 86,
    unit: "%",
    phase: "Pre-flight",
    date: "2026-06-01",
    method: "MRI · illustrative record",
  },
  {
    id: "m2",
    name: "Femoral neck BMD",
    value: 1.04,
    unit: "g/cm²",
    phase: "Pre-flight",
    date: "2026-06-01",
    method: "DXA · illustrative record",
  },
  {
    id: "m3",
    name: "Peak knee extension torque",
    value: 211,
    unit: "N·m",
    phase: "Pre-flight",
    date: "2026-06-02",
    method: "Dynamometer · illustrative record",
  },
  {
    id: "m4",
    name: "VO₂peak",
    value: 48.2,
    unit: "mL/kg/min",
    phase: "Pre-flight",
    date: "2026-06-02",
    method: "Exercise test · illustrative record",
  },
];
function App() {
  const { user, astronaut_ids } = useBackend();
  const crew = allCrew.filter(p => astronaut_ids.includes(p.id));
  const [lang, setLang] = useState("en"),
    [role] = useState(user.role),
    [page, setPage] = useState("overview"),
    [personID, setPersonID] = useState(user.astronaut_id || crew[0]?.id),
    [datasets, setDatasets] = useWorkspaceField("datasets"),
    [range, setRange] = useState("4"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [bell, setBell] = useState(false),
    [mobile, setMobile] = useState(false),
    [deviation, setDeviation] = useState(20),
    [minConfidence, setMinConfidence] = useState(0.75),
    [reviewed, setReviewed] = useWorkspaceField("reviewed"),
    [approved, setApproved] = useWorkspaceField("approved"),
    [done, setDone] = useWorkspaceField("done"),
    [notes, setNotes] = useWorkspaceField("notes"),
    [measurements, setMeasurements] = useWorkspaceField("measurements"),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(false),
    [proposalState, setProposalState] = useState("Draft"),
    [importError, setImportError] = useState("");
  const t = (en, ar) => (lang === "ar" ? ar : en);
  const person = crew.find((p) => p.id === personID);
  const allRows = useMemo(
    () => datasets[personID] || demoRecords(personID),
    [datasets, personID],
  );
  const rows = useMemo(() => {
    const end = Math.max(...allRows.map((r) => Date.parse(r.timestamp)));
    return allRows.filter(
      (r) => Date.parse(r.timestamp) >= end - Number(range) * 3600000,
    );
  }, [allRows, range]);
  const stats = useMemo(
    () => analyze(rows, { deviation, minConfidence }),
    [rows, deviation, minConfidence],
  );
  const isDemo = !datasets[personID],
    dataLabel = isDemo
      ? "Demo data"
      : allRows.every((r) => r.source === "demo-fused")
        ? "Imported demo data"
        : allRows.some((r) => r.source === "demo-fused")
          ? "Mixed demo + local"
          : "Session data";
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModal(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(id);
  }, [toast]);
  function go(p) {
    setPage(p);
    setMobile(false);
    setBell(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImportError("");
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Choose a CSV file smaller than 5 MB.");
      const parsed = parseCSV(await file.text());
      if (parsed.some(row => !astronaut_ids.includes(row.astronaut_id))) {
        throw new Error("This CSV includes a profile your account cannot access.");
      }
      const grouped = {};
      for (const r of parsed) (grouped[r.astronaut_id] ??= []).push(r);
      setDatasets((d) => ({ ...d, ...grouped }));
      setReviewed({});
      setApproved({});
      setDraft(false);
      setPersonID(Object.keys(grouped)[0]);
      setModal(null);
      setToast(
        `${parsed.length} observations imported. Click Save changes to persist them.`,
      );
    } catch (e) {
      setImportError(e.message);
    }
    e.target.value = "";
  }
  function exportReport() {
    download(
      "sol-" + personID + "-report.json",
      JSON.stringify(
        {
          prototype: true,
          notice:
            "Research prototype. Rule-based movement review; not a medical diagnosis.",
          astronaut: person,
          provenance: dataLabel,
          generated: new Date().toISOString(),
          rules: { angleDeviation: deviation, minConfidence, validated: false },
          summary: stats,
          observations: rows,
          clinicalRecords:
            measurements[personID] ||
            clinicalDefaults.map((x) => ({ ...x, illustrative: true })),
          clinicianNote: notes[personID] || "",
          planApproved: !!approved[personID],
        },
        null,
        2,
      ),
      "application/json",
    );
    setToast("Profile report exported.");
  }
  const title = navs.find((n) => n[0] === page)?.[2];
  function capture(newRows) {
    setReviewed((r) => ({ ...r, [personID]: false }));
    setApproved((a) => ({ ...a, [personID]: false }));
    setDraft(false);
    setDatasets((d) => ({
      ...d,
      [personID]: [...(d[personID] || []), ...newRows].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      ),
    }));
    setToast(
      `${newRows.length} local pose observations added. No vital signs inferred.`,
    );
  }
  const currentReviewed = !!reviewed[personID];
  return (
    <div className={"app " + (lang === "ar" ? "arabic" : "")}>
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
          aria-label="SOL home"
        >
          <Logo />
        </a>
        <div className="mission-marker">
          <div className="mission-icon">
            <Orbit size={22} />
          </div>
          <div>
            <b>ORBITAL MISSION</b>
            <span>
              {t("ISS · Expedition prototype", "محطة الفضاء · نموذج تجريبي")}
            </span>
          </div>
        </div>
        <div className="nav-label">{t("WORKSPACE", "مساحة العمل")}</div>
        <nav>
          {navs.map(([id, Icon, en, ar]) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => go(id)}
            >
              <Icon size={18} />
              <span>{t(en, ar)}</span>
              {id === "overview" && stats.flagged > 0 && (
                <span className="nav-count">1</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mission-card">
            <span className="live-dot" /> <span>MISSION DAY</span>
            <b>
              {person.day}
              <small> / 180</small>
            </b>
            <div className="progress-track">
              <i style={{ width: (person.day / 180) * 100 + "%" }} />
            </div>
            <p>{t("Every movement tells a story.", "كل حركة تروي قصة.")}</p>
          </div>
          <button
            className="sidebar-setting"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={17} /> {t("Analysis settings", "إعدادات التحليل")}
          </button>
          <div className="sidebar-user">
            <div className="avatar doctor">
              <Stethoscope size={19} />
            </div>
            <div>
              <b>
                {role === "doctor"
                  ? t("Ground medical team", "الفريق الطبي الأرضي")
                  : t("Crew workspace", "مساحة رائد الفضاء")}
              </b>
              <span>{t("SOL Team · Nablus", "فريق SOL · نابلس")}</span>
            </div>
            <ShieldCheck size={15} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>
              {role === "astronaut"
                ? t("My wellbeing", "صحتي")
                : t(title, navs.find((n) => n[0] === page)?.[3])}
            </b>
          </div>
          <div className="top-actions">
            <span className="prototype-badge">
              <span className="dot" />
              {t("Research prototype", "نموذج بحثي")}
            </span>
            <button
              className="language"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              title="Change language"
            >
              {lang === "en" ? "العربية" : "English"}
            </button>
            <div className="bell-wrap">
              <button
                className="icon-button notification"
                aria-label="Review notifications"
                onClick={() => setBell(!bell)}
              >
                <Bell size={18} />
                {stats.flagged > 0 && !currentReviewed && <i />}
              </button>
              {bell && (
                <div className="notification-popover">
                  <b>Review queue</b>
                  <p>
                    {stats.flagged
                      ? `${stats.flagged} movement observations are outside the selected reference band.`
                      : "No observations flagged by the current rules."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      go("overview");
                    }}
                  >
                    Open profile <ArrowRight size={14} />
                  </button>
                  <small>
                    Rules are experimental; clinical review required.
                  </small>
                </div>
              )}
            </div>
            <div className="avatar top-avatar">ST</div>
          </div>
        </header>
        <main>
          <div className="workspace-toolbar">
            <div className="role-switch"><span>{user.role === "doctor" ? "Ground team · Doctor account" : "Astronaut account"}</span></div>
            <span className={"data-indicator " + (!isDemo ? "imported" : "")}>
              <span className="dot" />
              {dataLabel} <span className="toolbar-divider">|</span>{" "}
              {t("No live telemetry", "لا توجد بيانات حية")}
            </span>
          </div>
          {role === "astronaut" && page === "overview" ? (
            <CrewHome
              {...{
                person,
                stats,
                t,
                approved,
                done,
                setDone,
                personID,
                notes,
                go,
              }}
            />
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">HUMAN HEALTH. BEYOND EARTH.</div>
                      <h1>
                        {t(
                          "A healthier journey, together.",
                          "رحلة أكثر صحة، معًا.",
                        )}
                      </h1>
                      <p>
                        {t(
                          "A connected view of movement, physiology, and the person behind the mission.",
                          "رؤية مترابطة للحركة والمؤشرات الحيوية وصحة رائد الفضاء.",
                        )}
                      </p>
                    </div>
                    <button className="button secondary" onClick={exportReport}>
                      <Download size={15} />
                      {t("Export report", "تصدير التقرير")}
                    </button>
                  </div>
                  <section className="profile-strip">
                    <div className="profile-person">
                      <div
                        className="avatar profile-avatar"
                        style={{ background: person.color }}
                      >
                        {person.initials}
                      </div>
                      <div>
                        <select
                          aria-label="Choose astronaut"
                          className="profile-select"
                          value={personID}
                          onChange={(e) => setPersonID(e.target.value)}
                        >
                          {crew.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <p>
                          {person.role} <span>·</span> {person.id}{" "}
                          <span>·</span> {t("Fictional profile", "ملف افتراضي")}
                        </p>
                      </div>
                    </div>
                    <div className="profile-details">
                      <div>
                        <span>MISSION PHASE</span>
                        <b>
                          <span className="dot" />
                          {rows.at(-1)?.phase || "No observations"}
                        </b>
                      </div>
                      <div>
                        <span>LAST OBSERVATION</span>
                        <b>
                          {rows.at(-1)?.timestamp?.slice(11, 16) || "—"}{" "}
                          <small>UTC</small>
                        </b>
                      </div>
                      <div className="profile-status">
                        <ShieldCheck size={16} />
                        {t("Review workspace", "مساحة المراجعة")}
                      </div>
                    </div>
                  </section>
                  <div className="metric-grid">
                    <Metric
                      title={t("Within reference band", "ضمن نطاق المرجع")}
                      value={stats.within ?? "—"}
                      unit="%"
                      icon={Footprints}
                      tag={`${stats.usable - stats.flagged} / ${stats.usable} observations`}
                      caption={t(
                        "Movement proxy · not a health score",
                        "مؤشر حركة · ليس تقييمًا للصحة",
                      )}
                      spark={[2, 3, 2, 4, 3, 5, 4, 4, 5, 6]}
                    />
                    <Metric
                      title={t("Mean heart rate", "متوسط نبض القلب")}
                      value={stats.avgHR ?? "—"}
                      unit="bpm"
                      icon={HeartPulse}
                      tag={
                        isDemo
                          ? "Simulated wearable data"
                          : "Available imported samples"
                      }
                      caption={t(
                        "Activity-dependent · review context",
                        "يعتمد على النشاط وسياقه",
                      )}
                      spark={[4, 4, 3, 7, 2, 5, 4, 8, 4, 4]}
                    />
                    <Metric
                      title={t("Movement observations", "قياسات الحركة")}
                      value={stats.total}
                      unit=""
                      icon={ScanIcon}
                      tag={`${stats.coverage}% usable for comparison`}
                      caption={t(
                        "Selected observation window",
                        "خلال الفترة المختارة",
                      )}
                      spark={[1, 2, 2, 3, 3, 5, 4, 5, 6, 7]}
                    />
                    <Metric
                      title={t("Flagged for review", "قياسات تحتاج مراجعة")}
                      value={stats.flagged}
                      unit=""
                      icon={Target}
                      tag={
                        currentReviewed
                          ? "Clinician reviewed"
                          : "Reference deviations"
                      }
                      caption={t(
                        "Experimental rule · not a diagnosis",
                        "قاعدة تجريبية · ليست تشخيصًا",
                      )}
                      amber
                      spark={[5, 5, 4, 5, 3, 3, 2, 3, 2, 2]}
                    />
                  </div>
                  <div className="overview-grid">
                    <section className="card movement-card">
                      <div className="section-top">
                        <div>
                          <h3>{t("Movement intelligence", "تحليل الحركة")}</h3>
                          <p>
                            {t(
                              "Personal reference. Task-aware interpretation.",
                              "مرجع شخصي وتفسير بحسب المهمة.",
                            )}
                          </p>
                        </div>
                        <select
                          className="small-select"
                          aria-label="Observation time window"
                          value={range}
                          onChange={(e) => setRange(e.target.value)}
                        >
                          <option value="4">Last 4 hours</option>
                          <option value="2">Last 2 hours</option>
                          <option value="1">Last hour</option>
                        </select>
                      </div>
                      <div className="movement-chart-heading">
                        <div>
                          <span className="chart-kicker">2D HIP ANGLE</span>
                          <b>
                            {stats.maxDeviation ?? "—"}°{" "}
                            <small>maximum reference deviation</small>
                          </b>
                        </div>
                        <div className="chart-legend">
                          <span>
                            <i />
                            Observed
                          </span>
                          <span>
                            <i className="dash" />
                            Reference
                          </span>
                        </div>
                      </div>
                      <LineChart
                        rows={rows}
                        deviation={deviation}
                        minConfidence={minConfidence}
                      />
                      <div className="chart-footer">
                        <span>
                          <span className="orange-dot" /> {stats.flagged}{" "}
                          observations to review
                        </span>
                        <button
                          className="text-button"
                          onClick={() => go("movement")}
                        >
                          Open movement lab <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </section>
                    <section className="body-card">
                      <div className="section-top">
                        <div>
                          <div className="eyebrow">MOVEMENT MAP</div>
                          <h3>{t("The bigger picture.", "الصورة الكاملة.")}</h3>
                        </div>
                        <span className="pill dark">ILLUSTRATION</span>
                      </div>
                      <BodyFigure />
                      <div className="body-bottom">
                        <span>
                          <i className="orange-dot" /> Hip-angle proxy
                        </span>
                        <b>
                          {stats.avgConfidence ?? "—"}%
                          <small> mean landmark confidence</small>
                        </b>
                      </div>
                    </section>
                    <section className="card review-card">
                      <div className="section-top">
                        <div>
                          <h3>
                            {t(
                              "An observation worth a closer look",
                              "ملاحظة تستحق المراجعة",
                            )}
                          </h3>
                          <p>
                            {t(
                              "Evidence you can inspect. Decisions stay with your team.",
                              "أدلة قابلة للفحص وقرارات بيد الفريق الطبي.",
                            )}
                          </p>
                        </div>
                        <span
                          className={
                            "pill " + (currentReviewed ? "green" : "amber")
                          }
                        >
                          {currentReviewed ? "Reviewed" : "Needs review"}
                        </span>
                      </div>
                      <div className="review-observation">
                        <div className="observation-icon">
                          <Activity size={22} />
                        </div>
                        <div>
                          <h4>
                            {stats.flagged
                              ? "Repeated departure from task reference"
                              : "No departures under current rules"}
                          </h4>
                          <p>
                            {stats.flagged
                              ? `${stats.flagged} high-confidence observations differ by more than ${deviation}° from the supplied task reference. Check restraints, camera perspective, and task demands before interpreting.`
                              : "This does not establish safety. Check data coverage and whether the reference matches the task and gravity environment."}
                          </p>
                          <div className="tiny-tags">
                            <span>
                              {isDemo
                                ? "SIMULATED CAMERA + IMU"
                                : "SESSION OBSERVATIONS"}
                            </span>
                            <span>
                              CONFIDENCE ≥ {Math.round(minConfidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="review-actions">
                        <span>
                          <Info size={14} /> {stats.excluded} observations
                          excluded from comparison
                        </span>
                        <button
                          className="button secondary small-button"
                          onClick={() => setModal("review")}
                        >
                          {t("Review evidence", "مراجعة الأدلة")}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </section>
                    <section className="card sources-mini">
                      <div className="section-top">
                        <h3>{t("A connected perspective", "رؤية مترابطة")}</h3>
                        <button
                          className="icon-button"
                          aria-label="Open data connections"
                          onClick={() => go("sources")}
                        >
                          <ArrowUpRight size={17} />
                        </button>
                      </div>
                      {[
                        [Video, "Cabin cameras", "Movement landmarks"],
                        [Watch, "Wearable sensors", "Heart rate · motion"],
                        [Globe2, "Earth baseline", "Pre-flight assessments"],
                      ].map(([I, n, d]) => (
                        <div className="source-line" key={n}>
                          <span className="source-mini-icon">
                            <I size={17} />
                          </span>
                          <div>
                            <b>{n}</b>
                            <span>{d}</span>
                          </div>
                          <span className="source-state">
                            {isDemo ||
                            allRows.every((r) => r.source === "demo-fused")
                              ? "Demo"
                              : n === "Cabin cameras"
                                ? allRows.some(
                                    (r) => r.source === "local-camera-pose",
                                  )
                                  ? "Local"
                                  : "Imported"
                                : n === "Wearable sensors"
                                  ? allRows.some((r) =>
                                      Number.isFinite(r.heart_rate),
                                    )
                                    ? "Imported"
                                    : "No data"
                                  : measurements[personID]
                                    ? "Manual"
                                    : "Demo"}
                          </span>
                        </div>
                      ))}
                      <button
                        className="text-button"
                        onClick={() => setModal("import")}
                      >
                        <Plus size={14} />{" "}
                        {t("Import a data source", "استيراد مصدر بيانات")}
                      </button>
                    </section>
                  </div>
                  <section className="insight-banner">
                    <div className="insight-icon">
                      <FlaskConical size={22} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        FROM OBSERVATIONS TO BETTER DESIGN
                      </span>
                      <h3>
                        {t(
                          "What if the workspace adapted to the astronaut?",
                          "ماذا لو تكيّفت بيئة العمل مع رائد الفضاء؟",
                        )}
                      </h3>
                      <p>
                        {t(
                          "Explore research hypotheses grounded in movement patterns and NASA human-system standards.",
                          "استكشف فرضيات بحثية مرتبطة بالحركة ومعايير ناسا للعوامل البشرية.",
                        )}
                      </p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => go("research")}
                    >
                      {t("Explore insights", "استكشاف النتائج")}
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                </>
              )}
              {page === "backend" && <BackendSettings />}
              {page === "chatbot" && <ChatbotPage />}
              {page === "movement" && (
                <MovementLab person={person} onCapture={capture} t={t} />
              )}
              {page === "health" && (
                <>
                  <PageHeading
                    eyebrow="A PERSON, NOT JUST A DATA POINT"
                    title={t(
                      "Longitudinal health record",
                      "السجل الصحي عبر الزمن",
                    )}
                    text={t(
                      "Ground assessments and in-flight observations, with clear provenance.",
                      "قياسات أرضية وبيانات أثناء الرحلة مع توضيح المصدر.",
                    )}
                  >
                    <button
                      className="button primary"
                      onClick={() => setModal("measurement")}
                    >
                      <Plus size={15} />
                      Add measurement
                    </button>
                  </PageHeading>
                  <PersonSelect {...{ personID, setPersonID }} />
                  <div className="phase-track">
                    {[
                      [
                        "Pre-flight",
                        "Personal baseline",
                        "Earth · clinical assessments",
                      ],
                      [
                        "In-flight",
                        "Track adaptation",
                        "Microgravity · movement & vitals",
                      ],
                      [
                        "Post-flight",
                        "Follow recovery",
                        "Earth · repeat clinical assessments",
                      ],
                    ].map(([p, a, b], i) => (
                      <div key={p} className={i === 1 ? "current" : ""}>
                        <span>0{i + 1}</span>
                        <b>{p}</b>
                        <p>{a}</p>
                        <small>{b}</small>
                      </div>
                    ))}
                  </div>
                  <div className="health-grid">
                    <section className="card">
                      <div className="section-top">
                        <h3>Clinical measurements</h3>
                        <span className="pill light">
                          {measurements[personID]
                            ? "Session records"
                            : "Illustrative records"}
                        </span>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Measurement</th>
                              <th>Value</th>
                              <th>Phase / date</th>
                              <th>Method & source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(measurements[personID] || clinicalDefaults).map(
                              (m) => (
                                <tr key={m.id}>
                                  <td>
                                    <b>{m.name}</b>
                                  </td>
                                  <td className="numeric">
                                    {m.value} <small>{m.unit}</small>
                                  </td>
                                  <td>
                                    {m.phase}
                                    <small className="block">{m.date}</small>
                                  </td>
                                  <td>{m.method}</td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="card-footnote">
                        <Info size={14} /> No in-flight BMD or MRI measurement
                        is inferred from motion data.
                      </div>
                    </section>
                    <section className="card clinician-notes">
                      <div className="section-top">
                        <h3>Clinician notes</h3>
                        <FileText size={17} />
                      </div>
                      <label className="field">
                        For {person.name}
                        <textarea
                          rows="5"
                          value={notes[personID] || ""}
                          onChange={(e) =>
                            setNotes((n) => ({
                              ...n,
                              [personID]: e.target.value,
                            }))
                          }
                          placeholder="Record your interpretation, missing evidence, or follow-up…"
                        />
                      </label>
                      <button
                        className="button primary full"
                        onClick={() => {
                          setApproved((a) => ({ ...a, [personID]: true }));
                          setToast(
                            "Review plan marked approved in this session. Visible in the astronaut workspace.",
                          );
                        }}
                      >
                        <CheckCircle2 size={15} />
                        {approved[personID]
                          ? "Update approved plan"
                          : "Approve review plan"}
                      </button>
                      <p className="muted small">
                        Notes remain in this browser session. No message is
                        sent.
                      </p>
                    </section>
                  </div>
                  <section className="card">
                    <div className="section-top">
                      <div>
                        <h3>Physiology alongside movement</h3>
                        <p>
                          Heart rate is activity-dependent and cannot explain a
                          movement deviation on its own.
                        </p>
                      </div>
                      <HeartPulse size={18} />
                    </div>
                    <LineChart rows={rows} metric="heart_rate" />
                  </section>
                </>
              )}
              {page === "sources" && (
                <>
                  <PageHeading
                    eyebrow="MULTIMODAL, ONE PERSONAL RECORD"
                    title={t(
                      "Bring the signals together.",
                      "اجمع الإشارات في ملف واحد.",
                    )}
                    text={t(
                      "A transparent path from source data to a reviewable observation.",
                      "مسار واضح من مصدر البيانات إلى ملاحظة قابلة للمراجعة.",
                    )}
                  >
                    <button
                      className="button primary"
                      onClick={() => setModal("import")}
                    >
                      <Upload size={15} />
                      Import CSV
                    </button>
                  </PageHeading>
                  <div className="connection-summary">
                    <Database size={24} />
                    <div>
                      <b>
                        {Object.keys(datasets).length
                          ? Object.keys(datasets).length +
                            " profiles with session data"
                          : "Demo workspace is ready"}
                      </b>
                      <p>
                        Spacecraft and suit APIs are not connected. Import
                        timestamped observations or collect local camera
                        estimates.
                      </p>
                    </div>
                    <span className="pill light">
                      <WifiOff size={13} /> No live telemetry
                    </span>
                  </div>
                  <div className="connection-grid">
                    {[
                      [
                        Video,
                        "01",
                        "Cabin video",
                        "Camera landmarks & movement proxies",
                        "Upload a recording in the movement lab. Run experimental single-person pose estimation locally.",
                        "movement",
                        "Open movement lab",
                      ],
                      [
                        Watch,
                        "02",
                        "Suit & wearable data",
                        "IMU · heart rate · confidence",
                        "Import timestamped sensor observations. No spacecraft or wearable integration is active.",
                        "import",
                        "Import observations",
                      ],
                      [
                        Globe2,
                        "03",
                        "Earth & clinical baseline",
                        "Pre-flight · imaging · strength",
                        "Add documented clinical measurements. Use personal, task-specific references for motion comparison.",
                        "health",
                        "Open health record",
                      ],
                    ].map(([I, n, name, sub, text, dest, button]) => (
                      <section className="card connection-card" key={n}>
                        <div className="connection-top">
                          <span className="connection-icon">
                            <I size={25} />
                          </span>
                          <span>/{n}</span>
                        </div>
                        <h2>{name}</h2>
                        <h4>{sub}</h4>
                        <p>{text}</p>
                        <span className="pill light">
                          {n === "01"
                            ? "Local AI available"
                            : n === "02"
                              ? "CSV import available"
                              : "Manual records available"}
                        </span>
                        <button
                          className="button secondary full"
                          onClick={() =>
                            dest === "import" ? setModal("import") : go(dest)
                          }
                        >
                          {button}
                          <ArrowUpRight size={15} />
                        </button>
                      </section>
                    ))}
                  </div>
                  <section className="card">
                    <div className="section-top">
                      <div>
                        <h3>Data contract</h3>
                        <p>
                          Each observation carries an astronaut ID, timestamp,
                          phase, gravity, task, and source.
                        </p>
                      </div>
                      <button
                        className="button secondary small-button"
                        onClick={() =>
                          download(
                            "sol-sample-observations.csv",
                            toCSV(demoRecords()),
                            "text/csv",
                          )
                        }
                      >
                        <Download size={14} />
                        Download sample CSV
                      </button>
                    </div>
                    <div className="contract-grid">
                      <div>
                        <b>01 / Align</b>
                        <p>
                          Provide synchronized timestamps and a reference
                          measured for the same task and gravity. Imported
                          references are user-supplied, not automatically
                          verified.
                        </p>
                      </div>
                      <div>
                        <b>02 / Qualify</b>
                        <p>
                          Reject invalid fields. Exclude missing landmarks,
                          reference angles, or low-confidence observations from
                          movement comparison.
                        </p>
                      </div>
                      <div>
                        <b>03 / Review</b>
                        <p>
                          Flag reference deviations using transparent
                          experimental rules. No causal model, clinical
                          diagnosis, or automated treatment.
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              )}
              {page === "research" && (
                <>
                  <PageHeading
                    eyebrow="EVIDENCE INTO POSSIBILITY"
                    title={t(
                      "Better questions. Better missions.",
                      "أسئلة أفضل، ومهمات أفضل.",
                    )}
                    text={t(
                      "Connect published evidence with reviewable human-factors hypotheses.",
                      "اربط الأدلة المنشورة بفرضيات قابلة للمراجعة عن العوامل البشرية.",
                    )}
                  >
                    <button
                      className="button primary"
                      onClick={() => {
                        setDraft(true);
                        setProposalState("Draft");
                      }}
                    >
                      <Plus size={15} />
                      Generate research draft
                    </button>
                  </PageHeading>
                  <div className="research-callout">
                    <span className="research-orbit">
                      <Orbit size={30} />
                    </span>
                    <div>
                      <span className="eyebrow">
                        BUILDING ON EXISTING KNOWLEDGE
                      </span>
                      <h2>Space already has human-factors standards.</h2>
                      <p>
                        NASA-STD-3001 addresses spaceflight environments. SOL
                        explores evidence-linked adaptations to those standards.
                        A recurring pose is an observation, not proof of harm or
                        a new ergonomic law.
                      </p>
                      <a
                        href="https://www.nasa.gov/reference/nasa-std-3001v2/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Explore NASA-STD-3001 <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </div>
                  {draft && (
                    <section className="card proposal-card">
                      <div className="section-top">
                        <div>
                          <span className="eyebrow">
                            GENERATED FROM CURRENT PROFILE ·{" "}
                            {dataLabel.toUpperCase()}
                          </span>
                          <h3>
                            Could restraint placement influence hip-angle
                            deviation?
                          </h3>
                        </div>
                        <span className="pill amber">
                          {proposalState} · unvalidated
                        </span>
                      </div>
                      <div className="proposal-grid">
                        <div>
                          <span>OBSERVATION</span>
                          <p>
                            {person.name}: {stats.flagged} of {stats.usable}{" "}
                            comparable observations exceed a {deviation}°
                            deviation. {stats.excluded} observations excluded.
                            One individual; this is not a cohort result.
                          </p>
                        </div>
                        <div>
                          <span>TESTABLE HYPOTHESIS</span>
                          <p>
                            Adjusting restraint or workstation position may
                            reduce reference departures during a matched task.
                            Test in a counterbalanced within-subject protocol.
                          </p>
                        </div>
                        <div>
                          <span>VALIDATION NEEDED</span>
                          <p>
                            Calibrated 3D capture, task load, discomfort
                            reports, expert review, gravity-specific references,
                            and sufficient crew-level replication. No causal or
                            clinical conclusion.
                          </p>
                        </div>
                      </div>
                      <div className="review-actions">
                        <span>
                          Reference: NASA-STD-3001 Vol. 2 · physical
                          accommodation
                        </span>
                        <button
                          className="button secondary small-button"
                          onClick={() => {
                            setProposalState("Ready for expert review");
                            setToast(
                              "Draft marked ready for expert review. No external submission was made.",
                            );
                          }}
                        >
                          Mark ready for review
                          <Check size={14} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Download research draft"
                          onClick={() =>
                            download(
                              "sol-research-draft.json",
                              JSON.stringify(
                                {
                                  status: proposalState,
                                  validated: false,
                                  provenance: dataLabel,
                                  profile: personID,
                                  observations: stats,
                                  hypothesis:
                                    "Restraint placement may influence task-specific hip-angle departures.",
                                  standard: studies[5].url,
                                },
                                null,
                                2,
                              ),
                              "application/json",
                            )
                          }
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </section>
                  )}
                  <div className="research-library-top">
                    <div>
                      <h3>
                        Evidence library <span className="count-tag">6</span>
                      </h3>
                      <p>Published studies and official NASA resources.</p>
                    </div>
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        placeholder="Search evidence…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="evidence-tabs">
                    {[
                      ["all", "All evidence"],
                      ["SPINE", "Spine"],
                      ["MUSCLE", "Muscle"],
                      ["BONE", "Bone"],
                      ["NASA", "NASA resources"],
                    ].map(([v, l]) => (
                      <button
                        className={filter === v ? "selected" : ""}
                        key={v}
                        onClick={() => setFilter(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="evidence-grid">
                    {studies
                      .filter(
                        (s) =>
                          (filter === "all" || s.tag.includes(filter)) &&
                          (s.title + " " + s.finding)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((s, i) => (
                        <a
                          className="card evidence-card"
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          key={s.title}
                        >
                          <div className="section-top">
                            <span className="eyebrow">{s.tag}</span>
                            <ArrowUpRight size={18} />
                          </div>
                          <h3>{s.title}</h3>
                          <span className="evidence-meta">
                            {s.year} <i /> {s.n}
                          </span>
                          <p>{s.finding}</p>
                          <div className="evidence-use">
                            <b>Implication for SOL</b>
                            <p>{s.use}</p>
                          </div>
                          <span className="evidence-link">
                            Read source
                            <ArrowUpRight size={13} />
                          </span>
                        </a>
                      ))}
                  </div>
                  {!studies.some(
                    (s) =>
                      (filter === "all" || s.tag.includes(filter)) &&
                      (s.title + " " + s.finding)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  ) && (
                    <div className="empty-state">
                      No evidence matches your search.
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <footer>
            <span>
              <Logo small /> SOL <span className="footer-sep">/</span> Human
              health, beyond Earth.
            </span>
            <span>
              {t(
                "Independent prototype · Not affiliated with or endorsed by NASA",
                "نموذج مستقل · غير تابع لناسا ولا معتمد منها",
              )}
            </span>
          </footer>
        </main>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal + " dialog"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close-modal"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "import" && (
              <>
                <span className="eyebrow">DATA INGESTION</span>
                <h2>Bring your observations.</h2>
                <p>
                  Import a CSV for SOL-01, SOL-02, or SOL-03. Imported
                  observations replace that profile’s demonstration movement
                  dataset for this session.
                </p>
                <label className="upload-drop">
                  <Upload size={30} />
                  <b>Choose a CSV file</b>
                  <span>Up to 5 MB · 10,000 observations</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={importFile}
                  />
                </label>
                {importError && (
                  <div className="message error" role="alert">
                    {importError}
                  </div>
                )}
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      "sol-sample-observations.csv",
                      toCSV(demoRecords()),
                      "text/csv",
                    )
                  }
                >
                  <Download size={14} />
                  Download correctly formatted sample
                </button>
                <div className="schema-note">
                  <b>Required</b>
                  <code>
                    astronaut_id, timestamp, phase, gravity, task, source
                  </code>
                  <b>Optional measurements</b>
                  <code>
                    hip_angle_deg, baseline_angle_deg, heart_rate, confidence
                  </code>
                  <p>
                    Use ISO 8601 timestamps with timezone. Angles: 0–180°.
                    Confidence: 0–1. Reference angles must match the task and
                    gravity. Blank measurements stay missing. Data is held in
                    memory and cleared on reload.
                  </p>
                </div>
              </>
            )}
            {modal === "settings" && (
              <>
                <span className="eyebrow">TRANSPARENT RULES</span>
                <h2>Analysis settings</h2>
                <p>
                  These are experimental review thresholds, not validated safety
                  limits. Changing a threshold recomputes the dashboard.
                </p>
                <label className="field">
                  Reference-angle deviation <b>{deviation}°</b>
                  <input
                    type="range"
                    min="5"
                    max="45"
                    value={deviation}
                    onChange={(e) => setDeviation(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Minimum landmark confidence{" "}
                  <b>{Math.round(minConfidence * 100)}%</b>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={Math.round(minConfidence * 100)}
                    onChange={(e) =>
                      setMinConfidence(Number(e.target.value) / 100)
                    }
                  />
                </label>
                <div className="message info">
                  <Info size={18} />
                  <p>
                    The engine compares each observation with its supplied
                    reference. It does not apply an Earth posture standard to
                    microgravity, infer tissue health, or estimate injury
                    probability.
                  </p>
                </div>
                <button
                  className="button primary full"
                  onClick={() => {
                    setReviewed({});
                    setModal(null);
                    setToast("Rules updated and observations re-analyzed.");
                  }}
                >
                  Apply & re-analyze
                </button>
              </>
            )}
            {modal === "review" && (
              <>
                <span className="eyebrow">EVIDENCE REVIEW · {person.id}</span>
                <h2>Look beyond the angle.</h2>
                <p>
                  {stats.flagged} observations exceed the reference band.
                  Confirm task, gravity, restraint setup, and video quality
                  before interpreting.
                </p>
                <div className="table-scroll evidence-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Time (UTC)</th>
                        <th>Angle / ref.</th>
                        <th>Confidence</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.flaggedRows.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          <td>{r.timestamp.slice(11, 19)}</td>
                          <td>
                            {r.hip_angle_deg}° / {r.baseline_angle_deg}°
                          </td>
                          <td>{Math.round(r.confidence * 100)}%</td>
                          <td>{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!stats.flagged && (
                    <p className="muted">
                      No observations flagged by the selected rule.
                    </p>
                  )}
                </div>
                <label className="field">
                  Review note
                  <textarea
                    rows="3"
                    value={notes[personID] || ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [personID]: e.target.value }))
                    }
                    placeholder="What additional context is needed?"
                  />
                </label>
                <button
                  className="button primary full"
                  onClick={() => {
                    setReviewed((r) => ({ ...r, [personID]: true }));
                    setModal(null);
                    setToast(
                      "Evidence marked reviewed. This does not establish clinical safety.",
                    );
                  }}
                >
                  <CheckCircle2 size={15} />
                  Mark evidence reviewed
                </button>
              </>
            )}
            {modal === "measurement" && (
              <MeasurementForm
                person={person}
                onSave={(m) => {
                  setMeasurements((old) => ({
                    ...old,
                    [personID]: [
                      ...(old[personID] || []),
                      { ...m, id: crypto.randomUUID() },
                    ],
                  }));
                  setModal(null);
                  setToast(
                    "Measurement added. Click Save changes to store it in the database.",
                  );
                }}
              />
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function ScanIcon(props) {
  return <Activity {...props} />;
}
function Metric({
  title,
  value,
  unit,
  icon: Icon,
  tag,
  caption,
  spark,
  amber = false,
}) {
  return (
    <section className={"metric-card " + (amber ? "amber-metric" : "")}>
      <div className="metric-title">
        <span>{title}</span>
        <Icon size={17} />
      </div>
      <div className="metric-number">
        <b>{value}</b>
        <span>{unit}</span>
        <svg viewBox="0 0 80 32" aria-hidden="true">
          <polyline
            points={spark.map((v, i) => `${i * 8.5},${31 - v * 3}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="metric-tag">
        {amber ? <span className="orange-dot" /> : <span className="dot" />}
        {tag}
      </div>
      <p>{caption}</p>
    </section>
  );
}
function PageHeading({ eyebrow, title, text, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
function PersonSelect({ personID, setPersonID }) {
  const { astronaut_ids } = useBackend();
  const crew = allCrew.filter(p => astronaut_ids.includes(p.id));
  return (
    <div className="record-person">
      <UserRound size={17} />
      <select
        aria-label="Select astronaut for record"
        value={personID}
        onChange={(e) => setPersonID(e.target.value)}
      >
        {crew.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.id}
          </option>
        ))}
      </select>
      <span className="pill light">Fictional profiles</span>
    </div>
  );
}
function MeasurementForm({ person, onSave }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave(Object.fromEntries(f));
      }}
    >
      <span className="eyebrow">CLINICAL RECORD · {person.id}</span>
      <h2>Add a documented measurement</h2>
      <p>
        Enter a recorded measurement and its source. SOL does not infer these
        values from camera footage.
      </p>
      <label className="field">
        Measurement
        <input
          required
          name="name"
          placeholder="e.g. Femoral neck BMD"
          maxLength="100"
        />
      </label>
      <div className="form-row">
        <label className="field">
          Value
          <input required type="number" step="any" name="value" />
        </label>
        <label className="field">
          Unit
          <input required name="unit" placeholder="g/cm²" maxLength="30" />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          Phase
          <select name="phase">
            <option>Pre-flight</option>
            <option>In-flight</option>
            <option>Post-flight</option>
          </select>
        </label>
        <label className="field">
          Date
          <input required name="date" type="date" />
        </label>
      </div>
      <label className="field">
        Method / source
        <input
          required
          name="method"
          placeholder="e.g. DXA · report ID"
          maxLength="150"
        />
      </label>
      <button className="button primary full" type="submit">
        Add to {person.name}'s record
        <Plus size={15} />
      </button>
    </form>
  );
}
function CrewHome({
  person,
  stats,
  t,
  approved,
  done,
  setDone,
  personID,
  notes,
  go,
}) {
  const tasks = [
    [
      "context",
      "Review your workstation setup",
      "Before your next task, check your restraint and equipment position with your crew medical officer.",
    ],
    [
      "plan",
      "Follow your assigned exercise plan",
      "Use the mission-approved protocol. SOL does not change your exercise load or prescribe a new routine.",
    ],
    [
      "checkin",
      "Record how you feel",
      "Discuss new pain or discomfort with your crew medical officer; do not rely on a camera estimate.",
    ],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR DAILY CHECK-IN</div>
          <h1>
            {t(
              "Hello, " + person.name.split(" ")[0] + ". How are you feeling?",
              "أهلًا " + person.name.split(" ")[0] + "، كيف تشعر اليوم؟",
            )}
          </h1>
          <p>
            {t(
              "A little awareness goes a long way. Let’s take care of your next move.",
              "الانتباه لحركتك خطوة نحو رحلة أكثر صحة.",
            )}
          </p>
        </div>
        <span className="pill light">Mission day {person.day}</span>
      </div>
      <div className="crew-hero">
        <div>
          <span className="pill dark">
            <HeartPulse size={14} /> YOUR MOVEMENT, IN CONTEXT
          </span>
          <h2>
            {t(
              "Small adjustments.\nA stronger journey.",
              "تعديلات بسيطة.\nرحلة أفضل.",
            )}
          </h2>
          <p>
            {stats.flagged
              ? `${stats.flagged} observations differ from your task reference. This is a prompt to review your setup with the medical team, not a diagnosis.`
              : "Your selected observations show no reference departures under current rules. Continue following the crew-approved plan."}
          </p>
          <button className="button cream" onClick={() => go("health")}>
            View my health record
            <ArrowUpRight size={15} />
          </button>
        </div>
        <BodyFigure />
      </div>
      <div className="crew-section-heading">
        <h2>{t("Focus on these today", "خطوات لليوم")}</h2>
        <span className={"pill " + (approved[personID] ? "green" : "light")}>
          {approved[personID]
            ? "Review plan marked approved"
            : "General reminders · pending clinician review"}
        </span>
      </div>
      <div className="crew-tasks">
        {tasks.map(([id, title, text], i) => (
          <section
            className={
              "card crew-task " + (done[personID + id] ? "complete" : "")
            }
            key={id}
          >
            <span className="task-number">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
            <button
              className="button secondary full"
              onClick={() =>
                setDone((d) => ({ ...d, [personID + id]: !d[personID + id] }))
              }
            >
              {done[personID + id] ? (
                <CheckCircle2 size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              {done[personID + id] ? "Done for today" : "Mark as done"}
            </button>
          </section>
        ))}
      </div>
      {notes[personID] && (
        <section className="card crew-note">
          <Stethoscope size={20} />
          <div>
            <h3>A note from your ground team</h3>
            <p>{notes[personID]}</p>
          </div>
        </section>
      )}
      <div className="message info">
        <Info size={18} />
        <p>
          Movement depends on task and gravity. A floating or flexed posture is
          not automatically wrong. Keep to your assigned protocol and ask your
          crew medical officer about repeated discomfort.
        </p>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<BackendGate><App /></BackendGate>);
