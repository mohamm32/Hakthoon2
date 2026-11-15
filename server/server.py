"""SOL local research backend. Python 3.10+, standard library only."""
import argparse
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

BASE = Path(__file__).resolve().parent
# Optional local configuration. Existing process variables take precedence.
config_path = BASE / '.env'
if config_path.exists():
    for line in config_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            if re.fullmatch(r'[A-Z_][A-Z0-9_]*', key.strip()):
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
DB_PATH = BASE / 'data' / 'sol.sqlite3' 
FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:5173').rstrip('/')
SETUP_TOKEN = secrets.token_urlsafe(24)
SECURE_COOKIES = os.environ.get('SECURE_COOKIES') == '1'
SESSION_TTL = 8 * 3600
MAX_BODY = 5 * 1024 * 1024
FIELDS = ('datasets', 'measurements', 'notes', 'approved', 'reviewed', 'done')
DOCTOR_FIELDS = {'measurements', 'notes', 'approved', 'reviewed'}
LOCK = threading.RLock()
RATE = {}

class APIError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message

def require(condition, status, message):
    if not condition:
        raise APIError(status, message)

def connect():
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('doctor','astronaut')),astronaut_id TEXT);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),csrf TEXT NOT NULL,expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,astronaut_id TEXT REFERENCES profiles(id),token_hash TEXT UNIQUE NOT NULL,created_at REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS events(device_id TEXT REFERENCES devices(id),event_id TEXT,created_at REAL NOT NULL,PRIMARY KEY(device_id,event_id));
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at REAL NOT NULL,user_id TEXT,action TEXT NOT NULL,target TEXT);
        ''')
        for pid in ('SOL-01', 'SOL-02', 'SOL-03'):
            db.execute('INSERT OR IGNORE INTO profiles VALUES(?)', (pid,))
        db.execute('INSERT OR IGNORE INTO workspace VALUES(1,0,?)', (json.dumps({k: {} for k in FIELDS}),))

def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()

def password_hash(password, salt=None):
    require(isinstance(password, str) and 12 <= len(password) <= 256, 400, 'Password must contain 12–256 characters.')
    salt = salt or secrets.token_hex(16)
    return salt + ':' + hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()

def password_ok(password, stored):
    try:
        return hmac.compare_digest(password_hash(password, stored.split(':')[0]), stored)
    except (APIError, ValueError, TypeError):
        return False

def public_user(row):
    return {k: row[k] for k in ('id', 'email', 'name', 'role', 'astronaut_id')}

def audit(db, uid, action, target=''):
    db.execute('INSERT INTO audit(at,user_id,action,target) VALUES(?,?,?,?)', (time.time(), uid, action, target))

def allowed_ids(db, user):
    if user['role'] == 'doctor':
        return [r['id'] for r in db.execute('SELECT id FROM profiles ORDER BY id')]
    return [user['astronaut_id']]

def scoped_state(payload, ids):
    return {field: {k: v for k, v in payload[field].items()
                    if (k in ids if field != 'done' else any(k.startswith(p) for p in ids))}
            for field in FIELDS}

def valid_row(row, pid):
    require(isinstance(row, dict) and row.get('astronaut_id') == pid, 400, 'Observation astronaut_id must match its profile.')
    require(isinstance(row.get('timestamp'), str) and bool(re.search(r'(Z|[+-]\d\d:\d\d)$', row['timestamp'])), 400, 'Use an ISO timestamp with a timezone.')
    try:
        datetime.fromisoformat(row['timestamp'].replace('Z', '+00:00'))
    except ValueError:
        raise APIError(400, 'Invalid observation timestamp.')
    for k in ('phase', 'gravity', 'task', 'source'):
        require(isinstance(row.get(k), str) and 0 < len(row[k]) <= 160, 400, f'Observation needs {k}.')
    for k, low, high in (('hip_angle_deg', 0, 360), ('baseline_angle_deg', 0, 360), ('confidence', 0, 1), ('heart_rate', 0, 300)):
        value = row.get(k)
        require(value is None or (type(value) in (int, float) and math.isfinite(value) and low <= value <= high), 400, f'Invalid {k}; use null for missing data.')
    require(len(json.dumps(row)) <= 4096, 400, 'Observation is too large.')

def validate_workspace(state, ids, user):
    require(isinstance(state, dict) and set(state) == set(FIELDS), 400, 'Invalid workspace fields.')
    for field, mapping in state.items():
        require(isinstance(mapping, dict), 400, 'Workspace fields must be objects.')
        for pid, value in mapping.items():
            require(pid in ids if field != 'done' else any(pid.startswith(p) for p in ids), 403, 'Profile access denied.')
            if field == 'datasets':
                require(isinstance(value, list) and len(value) <= 10000, 400, 'At most 10000 observations per profile.')
                for row in value:
                    valid_row(row, pid)
            elif field == 'measurements':
                require(isinstance(value, list) and len(value) <= 1000 and all(isinstance(x, dict) for x in value), 400, 'Invalid clinical measurements.')
            elif field == 'notes':
                require(isinstance(value, str) and len(value) <= 20000, 400, 'Invalid note.')
            else:
                require(type(value) is bool, 400, 'Review and task values must be boolean.')

def rate_limit(key, limit=12, window=60):
    now = time.monotonic()
    with LOCK:
        recent = [t for t in RATE.get(key, []) if now - t < window]
        require(len(recent) < limit, 429, 'Too many attempts. Try again later.')
        RATE[key] = recent + [now]

def chat_response(question, history):
    key, model = os.environ.get('OPENAI_API_KEY'), os.environ.get('OPENAI_MODEL')
    require(key and model, 503, 'AI is disabled. Set OPENAI_API_KEY and OPENAI_MODEL on the server.')
    references = json.loads((BASE / 'references.json').read_text(encoding='utf-8'))
    instructions = ('You are SOL, an English-language astronaut health research assistant. Always answer in English. '
        'Explain evidence and uncertainty; never diagnose, prescribe, declare a posture safe, or invent measurements or sources. '
        'Video cannot measure bone mineral density, muscle composition, or internal spinal anatomy. '
        'Local pose thresholds are experimental, not medical safety standards. '
        'The following are curated summaries, not verified full papers. Use them only when relevant; identify general knowledge separately. '
        'Do not claim to access astronaut records or live devices. Cite supported claims with [S1] style identifiers. '
        'Reference data follows:\n' + json.dumps(references, ensure_ascii=False))
    payload = {'model': model, 'instructions': instructions, 'input': history + [{'role': 'user', 'content': question}], 'max_output_tokens': 1200, 'store': False}
    req = urllib.request.Request('https://api.openai.com/v1/responses', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=50) as response:
            result = json.load(response)
    except urllib.error.HTTPError as e:
        raise APIError(502, f'AI provider returned HTTP {e.code}. Check server API configuration and billing.')
    except (urllib.error.URLError, TimeoutError, OSError):
        raise APIError(502, 'AI service could not be reached.')
    text = '\n'.join(part.get('text', '') for item in result.get('output', []) if item.get('type') == 'message' for part in item.get('content', []) if part.get('type') == 'output_text')
    require(bool(text.strip()), 502, 'AI returned no answer.')
    sources = [r for r in references if re.search(r'\[' + re.escape(r['id']) + r'\]', text)]
    return {'text': text, 'sources': [{'id': r['id'], 'title': r['title'], 'url': r['url']} for r in sources], 'mode': 'cloud'}

class Handler(BaseHTTPRequestHandler):
    server_version = 'SOL/1.0'
    def log_message(self, fmt, *args):
        # No request bodies, passwords, session cookies, or API keys in logs.
        print(time.strftime('%H:%M:%S'), fmt % args)

    def reply(self, code, payload, cookie=None):
        body = json.dumps(payload, allow_nan=False).encode()
        self.send_response(code)
        if self.headers.get('Origin') == FRONTEND_ORIGIN:
            self.send_header('Access-Control-Allow-Origin', FRONTEND_ORIGIN)
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.send_header('Vary', 'Origin')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if self.headers.get('Origin') != FRONTEND_ORIGIN:
            return self.reply(403, {'error': 'Origin denied.'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', FRONTEND_ORIGIN)
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.end_headers()

    def do_GET(self): self.dispatch()
    def do_POST(self): self.dispatch()
    def do_PUT(self): self.dispatch()
    def do_DELETE(self): self.dispatch()

    def body(self):
        require(self.headers.get('Content-Type', '').split(';')[0] == 'application/json', 415, 'Send application/json.')
        try:
            size = int(self.headers.get('Content-Length', '0'))
            require(0 < size <= MAX_BODY, 413, 'Body must be between 1 byte and 5 MB.')
            value = json.loads(self.rfile.read(size), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            require(isinstance(value, dict), 400, 'JSON body must be an object.')
            return value
        except (ValueError, UnicodeDecodeError):
            raise APIError(400, 'Invalid JSON.')

    def session(self, db):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
            token = cookies['sol_session'].value
        except (KeyError, ValueError):
            raise APIError(401, 'Sign in to continue.')
        row = db.execute('SELECT users.*, sessions.csrf FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?', (digest(token), time.time())).fetchone()
        require(row is not None, 401, 'Session expired. Sign in again.')
        if self.command != 'GET':
            require(hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), row['csrf']), 403, 'Invalid CSRF token.')
        return row

    def start_session(self, db, user):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(24)
        db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        db.execute('INSERT INTO sessions VALUES(?,?,?,?)', (digest(token), user['id'], csrf, time.time() + SESSION_TTL))
        cookie = f'sol_session={token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}' + ('; Secure' if SECURE_COOKIES else '')
        return {'user': public_user(user), 'csrf': csrf, 'astronaut_ids': allowed_ids(db, user)}, cookie

    def dispatch(self):
        try:
            path = urlsplit(self.path).path
            if self.command != 'GET' and self.headers.get('Origin'):
                require(self.headers['Origin'] == FRONTEND_ORIGIN, 403, 'Origin denied.')
            with LOCK, connect() as db:
                response, cookie = self.route(db, path)
            if callable(response):
                response = response()
            self.reply(200, response, cookie)
        except APIError as e:
            self.reply(e.status, {'error': e.message})
        except Exception as e:
            print('Server error:', type(e).__name__)
            self.reply(500, {'error': 'Internal server error.'})

    def route(self, db, path):
        method = self.command
        if method == 'GET' and path == '/api/health':
            return {'ok': True, 'setup_required': db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0}, None
        if method == 'POST' and path in ('/api/auth/setup', '/api/auth/login'):
            rate_limit(('auth', self.client_address[0]))
            data = self.body()
            email = str(data.get('email', '')).strip().lower()
            password = data.get('password')
            require(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) is not None and len(email) <= 254, 400, 'Enter a valid email.')
            if path.endswith('setup'):
                require(db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0, 409, 'Setup already completed.')
                require(hmac.compare_digest(str(data.get('setup_token', '')), SETUP_TOKEN), 403, 'Enter the setup token printed in the backend terminal.')
                name = str(data.get('name', '')).strip()
                require(0 < len(name) <= 100, 400, 'Enter your name.')
                db.execute('INSERT INTO users VALUES(?,?,?,?,?,NULL)', (secrets.token_hex(16), email, name, password_hash(password), 'doctor'))
            user = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
            require(user is not None and password_ok(password, user['password']), 401, 'Incorrect email or password.')
            audit(db, user['id'], 'login')
            return self.start_session(db, user)
        if method == 'POST' and path == '/api/ingest':
            # Device clients use a revocable key rather than browser sessions.
            rate_limit(('device', self.client_address[0]), 120)
            token = self.headers.get('Authorization', '')
            require(token.startswith('Bearer '), 401, 'Device key required.')
            device = db.execute('SELECT * FROM devices WHERE token_hash=?', (digest(token[7:]),)).fetchone()
            require(device is not None, 401, 'Invalid device key.')
            data = self.body()
            event_id, rows = data.get('event_id'), data.get('observations')
            require(isinstance(event_id, str) and re.fullmatch(r'[A-Za-z0-9_.:-]{1,100}', event_id), 400, 'Use a unique event_id.')
            require(isinstance(rows, list) and 0 < len(rows) <= 500, 400, 'Send 1–500 observations.')
            for row in rows:
                valid_row(row, device['astronaut_id'])
                require(row['source'] not in ('demo-fused', 'demo'), 400, 'Device events cannot be labelled demo.')
            exists = db.execute('SELECT 1 FROM events WHERE device_id=? AND event_id=?', (device['id'], event_id)).fetchone()
            if exists:
                return {'accepted': 0, 'duplicate': True}, None
            record = db.execute('SELECT * FROM workspace WHERE id=1').fetchone()
            state = json.loads(record['payload'])
            observations = state['datasets'].get(device['astronaut_id'], []) + rows
            require(len(observations) <= 10000, 409, 'Profile observation limit reached; export and archive before ingesting more.')
            state['datasets'][device['astronaut_id']] = sorted(observations, key=lambda r: datetime.fromisoformat(r['timestamp'].replace('Z', '+00:00')).timestamp())
            state['reviewed'][device['astronaut_id']] = False
            state['approved'][device['astronaut_id']] = False
            db.execute('UPDATE workspace SET payload=?,revision=revision+1 WHERE id=1', (json.dumps(state),))
            db.execute('INSERT INTO events VALUES(?,?,?)', (device['id'], event_id, time.time()))
            audit(db, device['id'], 'ingest', device['astronaut_id'])
            return {'accepted': len(rows), 'duplicate': False}, None
        user = self.session(db)
        uid = user['id']
        ids = allowed_ids(db, user)
        if method == 'GET' and path == '/api/auth/me':
            return {'user': public_user(user), 'csrf': user['csrf'], 'astronaut_ids': ids}, None
        if method == 'POST' and path == '/api/auth/logout':
            db.execute('DELETE FROM sessions WHERE user_id=? AND csrf=?', (uid, user['csrf']))
            return {'ok': True}, 'sol_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0'
        if path == '/api/workspace':
            record = db.execute('SELECT * FROM workspace WHERE id=1').fetchone()
            state = json.loads(record['payload'])
            if method == 'GET':
                return {'state': scoped_state(state, ids), 'revision': record['revision']}, None
            if method == 'PUT':
                data = self.body()
                require(type(data.get('revision')) is int and data['revision'] == record['revision'], 409, 'The workspace changed. Export unsaved changes, then reload before saving.')
                incoming = data.get('state')
                validate_workspace(incoming, ids, user)
                if user['role'] != 'doctor':
                    old = scoped_state(state, ids)
                    require(all(incoming[k] == old[k] for k in DOCTOR_FIELDS), 403, 'Only a doctor may change clinical records, notes, or approvals.')
                changed_profiles = [pid for pid in ids if incoming['datasets'].get(pid) != state['datasets'].get(pid)]
                for field in FIELDS:
                    current = scoped_state(state, ids)[field]
                    for key in current:
                        state[field].pop(key, None)
                    state[field].update(incoming[field])
                for pid in changed_profiles:
                    state['reviewed'][pid] = False
                    state['approved'][pid] = False
                db.execute('UPDATE workspace SET payload=?,revision=revision+1 WHERE id=1', (json.dumps(state),))
                audit(db, uid, 'save_workspace', ','.join(ids))
                return {'revision': record['revision'] + 1, 'state': scoped_state(state, ids)}, None
        if path == '/api/users':
            require(user['role'] == 'doctor', 403, 'Doctor access required.')
            if method == 'GET':
                return {'users': [public_user(r) for r in db.execute('SELECT * FROM users ORDER BY name')]}, None
            if method == 'POST':
                data = self.body()
                email, name = str(data.get('email', '')).strip().lower(), str(data.get('name', '')).strip()
                role, pid = data.get('role'), data.get('astronaut_id')
                require(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) is not None and len(email) <= 254 and 0 < len(name) <= 100, 400, 'Valid email and name required.')
                require(role in ('doctor', 'astronaut'), 400, 'Invalid role.')
                require(role == 'doctor' or pid in ids, 400, 'Choose a valid astronaut profile.')
                require(db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone() is None, 409, 'Email already registered.')
                new_id = secrets.token_hex(16)
                db.execute('INSERT INTO users VALUES(?,?,?,?,?,?)', (new_id, email, name, password_hash(data.get('password')), role, pid if role == 'astronaut' else None))
                audit(db, uid, 'create_user', new_id)
                return {'ok': True}, None
        if path == '/api/devices' or path.startswith('/api/devices/'):
            require(user['role'] == 'doctor', 403, 'Doctor access required.')
            if method == 'GET' and path == '/api/devices':
                return {'devices': [dict(r) for r in db.execute('SELECT id,name,astronaut_id,created_at FROM devices ORDER BY created_at DESC')]}, None
            if method == 'POST' and path == '/api/devices':
                data = self.body()
                pid, name = data.get('astronaut_id'), str(data.get('name', '')).strip()
                require(pid in ids and 0 < len(name) <= 100, 400, 'Valid profile and device name required.')
                token, did = secrets.token_urlsafe(32), secrets.token_hex(16)
                db.execute('INSERT INTO devices VALUES(?,?,?,?,?)', (did, name, pid, digest(token), time.time()))
                audit(db, uid, 'create_device', did)
                return {'id': did, 'token': token}, None
            if method == 'DELETE' and path.startswith('/api/devices/'):
                did = path.rsplit('/', 1)[-1]
                db.execute('DELETE FROM events WHERE device_id=?', (did,))
                db.execute('DELETE FROM devices WHERE id=?', (did,))
                audit(db, uid, 'revoke_device', did)
                return {'ok': True}, None
        if method == 'GET' and path == '/api/chat/status':
            return {'enabled': bool(os.environ.get('OPENAI_API_KEY') and os.environ.get('OPENAI_MODEL'))}, None
        if method == 'POST' and path == '/api/chat':
            rate_limit(('chat', uid), 10)
            data = self.body()
            question, history = data.get('question'), data.get('history', [])
            require(isinstance(question, str) and 0 < len(question.strip()) <= 2000, 400, 'Question must contain 1–2000 characters.')
            require(isinstance(history, list) and len(history) <= 10, 400, 'At most 10 history messages.')
            require(all(isinstance(m, dict) and m.get('role') in ('user', 'assistant') and isinstance(m.get('content'), str) and len(m['content']) <= 12000 for m in history), 400, 'Invalid chat history.')
            history = [{k: m[k] for k in ('role', 'content')} for m in history]
            return lambda: chat_response(question.strip(), history), None
        if method == 'GET' and path == '/api/audit':
            require(user['role'] == 'doctor', 403, 'Doctor access required.')
            return {'events': [dict(r) for r in db.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 100')]}, None
        raise APIError(404, 'API route not found.')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3001)
    args = parser.parse_args()
    init_db()
    with connect() as db:
        setup = not db.execute('SELECT 1 FROM users LIMIT 1').fetchone()
    print(f'SOL backend: http://127.0.0.1:{args.port}')
    if setup:
        print('First-run setup token (enter in the website):', SETUP_TOKEN)
    print('Keep this terminal open. Frontend origin:', FRONTEND_ORIGIN)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()

if __name__ == '__main__':
    main()
