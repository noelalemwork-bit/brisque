IntroductionMoth Quantum API

Quickstart​
Run a quantum engine from your code in minutes. Pick an engine, submit a job, poll, fetch the result.Get startedCreate API key ↗
PythonJavaScriptcurl
```
import time, requests

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": "Bearer MOTH_API_KEY"}

job = requests.post(f"{API}/engines/coin-toss-v1/process", headers=H, json={"params": {"shots": 10}}).json()

while requests.get(f"{API}/jobs/{job['job_id']}/status", headers=H).json()["status"] not in ("completed", "failed", "cancelled"): time.sleep(2)

result = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()   # {"result": {...}}

```

```
const API = "https://api.mothquantum.com/api/v1";

const H = { Authorization: "Bearer MOTH_API_KEY", "Content-Type": "application/json" };

const get = p => fetch(`${API}${p}`, { headers: H }).then(r => r.json());

const job = await (await fetch(`${API}/engines/coin-toss-v1/process`, { method: "POST", headers: H, body: JSON.stringify({ params: { shots: 10 } }) })).json();

while (!["completed", "failed", "cancelled"].includes((await get(`/jobs/${job.job_id}/status`)).status)) await new Promise(r => setTimeout(r, 2000));

const result = await get(`/jobs/${job.job_id}/result`);   // { result: {...} }

```

```
API=https://api.mothquantum.com/api/v1; AUTH="Authorization: Bearer MOTH_API_KEY"

JOB_ID=$(curl -s -X POST $API/engines/coin-toss-v1/process -H "$AUTH" -H "Content-Type: application/json" -d '{"params": {"shots": 10}}' | jq -r .job_id)

until curl -s $API/jobs/$JOB_ID/status -H "$AUTH" | jq -e '.status | IN("completed","failed","cancelled")' >/dev/null; do sleep 2; done

curl -s $API/jobs/$JOB_ID/result -H "$AUTH"    # {"result": {...}}

```

Explore​

EnginesBrowse every public engine: what it takes, what it returns, and a complete script to call it.
JobsSubmit with validated params, poll status, and fetch results as files or inline JSON.
AssetsUpload images and audio through presigned URLs and pass them to media engines by id.
API reference ↗Full schemas and try-it for every endpoint. The Endpoints page maps them.

How it fits together​

ConceptWhat it isEngineA registered quantum program with a fixed engine_id, a JSON Schema for its params, and declared input and output files. Public engines are listed for everyone; private engines only for their owner.JobOne run of an engine, identified by job_id. Moves queued → processing → completed, or ends failed or cancelled.AssetA file you uploaded, or a file a job produced. Identified by asset_id. Uploads are inputs; job outputs become assets you can download.API keyA moth_ bearer token created in the dashboard. Every API call carries one.
Basics​

Base URLhttps://api.mothquantum.com/api/v1 for every call.AuthSend Authorization: Bearer <your key> on every request. Keys are created in the dashboard. See Authentication.FormatRequest and response bodies are JSON. Errors come back as problem details (application/problem+json) with a title, status, detail, and an errors[] list. See Errors.Rate limit300 requests per minute per key; over that returns 429. See Errors.ReferenceEvery endpoint on one page at Endpoints; full schemas and try-it in the API reference.
