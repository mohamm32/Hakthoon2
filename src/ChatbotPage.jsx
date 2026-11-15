import { apiFetch } from "./Backend.jsx";
import React, { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  Send,
  Trash2,
  ExternalLink,
  BookOpen,
  LoaderCircle,
} from "lucide-react";

// Curated reference summaries; no model fine-tuning.
const studies = [
  {
    year: "2016",
    tag: "SPINE · MRI",
    title:
      "Lumbar spine paraspinal muscle and intervertebral disc height changes in astronauts",
    n: "6 crew members",
    finding:
      "Lean paraspinal muscle fraction fell from 86% to 72%. Post-flight disc heights were not appreciably different.",
    use: "Track muscle quality separately from spinal dimensions. Camera estimates cannot measure either.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5588025/",
  },
  {
    year: "2022",
    tag: "MUSCLE · MRI",
    title:
      "Change in Lumbar Muscle Size and Composition on MRI with Long-Duration Spaceflight",
    n: "6 crew members",
    finding:
      "Paraspinal cross-sectional area decreased by 9.0% on average, with substantial variation between individuals.",
    use: "Compare each astronaut with their own baseline. Association with exercise does not establish a prescription.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9167780/",
  },
  {
    year: "2023 / 24",
    tag: "BONE · CT",
    title:
      "Changes in Vertebral Bone Density and Paraspinal Muscle Morphology Following Spaceflight and 1 Year Readaptation on Earth",
    n: "17 crew · 15 follow-up",
    finding:
      "Regional vertebral bone loss and changes in muscle morphology persisted into readaptation.",
    use: "Use dated clinical imaging for bone and muscle tissue metrics; never infer bone density from video.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10731107/",
  },
  {
    year: "2023",
    tag: "NASA · SENSORIMOTOR",
    title:
      "Field Assessment of Sensorimotor Function Following Long-Duration Spaceflight",
    n: "19 crew members",
    finding:
      "Early post-flight testing showed slower stabilization and poorer walking performance, with task-dependent recovery.",
    use: "Keep pre-flight and post-flight balance assessments separate from in-flight movement.",
    url: "https://ntrs.nasa.gov/citations/20220016680",
  },
  {
    year: "2024",
    tag: "NASA · MOTION CAPTURE",
    title:
      "Kinematic Sensors Evaluation for Spaceflight Exercise Data Collections",
    n: "Technology evaluation",
    finding:
      "NASA describes marker-based in-flight capture and evaluates camera and wearable approaches for exercise data.",
    use: "Motivates multimodal capture. This prototype’s single-camera pose model is not validated for microgravity.",
    url: "https://ntrs.nasa.gov/citations/20240001089",
  },
  {
    year: "2026",
    tag: "NASA · HUMAN FACTORS",
    title:
      "NASA-STD-3001, Volume 2 — Human Factors, Habitability, and Environmental Health",
    n: "Existing spaceflight standard",
    finding:
      "NASA already defines human-system requirements for spaceflight, including physical capabilities and equipment accommodation.",
    use: "Map research hypotheses to existing standards. Proposed adaptations require expert review and validation.",
    url: "https://www.nasa.gov/reference/nasa-std-3001v2/",
  },
];

