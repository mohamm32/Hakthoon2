"""Send synthetic device data to test ingestion; not a hardware integration."""
import argparse
import getpass
import json
import secrets
import urllib.request
from datetime import datetime, timezone
parser=argparse.ArgumentParser()
parser.add_argument('--astronaut',default='SOL-01')
parser.add_argument('--url',default='http://localhost:3001')
args=parser.parse_args()
token=getpass.getpass('Device key: ')
data={'event_id':secrets.token_hex(12),'observations':[{'astronaut_id':args.astronaut,'timestamp':datetime.now(timezone.utc).isoformat(),'phase':'In-flight','gravity':'microgravity','task':'Synthetic ingestion test','source':'synthetic-device-test','hip_angle_deg':125,'baseline_angle_deg':150,'confidence':0.9,'heart_rate':None}]}
req=urllib.request.Request(args.url+'/api/ingest',data=json.dumps(data).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token},method='POST')
with urllib.request.urlopen(req) as response: print(response.read().decode())
