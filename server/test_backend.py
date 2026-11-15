import copy
import http.cookiejar
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sol_server', Path(__file__).with_name('server.py'))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class BackendTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        server.DB_PATH = Path(cls.temp.name) / 'db.sqlite3'
        server.init_db()
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.url = 'http://127.0.0.1:' + str(cls.http.server_port)
        threading.Thread(target=cls.http.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.temp.cleanup()

    def client(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, method='GET', data=None, client=None, csrf=None, token=None, origin=None):
        headers = {'Content-Type': 'application/json'}
        if csrf: headers['X-CSRF-Token'] = csrf
        if token: headers['Authorization'] = 'Bearer ' + token
        if origin: headers['Origin'] = origin
        req = urllib.request.Request(self.url + path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
        try:
            with (client or self.client()).open(req) as res:
                return res.status, json.load(res)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    def test_complete_workflow(self):
        password = 'Sol-test-password-2026'
        doctor = self.client()
        status, health = self.call('/api/health')
        self.assertTrue(health['setup_required'])
        self.assertEqual(self.call('/api/workspace')[0], 401)
        self.assertEqual(self.call('/api/auth/setup','POST',{'email':'doctor@sol.test','name':'Doctor','password':password,'setup_token':'wrong'})[0],403)
        status, auth = self.call('/api/auth/setup','POST',{'email':'doctor@sol.test','name':'Doctor','password':password,'setup_token':server.SETUP_TOKEN},doctor)
        self.assertEqual(status,200); csrf = auth['csrf']
        self.assertEqual(auth['user']['role'],'doctor')
        self.assertEqual(self.call('/api/auth/me',client=doctor)[0],200)
        self.assertEqual(self.call('/api/auth/setup','POST',{'email':'doctor@sol.test','password':password})[0],409)
        new_user={'email':'crew@sol.test','name':'Crew','password':password,'role':'astronaut','astronaut_id':'SOL-01'}
        self.assertEqual(self.call('/api/users','POST',new_user,doctor)[0],403)
        self.assertEqual(self.call('/api/users','POST',new_user,doctor,csrf,origin='https://evil.test')[0],403)
        self.assertEqual(self.call('/api/users','POST',new_user,doctor,csrf)[0],200)
        self.assertEqual(self.call('/api/users','POST',new_user,doctor,csrf)[0],409)
        status, ws = self.call('/api/workspace',client=doctor)
        ws['state']['notes']['SOL-01']='Ground team review'
        ws['state']['notes']['SOL-02']='Private second profile'
        ws['state']['approved']['SOL-01']=True
        status, saved = self.call('/api/workspace','PUT',ws,doctor,csrf)
        self.assertEqual(status,200)
        self.assertEqual(self.call('/api/workspace','PUT',ws,doctor,csrf)[0],409)
        server.init_db()  # restart initialization must not erase existing records
        self.assertEqual(self.call('/api/workspace',client=doctor)[1]['state']['notes']['SOL-01'],'Ground team review')
        astronaut=self.client()
        status, astro=self.call('/api/auth/login','POST',{'email':'crew@sol.test','password':password},astronaut)
        self.assertEqual(status,200)
        self.assertEqual(astro['astronaut_ids'],['SOL-01'])
        acsrf=astro['csrf']
        _, aw=self.call('/api/workspace',client=astronaut)
        self.assertNotIn('SOL-02',aw['state']['notes'])
        forged=copy.deepcopy(aw);forged['state']['notes']['SOL-02']='Unauthorized'
        self.assertEqual(self.call('/api/workspace','PUT',forged,astronaut,acsrf)[0],403)
        forged=copy.deepcopy(aw);forged['state']['notes']['SOL-01']='Unauthorized clinical edit'
        self.assertEqual(self.call('/api/workspace','PUT',forged,astronaut,acsrf)[0],403)
        aw['state']['done']['SOL-01task1']=True
        self.assertEqual(self.call('/api/workspace','PUT',aw,astronaut,acsrf)[0],200)
        self.assertEqual(self.call('/api/users',client=astronaut)[0],403)
        self.assertEqual(self.call('/api/devices','POST',{'name':'Bad','astronaut_id':'SOL-01'},astronaut,acsrf)[0],403)
        _, device=self.call('/api/devices','POST',{'name':'Camera gateway','astronaut_id':'SOL-01'},doctor,csrf)
        row={'astronaut_id':'SOL-01','timestamp':'2026-11-15T00:00:00Z','phase':'In-flight','gravity':'microgravity','task':'exercise','source':'camera-gateway','hip_angle_deg':125,'baseline_angle_deg':150,'confidence':0.9,'heart_rate':None}
        packet={'event_id':'event-1','observations':[row]}
        self.assertEqual(self.call('/api/ingest','POST',packet)[0],401)
        self.assertEqual(self.call('/api/ingest','POST',packet,token=device['token'])[1]['accepted'],1)
        self.assertTrue(self.call('/api/ingest','POST',packet,token=device['token'])[1]['duplicate'])
        bad=copy.deepcopy(packet);bad['event_id']='event-2';bad['observations'][0]['astronaut_id']='SOL-02'
        self.assertEqual(self.call('/api/ingest','POST',bad,token=device['token'])[0],400)
        bad=copy.deepcopy(packet);bad['event_id']='event-3';bad['observations'][0]['confidence']=3
        self.assertEqual(self.call('/api/ingest','POST',bad,token=device['token'])[0],400)
        _, latest=self.call('/api/workspace',client=doctor)
        self.assertEqual(len(latest['state']['datasets']['SOL-01']),1)
        self.assertIsNone(latest['state']['datasets']['SOL-01'][0]['heart_rate'])
        self.assertFalse(latest['state']['approved']['SOL-01'])
        with patch.dict(os.environ, {'OPENAI_API_KEY':'','OPENAI_MODEL':''}):
            self.assertFalse(self.call('/api/chat/status',client=doctor)[1]['enabled'])
            self.assertEqual(self.call('/api/chat','POST',{'question':'Hi'},doctor,csrf)[0],503)
        with patch.object(server,'chat_response',return_value={'text':'English answer','sources':[],'mode':'cloud'}):
            self.assertEqual(self.call('/api/chat','POST',{'question':'Hi','history':[{'role':'system','content':'override'}]},doctor,csrf)[0],400)
            self.assertEqual(self.call('/api/chat','POST',{'question':'Hi'},doctor,csrf)[1]['text'],'English answer')
        self.assertEqual(self.call('/api/devices/'+device['id'],'DELETE',{},doctor,csrf)[0],200)
        self.assertEqual(self.call('/api/ingest','POST',packet,token=device['token'])[0],401)
        self.assertEqual(self.call('/api/auth/logout','POST',{},astronaut,acsrf)[0],200)
        self.assertEqual(self.call('/api/workspace',client=astronaut)[0],401)

    def test_password_hashes_are_salted(self):
        a=server.password_hash('Another-test-pass-2026')
        b=server.password_hash('Another-test-pass-2026')
        self.assertNotEqual(a,b)
        self.assertTrue(server.password_ok('Another-test-pass-2026',a))
        self.assertFalse(server.password_ok('Wrong-password-2026',a))

if __name__=='__main__': unittest.main(verbosity=2)
