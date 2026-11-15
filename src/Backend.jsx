import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import "./backend.css";

const API = (import.meta.env.VITE_SOL_API_URL || "http://localhost:3001").replace(/\/$/, "");
let csrf = "";
const Context = createContext(null);
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET") headers.set("X-CSRF-Token", csrf);
  return fetch(API + path, { ...options, headers, credentials: "include" });
}
async function request(path, options) {
  const response = await apiFetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export const useBackend = () => useContext(Context);
export function useWorkspaceField(name) {
  const context = useBackend();
  return [context.state[name], (update) => {
    if (context.user.role !== "doctor" && ["measurements", "notes", "approved", "reviewed"].includes(name)) {
      context.setStatus("Only a doctor may edit clinical records, notes, reviews, or approvals.");
      return;
    }
    context.setState(previous => ({ ...previous, [name]: typeof update === "function" ? update(previous[name]) : update }));
  }];
}
export function BackendGate({ children }) {
  const [auth, setAuth] = useState(null), [state, setState] = useState(null);
  const [revision, setRevision] = useState(0), [baseline, setBaseline] = useState("");
  const [status, setStatus] = useState(""), [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false), [busy, setBusy] = useState(false);
  const dirty = state !== null && JSON.stringify(state) !== baseline;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  async function load(session) {
    csrf = session.csrf;
    const result = await request("/api/workspace");
    setState(result.state); setBaseline(JSON.stringify(result.state));
    setRevision(result.revision); setAuth(session); setStatus("Saved data loaded.");
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const health = await request("/api/health");
        if (!active) return;
        setSetup(health.setup_required);
        if (!health.setup_required) {
          const result = await apiFetch("/api/auth/me");
          if (result.ok && active) await load(await result.json());
          else if (result.status !== 401) throw new Error("Could not restore your session.");
        }
      } catch (e) { if (active) setStatus("Backend unavailable: " + e.message + ". Start the backend terminal first."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const warn = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function login(e) {
    e.preventDefault(); setBusy(true); setStatus("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try { await load(await request(setup ? "/api/auth/setup" : "/api/auth/login", { method: "POST", body: JSON.stringify(data) })); setSetup(false); }
    catch (e) { setStatus(e.message); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true);
    try {
      const result = await request("/api/workspace", { method: "PUT", body: JSON.stringify({ state, revision }) });
      setRevision(result.revision); setState(result.state); setBaseline(JSON.stringify(result.state)); setStatus("Changes saved to the database.");
    } catch (e) { setStatus(e.message); }
    finally { setBusy(false); }
  }
  function exportUnsaved() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ state, revision }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "sol-workspace-backup.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function reload() {
    if (dirty && !window.confirm("Discard unsaved changes and load the database version? Export a backup first if needed.")) return;
    setBusy(true); try { await load(auth); } catch (e) { setStatus(e.message); } finally { setBusy(false); }
  }
  async function logout() {
    if (dirty && !window.confirm("Sign out and discard unsaved changes?")) return;
    setBusy(true);
    try { await request("/api/auth/logout", { method: "POST", body: "{}" }); csrf = ""; setAuth(null); setState(null); setStatus("Signed out."); }
    catch (e) { setStatus(e.message); } finally { setBusy(false); }
  }
  if (loading) return <div className="backend-login">Connecting to SOL…</div>;
  if (!auth) return <main className="backend-login" dir="ltr"><form onSubmit={login}>
    <span>SOL · SECURE WORKSPACE</span><h1>{setup ? "Create your first doctor account" : "Welcome back"}</h1>
    <p>Sign in to load saved astronaut records.</p>
    {setup && <><label>Name<input name="name" required maxLength={100} autoComplete="name" /></label><label>Setup token<input name="setup_token" required autoComplete="off" /><small>Copy the token from your backend terminal.</small></label></>}
    <label>Email<input name="email" type="email" required autoComplete="username" /></label>
    <label>Password<input name="password" type="password" required minLength={12} maxLength={256} autoComplete={setup ? "new-password" : "current-password"} /></label>
    <button disabled={busy}>{busy ? "Please wait…" : setup ? "Create account" : "Sign in"}</button>
    <p role="status">{status}</p>
  </form></main>;
  return <Context.Provider value={{ ...auth, state, setState, setStatus, revision }}>
    <div className="backend-bar" dir="ltr">
      <strong>{auth.user.name} · {auth.user.role}</strong><span>{dirty ? "Unsaved changes" : "Saved"}</span>
      <button disabled={busy || !dirty} onClick={save}>Save changes</button>
      <button disabled={busy} onClick={reload}>Refresh records</button>
      <button onClick={exportUnsaved}>Export backup</button>
      <button disabled={busy} onClick={logout}>Sign out</button>
      <small role="status">{status}</small>
    </div>
    <div inert={busy ? "" : undefined}>{children}</div>
  </Context.Provider>;
}
export function BackendSettings() {
  const { user, astronaut_ids, setStatus } = useBackend();
  const [devices, setDevices] = useState([]), [users, setUsers] = useState([]), [token, setToken] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function refresh() {
    const [a, b] = await Promise.all([request("/api/devices"), request("/api/users")]);
    setDevices(a.devices); setUsers(b.users);
  }
  useEffect(() => { if (user.role === "doctor") refresh().catch(e => setMessage(e.message)); }, [user.role]);
  async function submit(e, path) {
    e.preventDefault(); const form = e.currentTarget; setBusy(true); setMessage(""); setToken("");
    try {
      const data = await request(path, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      if (data.token) setToken(data.token);
      form.reset(); await refresh(); setMessage("Saved.");
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function revoke(id) {
    setBusy(true);
    try { await request("/api/devices/" + id, { method: "DELETE", body: "{}" }); await refresh(); setMessage("Device key revoked."); }
    catch(e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="backend-settings" dir="ltr"><h1>Backend & accounts</h1>
    <p>SQLite storage · Authenticated access · Explicit saves · No live hardware connection until a device sends observations.</p>
    <p>Use <b>Save changes</b> after imports, camera captures, clinical updates, or task completion. Use <b>Refresh records</b> to load new device data.</p>
    {user.role !== "doctor" ? <p>Your account can access only your assigned profile. Clinical records and approvals are read-only.</p> : <>
      <div className="backend-grid"><form onSubmit={e => submit(e, "/api/users")}><h2>Create account</h2>
        <label>Name<input name="name" required maxLength={100} /></label><label>Email<input name="email" type="email" required /></label>
        <label>Temporary password<input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" /></label>
        <label>Role<select name="role"><option value="astronaut">Astronaut</option><option value="doctor">Doctor (access to all profiles)</option></select></label>
        <label>Astronaut profile<select name="astronaut_id">{astronaut_ids.map(id => <option key={id}>{id}</option>)}</select></label>
        <button disabled={busy}>Create account</button>
      </form><form onSubmit={e => submit(e, "/api/devices")}><h2>Register a device</h2>
        <label>Device name<input name="name" required maxLength={100} /></label>
        <label>Astronaut profile<select name="astronaut_id">{astronaut_ids.map(id => <option key={id}>{id}</option>)}</select></label>
        <button disabled={busy}>Generate device key</button>
        <p>Copy the key now. It is shown once. Keep it on the device or its gateway, never in a public frontend.</p>
        {token && <label>Device key<textarea readOnly value={token} rows={3} spellCheck={false} /></label>}
      </form></div>
      <h2>Registered accounts</h2><ul>{users.map(u => <li key={u.id}>{u.name} · {u.email} · {u.role} {u.astronaut_id || ""}</li>)}</ul>
      <h2>Registered devices</h2>{!devices.length && <p>No devices registered.</p>}<ul>{devices.map(d => <li key={d.id}>{d.name} · {d.astronaut_id} <button disabled={busy} onClick={() => revoke(d.id)}>Revoke key</button></li>)}</ul>
    </>}
    <p role="status">{message}</p>
  </section>;
}
