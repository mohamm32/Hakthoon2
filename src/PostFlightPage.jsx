import React, { useState } from "react";

const METRICS = [
  { key: "movement", label: "Movement task time", unit: "s" },
  { key: "balance", label: "Balance sway", unit: "mm" },
  { key: "coordination", label: "Coordination errors", unit: "errors" },
  { key: "reaction", label: "Reaction time", unit: "ms" },
];

const EMPTY = {
  astronaut: "",
  landingDate: "",
  assessmentDate: "",
  protocol: "",
  baseline: {},
  current: {},
  symptoms: "",
  notes: "",
};

const STORAGE_KEY = "sol-post-flight-assessment-v1";

export default function PostFlightPage() {
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved
        ? {
            ...EMPTY,
            ...saved,
            baseline: saved.baseline || {},
            current: saved.current || {},
          }
        : { ...EMPTY, baseline: {}, current: {} };
    } catch {
      return { ...EMPTY, baseline: {}, current: {} };
    }
  });

  const [message, setMessage] = useState("");

  function update(name, value) {
    setForm((previous) => ({ ...previous, [name]: value }));
    setMessage("");
  }

  function updateMetric(group, key, value) {
    setForm((previous) => ({
      ...previous,
      [group]: { ...previous[group], [key]: value },
    }));
    setMessage("");
  }

  function numberOrNull(value) {
    if (value === "" || value === undefined || value === null) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function save(event) {
    event.preventDefault();

    if (form.assessmentDate < form.landingDate) {
      setMessage("Assessment date cannot be before landing.");
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      setMessage("Saved in this browser.");
    } catch {
      setMessage("Could not save. Browser storage may be unavailable.");
    }
  }

  function exportRecord() {
    const file = new Blob(
      [
        JSON.stringify(
          {
            ...form,
            exportedAt: new Date().toISOString(),
            notice:
              "Clinician-entered results. Not an automated diagnosis.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "SOL-post-flight-assessment.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const daysAfterLanding =
    form.landingDate && form.assessmentDate
      ? Math.round(
          (Date.parse(form.assessmentDate + "T00:00:00Z") -
            Date.parse(form.landingDate + "T00:00:00Z")) /
            86400000,
        )
      : null;

  return (
    <section className="postflight-page" dir="ltr" lang="en">
      <style>{`
        .postflight-page {
          max-width: 1100px;
          margin: auto;
          padding: 28px;
          background: #f5f7f1;
          color: #244334;
          font-family: Arial, sans-serif;
          border-radius: 16px;
        }
        .postflight-page * { box-sizing: border-box; }
        .postflight-page h1 { margin: 8px 0; font-size: 32px; }
        .postflight-page h2 { margin: 0 0 16px; font-size: 20px; }
        .postflight-page p { line-height: 1.7; color: #607363; }
        .postflight-page .eyebrow {
          font-size: 11px;
          letter-spacing: 2px;
          color: #718760;
        }
        .postflight-page .notice {
          padding: 15px;
          margin: 20px 0;
          background: #e8efdf;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.7;
        }
        .postflight-page .card {
          padding: 22px;
          margin-top: 18px;
          background: white;
          border: 1px solid #dce5d5;
          border-radius: 12px;
        }
        .postflight-page .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .postflight-page label {
          display: grid;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 14px;
        }
        .postflight-page input,
        .postflight-page textarea {
          width: 100%;
          min-width: 0;
          padding: 12px;
          border: 1px solid #cedcc5;
          border-radius: 7px;
          font: inherit;
          background: white;
          color: #244334;
        }
        .postflight-page textarea { resize: vertical; }
        .postflight-page .table-wrap { overflow-x: auto; }
        .postflight-page table {
          width: 100%;
          min-width: 650px;
          border-collapse: collapse;
          font-size: 13px;
        }
        .postflight-page th,
        .postflight-page td {
          text-align: left;
          padding: 14px 10px;
          border-bottom: 1px solid #e4eadf;
        }
        .postflight-page th { color: #6e825f; }
        .postflight-page table input { max-width: 130px; }
        .postflight-page .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 20px;
        }
        .postflight-page button {
          padding: 12px 18px;
          background: #285c42;
          color: white;
          border: 0;
          border-radius: 8px;
          font: inherit;
          cursor: pointer;
        }
        .postflight-page .secondary {
          background: white;
          color: #285c42;
          border: 1px solid #cbdac2;
        }
        .postflight-page :focus-visible {
          outline: 3px solid #91b67c;
          outline-offset: 3px;
        }
        @media (max-width: 700px) {
          .postflight-page { padding: 16px; }
          .postflight-page .grid { grid-template-columns: 1fr; }
          .postflight-page h1 { font-size: 27px; }
        }
      `}</style>

      <span className="eyebrow">SOL · POST-FLIGHT ASSESSMENT</span>
      <h1>Recovery after spaceflight</h1>
      <p>
        Record ground assessments after landing and compare them with
        the astronaut’s personal pre-flight baseline.
      </p>

      <div className="notice">
        Balance, movement, and coordination may change after spaceflight.
        Effects vary between individuals. Reaction time is recorded
        separately and is not a direct measure of concentration.
        Enter documented test results; this page does not infer them
        from video.
      </div>

      <form onSubmit={save}>
        <section className="card">
          <h2>Astronaut and assessment</h2>

          <div className="grid">
            <label>
              Astronaut name / ID
              <input
                required
                value={form.astronaut}
                onChange={(e) => update("astronaut", e.target.value)}
                placeholder="e.g. SOL-01"
              />
            </label>

            <label>
              Test protocol / method
              <input
                required
                value={form.protocol}
                onChange={(e) => update("protocol", e.target.value)}
                placeholder="Task, equipment, and conditions"
              />
            </label>

            <label>
              Landing date
              <input
                required
                type="date"
                value={form.landingDate}
                onChange={(e) => update("landingDate", e.target.value)}
              />
            </label>

            <label>
              Post-flight assessment date
              <input
                required
                type="date"
                min={form.landingDate || undefined}
                value={form.assessmentDate}
                onChange={(e) =>
                  update("assessmentDate", e.target.value)
                }
              />
            </label>
          </div>

          {daysAfterLanding !== null && daysAfterLanding >= 0 && (
            <p>
              Assessment: <strong>Day +{daysAfterLanding}</strong> after
              landing.
            </p>
          )}
        </section>

        <section className="card">
          <h2>Performance comparison</h2>
          <p>
            Use the same ground protocol, equipment, and units before
            and after flight. Leave unavailable results blank.
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Pre-flight baseline</th>
                  <th>Post-flight result</th>
                  <th>Difference</th>
                </tr>
              </thead>

              <tbody>
                {METRICS.map((metric) => {
                  const before = numberOrNull(
                    form.baseline[metric.key],
                  );
                  const after = numberOrNull(form.current[metric.key]);
                  const difference =
                    before !== null && after !== null
                      ? after - before
                      : null;

                  return (
                    <tr key={metric.key}>
                      <td>
                        {metric.label} ({metric.unit})
                      </td>
                      <td>
                        <input
                          aria-label={`${metric.label} baseline`}
                          type="number"
                          min={
                            metric.key === "movement" ||
                            metric.key === "reaction"
                              ? "0.001"
                              : "0"
                          }
                          step={
                            metric.key === "coordination" ? "1" : "any"
                          }
                          value={form.baseline[metric.key] ?? ""}
                          onChange={(e) =>
                            updateMetric(
                              "baseline",
                              metric.key,
                              e.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`${metric.label} post-flight`}
                          type="number"
                          min={
                            metric.key === "movement" ||
                            metric.key === "reaction"
                              ? "0.001"
                              : "0"
                          }
                          step={
                            metric.key === "coordination" ? "1" : "any"
                          }
                          value={form.current[metric.key] ?? ""}
                          onChange={(e) =>
                            updateMetric(
                              "current",
                              metric.key,
                              e.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        {difference === null
                          ? "—"
                          : `${difference > 0 ? "+" : ""}${Number(
                              difference.toFixed(2),
                            )} ${metric.unit}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p>
            A positive difference means more time, sway, or errors in
            this test. It does not independently establish impairment
            or determine whether recovery is complete.
          </p>
        </section>

        <section className="card">
          <h2>Post-flight observations</h2>

          <label>
            Reported symptoms / assessment findings
            <textarea
              rows={4}
              value={form.symptoms}
              onChange={(e) => update("symptoms", e.target.value)}
              placeholder="Record assessed findings, such as unsteadiness, motion sensitivity, coordination difficulty, or fatigue. Do not assume symptoms are present."
            />
          </label>

          <label>
            Medical team’s recovery and follow-up notes
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Document the clinical team's plan and follow-up observations."
            />
          </label>

          <p>
            Rehabilitation decisions belong to the medical team.
            This page records results and does not prescribe treatment.
          </p>
        </section>

        <div className="actions">
          <button type="submit">Save assessment</button>
          <button
            type="button"
            className="secondary"
            onClick={exportRecord}
          >
            Export JSON
          </button>
        </div>

        <p role="status">{message}</p>
      </form>
    </section>
  );
}