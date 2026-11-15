import React, { useEffect, useRef, useState } from "react";
import {
  Video,
  Camera,
  Upload,
  Play,
  Square,
  ScanLine,
  CheckCircle2,
  Info,
  Download,
} from "lucide-react";
import { BodyFigure } from "./Visuals";
import { hipAngle, toCSV } from "./engine.mjs";
import { createLocalPoseModel } from "./pose-model.mjs";

export function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function MovementLab({ person, onCapture, t }) {
 
  const video = useRef(null);
  const canvas = useRef(null);
  const stream = useRef(null);
  const model = useRef(null);
  const frame = useRef(null);
  const running = useRef(false);
  const samples = useRef([]);
  const lastSample = useRef(0);
  const baseline = useRef(null);
  const current = useRef(null);
  const objectURL = useRef(null);

  const [source, setSource] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [angle, setAngle] = useState(null);
  const [conf, setConf] = useState(null);
  const [count, setCount] = useState(0);
  const [base, setBase] = useState(null);
  const [task, setTask] = useState("restrained-work");
  const [gravity, setGravity] = useState("earth");
  const [saved, setSaved] = useState(false);

  const closeCamera = () => {
    stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    video.current.srcObject = null;
    video.current.removeAttribute("src");
    setSource("");
    setAngle(null);
    setConf(null);
    current.current = null;
  };
  const stop = () => {
    running.current = false;
    clearTimeout(frame.current);
    setStatus("stopped");
  };
  useEffect(
    () => () => {
      running.current = false;
      clearTimeout(frame.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      model.current?.close();
      if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    },
    [],
  );
  useEffect(() => {
    stop();
    samples.current = [];
    setCount(0);
    baseline.current = null;
    setBase(null);
    setSaved(false);
  }, [person.id, task, gravity]);
  async function camera() {
    if (source === "camera") {
      closeCamera();
      return;
    }
    stop();
    current.current = null;
    baseline.current = null;
    setBase(null);
    samples.current = [];
    setCount(0);
    setError("");
    try {
      stream.current?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 960, height: 720 },
        audio: false,
      });
      stream.current = s;
      video.current.srcObject = s;
      setSource("camera");
      await video.current.play();
      setStatus("ready");
    } catch (e) {
      setError(
        "Camera unavailable or permission declined. You can upload a video instead.",
      );
    }
  }
  async function file(e) {
    const f = e.target.files[0];
    if (!f) return;
    stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    video.current.srcObject = null;
    if (objectURL.current) URL.revokeObjectURL(objectURL.current);
    objectURL.current = URL.createObjectURL(f);
    video.current.src = objectURL.current;
    video.current.loop = true;
    setSource("video");
    current.current = null;
    setStatus("ready");
    setError("");
    samples.current = [];
    setCount(0);
    baseline.current = null;
    setBase(null);
    setSaved(false);
    try {
      await video.current.play();
    } catch {
      setError("Cannot play this video. Try an MP4 or WebM file.");
    }
  }
  async function start() {
    if (!source) {
      setError("Choose a video or enable your camera first.");
      return;
    }
    setError("");
    setStatus("loading");
    try {
      if (!model.current) model.current = await createLocalPoseModel();
      if (!video.current.videoWidth)
        throw new Error("Video is not ready. Wait a moment and try again.");
      await video.current.play();
      running.current = true;
      setStatus("analyzing");
      let lastTime = -1;
      const loop = async () => {
        if (!running.current) return;
        const v = video.current;
        try {
          if (v.readyState >= 2 && v.currentTime !== lastTime) {
            lastTime = v.currentTime;
            const result = await model.current.detectForVideo(
              v,
              performance.now(),
            );
            if (!running.current || !canvas.current) return;
            const c = canvas.current;
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext("2d");
            ctx.clearRect(0, 0, c.width, c.height);
            const pts = result.landmarks?.[0];
            if (pts) {
              const measurement = hipAngle(pts, c.width, c.height);
              current.current = measurement;
              ctx.strokeStyle = "#a3edc6";
              ctx.lineWidth = 3;
              for (const [a, b] of [
                [11, 12],
                [11, 23],
                [12, 24],
                [23, 24],
                [11, 13],
                [13, 15],
                [12, 14],
                [14, 16],
                [23, 25],
                [25, 27],
                [24, 26],
                [26, 28],
              ]) {
                if (pts[a].visibility > 0.6 && pts[b].visibility > 0.6) {
                  ctx.beginPath();
                  ctx.moveTo(pts[a].x * c.width, pts[a].y * c.height);
                  ctx.lineTo(pts[b].x * c.width, pts[b].y * c.height);
                  ctx.stroke();
                }
              }
              for (const p of pts) {
                if (p.visibility > 0.6) {
                  ctx.beginPath();
                  ctx.arc(p.x * c.width, p.y * c.height, 4, 0, Math.PI * 2);
                  ctx.fillStyle = "#e0ffed";
                  ctx.fill();
                }
              }
              if (performance.now() - lastSample.current > 1000) {
                lastSample.current = performance.now();
                setAngle(measurement ? Math.round(measurement.angle) : null);
                setConf(
                  measurement ? Math.round(measurement.confidence * 100) : null,
                );
                if (measurement && baseline.current !== null) {
                  samples.current.push({
                    astronaut_id: person.id,
                    timestamp: new Date().toISOString(),
                    phase: gravity === "earth" ? "pre-flight" : "in-flight",
                    gravity,
                    task,
                    source: "local-camera-pose",
                    hip_angle_deg: Math.round(measurement.angle * 10) / 10,
                    baseline_angle_deg: baseline.current,
                    heart_rate: null,
                    confidence: measurement.confidence,
                  });
                  setCount(samples.current.length);
                  setSaved(false);
                }
              }
            } else {
              current.current = null;
              setAngle(null);
              setConf(null);
            }
          }
        } catch (e) {
          running.current = false;
          setStatus("error");
          setError("Pose analysis stopped: " + e.message);
          return;
        }
        frame.current = setTimeout(loop, 250);
      };
      loop();
    } catch (e) {
      setStatus("error");
      setError(
        "Could not start the pose model. " +
          e.message +
          " Model assets require an internet connection.",
      );
    }
  }
  function calibrate() {
    if (!current.current || current.current.confidence < 0.75) {
      setError(
        "Keep shoulder, hip, and knee visible with confidence ≥75% before calibrating.",
      );
      return;
    }
    baseline.current = Math.round(current.current.angle * 10) / 10;
    setBase(baseline.current);
    samples.current = [];
    setCount(0);
    setError("");
    setSaved(false);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">COMPUTER VISION WORKSPACE</div>
          <h1>{t("Movement lab", "مختبر الحركة")}</h1>
          <p>
            {t(
              "Observe movement. Understand the context.",
              "راقب الحركة وافهم سياقها.",
            )}
          </p>
        </div>
        <span className="pill light">
          <ScanLine size={13} /> On-device AI · Experimental
        </span>
      </div>
      <div className="lab-layout">
        <section className="card camera-card">
          <div className="section-top">
            <h3>
              <Video size={17} /> {t("Pose estimation", "تقدير وضعية الجسم")}
            </h3>
            <span
              className={"pill " + (status === "analyzing" ? "green" : "light")}
            >
              <span className="dot" />
              {status === "analyzing"
                ? "Analyzing locally"
                : status === "loading"
                  ? "Loading AI model…"
                  : "No spacecraft connection"}
            </span>
          </div>
          <div className="video-stage">
            <video
              ref={video}
              playsInline
              muted
              className={source ? "" : "hidden"}
              controls={source === "video" && status !== "analyzing"}
            />
            <canvas ref={canvas} />
            {!source && (
              <div className="camera-placeholder">
                <BodyFigure />
                <div>
                  <h3>A closer look at every movement.</h3>
                  <p>
                    Upload a recording or use your camera to estimate a single
                    person’s pose.
                  </p>
                </div>
              </div>
            )}
            <div className="stage-label">
              {source
                ? source.toUpperCase() + " · LOCAL PROCESSING"
                : "NO VIDEO · ILLUSTRATION"}
            </div>
            {source && (
              <div className="pose-readout">
                <b>{angle ?? "—"}°</b>
                <span>2D hip angle · {conf ?? "—"}% visibility</span>
              </div>
            )}
          </div>
          <div className="camera-toolbar">
            <label className="button secondary">
              <Upload size={15} /> Upload video
              <input type="file" accept="video/*" onChange={file} hidden />
            </label>
            <button className="button secondary" onClick={camera}>
              <Camera size={15} />{" "}
              {source === "camera" ? "Disconnect camera" : "Enable camera"}
            </button>
            <button
              className="button primary"
              disabled={status === "loading"}
              onClick={status === "analyzing" ? stop : start}
            >
              {status === "analyzing" ? (
                <Square size={15} />
              ) : (
                <Play size={15} />
              )}{" "}
              {status === "analyzing"
                ? "Stop analysis"
                : status === "loading"
                  ? "Loading…"
                  : "Start AI analysis"}
            </button>
          </div>
          {error && (
            <div className="message error" role="alert">
              {error}
            </div>
          )}
        </section>
        <aside className="lab-side">
          <section className="card">
            <div className="eyebrow">SESSION CONTEXT</div>
            <h3>Context comes first.</h3>
            <label className="field">
              Gravity environment
              <select
                value={gravity}
                onChange={(e) => setGravity(e.target.value)}
              >
                <option value="earth">Earth · 1g</option>
                <option value="microgravity">Microgravity</option>
                <option value="lunar">Lunar gravity</option>
                <option value="mars">Mars gravity</option>
              </select>
            </label>
            <label className="field">
              Task
              <select value={task} onChange={(e) => setTask(e.target.value)}>
                <option value="restrained-work">
                  Restrained workstation task
                </option>
                <option value="exercise">Resistive exercise</option>
                <option value="free-float">Free-floating movement</option>
              </select>
            </label>
            <div className="baseline-box">
              <span>Session reference</span>
              <b>{base ?? "—"}°</b>
              <p>
                Capture a task-specific reference pose. This single-frame
                calibration is experimental.
              </p>
              <button className="button secondary full" onClick={calibrate}>
                <ScanLine size={15} /> Set reference pose
              </button>
            </div>
            <div className="capture-count">
              <span>Collected observations</span>
              <b>{count}</b>
            </div>
            <button
              className="button primary full"
              disabled={!count || saved}
              onClick={() => {
                stop();
                onCapture([...samples.current]);
                setSaved(true);
              }}
            >
              <CheckCircle2 size={15} />
              {saved ? "Added to profile" : "Add to selected profile"}
            </button>
            <button
              className="text-button full"
              disabled={!count}
              onClick={() =>
                download(
                  "sol-pose-observations.csv",
                  toCSV(samples.current),
                  "text/csv",
                )
              }
            >
              <Download size={14} /> Export observations
            </button>
          </section>
        </aside>
      </div>
      <div className="message info">
        <Info size={18} />
        <div>
          <b>What this AI can measure</b>
          <p>
            MediaPipe or MoveNet estimates visible body landmarks locally; video
            is not uploaded. The shoulder–hip–knee angle is a 2D movement proxy,
            not lumbar curvature, load, muscle quality, or bone density.
            Occlusion, foreshortening, clothing, and camera angle affect
            accuracy. The model has not been validated for astronauts, suits, or
            microgravity. Sample rules identify deviations for review, not
            injury or unsafe behavior.
          </p>
        </div>
      </div>
    </>
  );
}