// Curated summaries, not a fine-tuned model or the full papers.
const knowledge = [
  {
    id: "spine",
    title: "Spine and back muscles",
    keys: [
      "عمود",
      "فقري",
      "فقرات",
      "ظهر",
      "spine",
      "spinal",
      "paraspinal",
      "disc",
      "ديسك",
      "اقراص",
    ],
    sources: [0, 1],
    answer:
      "Gravity changes the loads on the spine and its stabilizing muscles. In a 2016 study of 6 astronauts, the lean paraspinal muscle fraction fell from 86% to 72% after spaceflight, while post-flight lumbar disc heights did not differ appreciably. These small-group findings do not apply as fixed percentages to every astronaut. These tissue measurements require medical imaging, not an ordinary camera.",
  },
  {
    id: "muscle",
    title: "Muscle changes",
    keys: [
      "عضل",
      "عضلات",
      "muscle",
      "atrophy",
      "ضمور",
      "mri",
      "دهون",
      "تمارين",
      "exercise",
      "ared",
    ],
    sources: [1, 0],
    answer:
      "A 2022 study used MRI before and after spaceflight in 6 astronauts and found an average 9.0% decrease in lumbar paraspinal cross-sectional area, with substantial individual variation. Muscle area, volume, and quality are different measures. An association between training and muscle changes is insufficient to prescribe exercise; follow the approved mission program and consult the specialist.",
  },
  {
    id: "bone",
    title: "Bones and mineral density",
    keys: ["عظم", "عظام", "كثاف", "bone", "bmd", "dxa", "ct", "هشاش"],
    sources: [2],
    answer:
      "The vertebral study included 17 astronauts with CT before and after spaceflight, with 15 followed up about a year later. It found changes in vertebral bone density and incomplete recovery of some measures. BMD can be entered from a DXA or CT report with its date, unit, and measurement site. Body video cannot measure bone density or diagnose osteoporosis.",
  },
  {
    id: "balance",
    title: "Balance after return",
    keys: [
      "توازن",
      "مشي",
      "دهليزي",
      "balance",
      "gait",
      "sensorimotor",
      "عود",
      "post-flight",
    ],
    sources: [3],
    answer:
      "The NASA assessment tested 19 astronauts before and after spaceflight using rising, standing, walking, turning, and obstacle-crossing tasks. Performance temporarily declined after landing, and recovery varied by task. Earth-based balance tests do not automatically transfer to movement in microgravity.",
  },
  {
    id: "camera",
    title: "What can a camera measure?",
    keys: [
      "كاميرا",
      "كاميرات",
      "فيديو",
      "video",
      "camera",
      "pose",
      "mediapipe",
      "movenet",
      "landmark",
      "زاوي",
      "angle",
      "انحناء",
      "انحن",
      "حرك",
      "motion",
    ],
    sources: [4],
    answer:
      "Visible body landmarks, trajectories, and two-dimensional angles can be estimated. This project uses MediaPipe or MoveNet and measures the shoulder–hip–knee angle as a movement indicator, not as a measure of vertebral curvature. Its single-camera model is not validated for astronauts, spacesuits, or microgravity. Bending cannot be judged without load, repetition, task, restraint, and visibility context. NASA sensor evaluations support research into imaging and sensors, but do not validate this prototype.",
  },
  {
    id: "ergonomics",
    title: "Human factors in space",
    keys: [
      "هندسه",
      "عوامل",
      "انساني",
      "بشري",
      "ergonomic",
      "ergonomics",
      "human factors",
      "3001",
      "معايير",
      "قوانين",
      "قانون",
      "workstation",
      "تثبيت",
    ],
    sources: [5],
    answer:
      "NASA-STD-3001 Volume 2 already defines spaceflight human-system requirements. Gravity, tasks, suits, and restraints differ from conditions on Earth; visible bending or floating is not necessarily harmful. The project can propose workstation or restraint adjustments as research hypotheses for testing and review. It does not automatically establish approved standards.",
  },
  {
    id: "baseline",
    title: "Comparing with baseline",
    keys: [
      "baseline",
      "اساس",
      "مرجع",
      "مقارنه",
      "قياسات",
      "قياس",
      "pre-flight",
      "قبل الرحله",
      "قبل الطيران",
      "بعد الرحله",
    ],
    sources: [0, 2, 3],
    answer:
      "Compare each astronaut with their own measurements before, during, and after flight, recording mission phase, gravity, task, measurement method, unit, and timing. Movement baselines must match the task and gravity; a fixed Earth-based threshold should not be applied to movement in space. MRI and DXA are ground-based assessments in this concept, and their values cannot be inferred from video.",
  },
  {
    id: "software",
    title: "Using SOL and data limitations",
    keys: [
      "sol",
      "مشروع",
      "برنامج",
      "سوفتوير",
      "كود",
      "react",
      "csv",
      "استيراد",
      "تنبيه",
      "confidence",
      "ثقه",
      "نبض",
      "heart",
      "مستشعر",
      "sensor",
      "بدله",
      "بدلات",
    ],
    sources: [],
    answer:
      "SOL is a React prototype with illustrative profiles, astronaut and doctor views, CSV import, and local pose analysis. It has no live connection to spacesuits or spacecraft. Its default demonstration rule flags angle differences above 20° when confidence is at least 75%; these are demonstration thresholds, not medical safety limits. Missing data are not converted to zero, and heart rate needs activity context. Entered data are lost on refresh unless a report is exported.",
  },
];

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}
function retrieve(question, history = []) {
  const q = normalize(question);
  const followup =
    /^(ليش|لماذا|وضح|اشرح اكثر|كمل|كيف ذلك|why|explain more|more details)/.test(
      q,
    );
  const prior = followup
    ? [...history].reverse().find((m) => m.role === "user")?.content || ""
    : "";
  const query = q + " " + normalize(prior);
  return knowledge
    .map((item) => ({
      item,
      score: item.keys.reduce(
        (n, k) => n + (query.includes(normalize(k)) ? normalize(k).length : 0),
        0,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.item);
}
function citations(items) {
  return [...new Set(items.flatMap((i) => i.sources))].map((i) => ({
    id: "S" + (i + 1),
    title: studies[i].title,
    url: studies[i].url,
  }));
}
function localAnswer(question, history = []) {
  const q = normalize(question);
  if (/^(مرحبا|اهلا|السلام عليكم|hello|hi)[!؟?.\s]*$/.test(q))
    return {
      text: "Hello! I can explain research on bones, muscles, astronaut movement, camera analysis limitations, and using SOL. Try asking: Can a camera measure bone density?",
      sources: [],
      mode: "local",
    };
  if (/(شخصني|تشخيص|علاج|وجع|الم عندي|ظهري بوجع|diagnos|prescri|pain)/.test(q))
    return {
      text: "I cannot diagnose an injury or prescribe treatment from a conversation or body angle. Back pain or new symptoms need assessment by a doctor or crew medical officer. I can explain general evidence and measurement limitations.",
      sources: [],
      mode: "local",
    };
  const items = retrieve(question, history);
  if (!items.length)
    return {
      text: "The included references do not contain enough information to answer that question. Try astronaut movement, muscles, bone density, balance, cameras, human factors standards, or using SOL. Local mode retrieves selected summaries and does not generate answers beyond them.",
      sources: [],
      mode: "local",
    };
  return {
    text: items.map((i) => i.title + "\n" + i.answer).join("\n\n"),
    sources: citations(items),
    mode: "local",
  };
}

const CHAT_STYLES =
  '.sol-chat{padding:28px;background:#f6f7f3;color:#253a32;border-radius:12px;box-sizing:border-box}.sol-chat *{box-sizing:border-box}.sol-chat button,.sol-chat input,.sol-chat textarea,.sol-chat select{font:inherit}.sol-chat button{cursor:pointer}.sol-chat button:disabled{opacity:.45;cursor:not-allowed}.sol-chat .button{display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d8e1cc;background:#fff;padding:10px 14px;border-radius:6px;color:#4f6e40;font-size:11px}.sol-chat .full{width:100%}.sol-chat .eyebrow{font-size:9px;letter-spacing:1.7px;color:#829575}.sol-chat h1,.sol-chat h2,.sol-chat h3,.sol-chat p{margin:0}.sol-chat h1{font-size:30px}.sol-chat .dot{display:inline-block;width:6px;height:6px;background:#5b8b49;border-radius:50%}.sol-chat button:focus-visible,.sol-chat textarea:focus-visible,.sol-chat select:focus-visible,.sol-chat a:focus-visible{outline:3px solid #9cbd7b;outline-offset:3px}@media(max-width:760px){.sol-chat{padding:16px}}\n.sol-chat {\n  font-family: "DM Sans", "Arial", sans-serif;\n}\n.chat-heading {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  margin: 0 0 25px;\n}\n.chat-heading h1 {\n  font-family: inherit;\n  letter-spacing: 0;\n  margin-top: 8px;\n}\n.chat-heading p {\n  color: #7b8c73;\n  margin-top: 10px;\n  font-size: 12px;\n}\n.chat-orbit {\n  display: grid;\n  place-items: center;\n  background: #e6eddb;\n  border: 1px solid #d7e1ca;\n  border-radius: 50%;\n  width: 59px;\n  height: 59px;\n  color: #527744;\n}\n.chat-layout {\n  display: grid;\n  grid-template-columns: 260px minmax(0, 1fr);\n  gap: 22px;\n}\n.chat-guide {\n  background: #eaf0e0;\n  border: 1px solid #dbe4ce;\n  border-radius: 10px;\n  padding: 24px;\n  align-self: start;\n  color: #5e7950;\n}\n.chat-guide h3 {\n  font-family: inherit;\n  margin: 14px 0 10px;\n}\n.chat-guide > p {\n  font-size: 11px;\n  line-height: 1.9;\n  color: #728666;\n}\n.chat-mode {\n  margin: 25px 0 15px;\n}\n.chat-mode label {\n  font-size: 10px;\n  display: block;\n  margin-bottom: 8px;\n}\n.chat-mode select {\n  width: 100%;\n  padding: 10px 5px;\n  border: 1px solid #cddcbd;\n  border-radius: 5px;\n  background: #f9fbf4;\n  color: #57734a;\n  font-size: 10px;\n}\n.chat-guide .chat-privacy {\n  font-size: 10px;\n}\n.chat-boundary {\n  margin: 18px 0 22px;\n  border-top: 1px solid #d4dfc5;\n  padding-top: 15px;\n  font-size: 10px;\n  line-height: 1.9;\n  color: #839775;\n}\n.chat-window {\n  border: 1px solid #dfe6d7;\n  background: white;\n  border-radius: 10px;\n  overflow: hidden;\n  display: flex;\n  flex-direction: column;\n  height: 660px;\n  min-height: 470px;\n}\n.chat-status {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  background: #fafcf6;\n  padding: 15px 20px;\n  border-bottom: 1px solid #e5eadf;\n  font-size: 10px;\n  color: #6b845c;\n}\n.chat-status small {\n  margin-inline-start: auto;\n  color: #98a38b;\n  font-size: 8px;\n}\n.chat-messages {\n  flex: 1;\n  overflow-y: auto;\n  padding: 24px;\n  scroll-behavior: smooth;\n}\n.chat-welcome {\n  text-align: center;\n  max-width: 450px;\n  margin: 40px auto;\n}\n.chat-welcome > svg {\n  color: #8ba774;\n}\n.chat-welcome h2 {\n  font-family: inherit;\n  font-size: 24px;\n  letter-spacing: 0;\n  margin-top: 15px;\n}\n.chat-welcome p {\n  color: #8d9d7c;\n  font-size: 11px;\n  margin: 14px 0 25px;\n}\n.chat-starters {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 10px;\n}\n.chat-starters button {\n  border: 1px solid #dde6d2;\n  background: #f7faf2;\n  border-radius: 7px;\n  padding: 15px 12px;\n  font-size: 10px;\n  text-align: left;\n  color: #658351;\n  line-height: 1.8;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  justify-content: space-between;\n}\n.chat-starters button:hover {\n  background: #eaf1df;\n}\n.chat-message {\n  border: 1px solid #e1e7d8;\n  background: #f8fbf3;\n  border-radius: 10px;\n  padding: 16px 19px;\n  margin-bottom: 18px;\n  max-width: 96%;\n}\n.chat-message.user {\n  background: #e8eedc;\n  border-color: #dce5cc;\n  margin-inline-start: auto;\n  max-width: 85%;\n  width: fit-content;\n}\n.chat-speaker {\n  display: block;\n  font-size: 8px;\n  letter-spacing: 0.3px;\n  color: #8ea17d;\n  margin-bottom: 10px;\n}\n.chat-text {\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  line-height: 2;\n  font-size: 12px;\n  color: #405939;\n}\n.chat-sources {\n  border-top: 1px solid #dde6d1;\n  margin-top: 15px;\n  padding-top: 12px;\n}\n.chat-sources > b {\n  font-size: 9px;\n  color: #80956b;\n}\n.chat-sources a {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  margin-top: 9px;\n  font-size: 9px;\n  color: #648249;\n  line-height: 1.8;\n}\n.chat-sources a > span:first-child {\n  direction: ltr;\n  background: #e9f0df;\n  padding: 0 4px;\n  border-radius: 3px;\n}\n.chat-sources a:hover {\n  text-decoration: underline;\n}\n.chat-composer {\n  display: flex;\n  gap: 12px;\n  padding: 15px 18px 8px;\n  border-top: 1px solid #e3eadd;\n}\n.chat-composer textarea {\n  flex: 1;\n  resize: none;\n  border: 1px solid #dae4cf;\n  background: #fcfdf9;\n  padding: 12px 14px;\n  border-radius: 7px;\n  font: inherit;\n  font-size: 11px;\n  line-height: 1.9;\n  min-width: 0;\n}\n.chat-composer button {\n  align-self: center;\n  border: 0;\n  background: #2e6247;\n  color: #fff;\n  width: 40px;\n  height: 40px;\n  display: grid;\n  place-items: center;\n  border-radius: 7px;\n}\n.chat-composer-note {\n  padding: 0 20px 13px;\n  color: #98a58c;\n  font-size: 8px;\n}\n.chat-thinking {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  color: #7b9568;\n  font-size: 11px;\n  padding: 15px;\n}\n.chat-thinking svg {\n  animation: chat-spin 1.4s linear infinite;\n}\n.chat-error {\n  margin: 0 18px;\n  padding: 10px 13px;\n  background: #fff4e6;\n  color: #9c7748;\n  font-size: 10px;\n  line-height: 1.8;\n  border-radius: 5px;\n}\n.sr-only {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  padding: 0;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  white-space: nowrap;\n  border: 0;\n}\n@keyframes chat-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n@media (max-width: 1100px) {\n  .chat-layout {\n    grid-template-columns: 210px minmax(0, 1fr);\n    gap: 15px;\n  }\n  .chat-guide {\n    padding: 18px;\n  }\n  .chat-messages {\n    padding: 17px;\n  }\n  .chat-starters {\n    grid-template-columns: 1fr;\n  }\n  .chat-welcome {\n    margin: 20px auto;\n  }\n  .chat-status small {\n    display: none;\n  }\n}\n@media (max-width: 760px) {\n  .chat-layout {\n    grid-template-columns: 1fr;\n  }\n  .chat-guide {\n    padding: 18px;\n  }\n  .chat-guide > svg,\n  .chat-guide > h3,\n  .chat-guide > p:first-of-type {\n    display: none;\n  }\n  .chat-mode {\n    margin: 0 0 10px;\n  }\n  .chat-boundary {\n    margin: 12px 0;\n  }\n  .chat-guide .button {\n    width: auto;\n  }\n  .chat-window {\n    height: 620px;\n  }\n  .chat-heading h1 {\n    font-size: 27px;\n  }\n  .chat-heading p {\n    font-size: 10px;\n  }\n  .chat-starters {\n    grid-template-columns: 1fr 1fr;\n  }\n  .chat-text {\n    font-size: 12px;\n  }\n  .chat-message {\n    padding: 14px;\n    max-width: 100%;\n  }\n  .chat-status {\n    font-size: 9px;\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .chat-thinking svg {\n    animation: none;\n  }\n  .chat-messages {\n    scroll-behavior: auto;\n  }\n}\n\n\n';

const starters = [
  "Can a camera measure bone density?",
  "What happens to back muscles in space?",
  "How do we establish a movement baseline?",
  "Are there ergonomics standards for space?",
];
export default function ChatbotPage() {
  const [messages, setMessages] = useState([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState("local"),
    [available, setAvailable] = useState(false),
    [error, setError] = useState("");
  const end = useRef(null),
    controller = useRef(null);
  useEffect(() => {
    const c = new AbortController();
    apiFetch("/api/chat/status", { signal: c.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAvailable(!!d?.enabled))
      .catch(() => {});
    return () => {
      c.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);
  async function send(text = input) {
    const q = text.trim();
    if (!q || busy) return;
    const history = messages
      .map((m) => ({ role: m.role, content: m.text }))
      .slice(-10);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setError("");
    setBusy(true);
    try {
      let answer;
      if (mode === "cloud") {
        controller.current = new AbortController();
        const timer = setTimeout(() => controller.current?.abort(), 65000);
        try {
          const response = await apiFetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: q, history }),
            signal: controller.current.signal,
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to generate an answer");
          answer = data;
        } finally {
          clearTimeout(timer);
        }
      } else {
        answer = localAnswer(q, history);
      }
      setMessages((m) => [...m, { role: "assistant", ...answer }]);
    } catch (e) {
      setError(
        "Could not connect to the AI service. A local reference answer is shown instead.",
      );
      setMessages((m) => [
        ...m,
        { role: "assistant", ...localAnswer(q, history) },
      ]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sol-chat" dir="ltr" lang="en">
      <style>{CHAT_STYLES}</style>
      <div className="chat-heading">
        <div>
          <span className="eyebrow">SOL RESEARCH ASSISTANT</span>
          <h1>Ask SOL</h1>
          <p>Understanding human movement in space, one question at a time.</p>
        </div>
        <span className="chat-orbit">
          <MessageCircle size={27} />
        </span>
      </div>
      <div className="chat-layout">
        <aside className="chat-guide">
          <BookOpen size={23} />
          <h3>Reference-based assistant</h3>
          <p>
            6 references covering the spine, muscles, bones, balance, imaging, and human factors.
          </p>
          <div className="chat-mode">
            <label htmlFor="chat-mode">Answer mode</label>
            <select
              id="chat-mode"
              disabled={busy}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="local">Local reference summaries</option>
              <option value="cloud" disabled={!available}>
                AI via OpenAI{" "}
                {available ? "" : "· AI server required"}
              </option>
            </select>
          </div>
          <p className="chat-privacy">
            {mode === "cloud"
              ? "Sending shares this conversation and reference summaries with OpenAI. Astronaut files and video are not sent automatically."
              : "Local mode retrieves predefined answers without sending your messages to an AI service."}
          </p>
          <div className="chat-boundary">
            This uses reference summaries, without model fine-tuning or medical diagnosis. Open each source for details.
          </div>
          <button
            className="button secondary full"
            disabled={busy || !messages.length}
            onClick={() => {
              setMessages([]);
              setError("");
            }}
          >
            <Trash2 size={14} /> New conversation
          </button>
        </aside>
        <div className="chat-window">
          <div className="chat-status">
            <span className="dot" />
            {mode === "cloud"
              ? "AI chat supported by references"
              : "Local library · Retrieved answers"}
            <small>Messages are temporary for this session</small>
          </div>
          <div
            className="chat-messages"
            role="log"
            aria-live="polite"
            aria-label="Conversation messages"
          >
            {!messages.length && (
              <div className="chat-welcome">
                <MessageCircle size={34} />
                <h2>Hello! What would you like to know?</h2>
                <p>Ask about astronaut health, movement, and the SOL prototype.</p>
                <div className="chat-starters">
                  {starters.map((q) => (
                    <button key={q} onClick={() => send(q)}>
                      {q}
                      <Send size={13} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <article key={i} className={"chat-message " + m.role}>
                <span className="chat-speaker">
                  {m.role === "user"
                    ? "You"
                    : m.mode === "cloud"
                      ? "SOL · AI"
                      : "SOL · Local references"}
                </span>
                <div className="chat-text" dir="auto">
                  {m.text}
                </div>
                {m.sources?.length > 0 && (
                  <div className="chat-sources">
                    <b>Answer sources</b>
                    {m.sources.map((s) => (
                      <a
                        key={s.id}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>{s.id}</span>
                        <span dir="auto">{s.title}</span>
                        <ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {busy && (
              <div className="chat-thinking">
                <LoaderCircle size={16} /> Preparing your answer…
              </div>
            )}
            <div ref={end} />
          </div>
          {error && (
            <div className="chat-error" role="alert">
              {error}
            </div>
          )}
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="chat-question">
              Your question for the assistant
            </label>
            <textarea
              id="chat-question"
              placeholder="Ask about astronaut health and movement…"
              value={input}
              maxLength={2000}
              rows="2"
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send question"
            >
              <Send size={19} />
            </button>
          </form>
          <div className="chat-composer-note">
            Enter to send · Shift + Enter for a new line · Consult a doctor for medical decisions.
          </div>
        </div>
      </div>
    </section>
  );
}
