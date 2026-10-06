Getting startedOn this page
Getting started

Run a quantum coin toss from your terminal. Five steps, one engine that needs no file input.

1. Create an API key​

In the dashboard open API keys and create one. The key is shown once, then never again. Put it in your environment:

```
export MOTH_API_KEY="moth_…"

```

The snippets below assume the base URL https://api.mothquantum.com/api/v1 and this header on every request: Authorization: Bearer $MOTH_API_KEY.

2. List engines​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/engines \

  -H "Authorization: Bearer $MOTH_API_KEY"

```

```
import os, requests

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

engines = requests.get(f"{API}/engines", headers=H).json()["engines"]

print([e["engine_id"] for e in engines])

```

```
const API = "https://api.mothquantum.com/api/v1";

const H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };

const { engines } = await (await fetch(`${API}/engines`, { headers: H })).json();

console.log(engines.map(e => e.engine_id));

```

Every engine you can use, with its engine_id. To view the schema for a specific engine's parameters and results, visit its Engines page or use the GET /engines/{engine_id} endpoint, as shown in Reading an engine definition.

3. Submit a job​

curlPythonJavaScript
```
JOB_ID=$(curl -s -X POST https://api.mothquantum.com/api/v1/engines/coin-toss-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{"params": {"shots": 10}}' | jq -r .job_id)

echo $JOB_ID

```

```
job = requests.post(f"{API}/engines/coin-toss-v1/process", headers=H,

                    json={"params": {"shots": 10}}).json()

job_id = job["job_id"]

```

```
const job = await (await fetch(`${API}/engines/coin-toss-v1/process`, {

  method: "POST",

  headers: { ...H, "Content-Type": "application/json" },

  body: JSON.stringify({ params: { shots: 10 } }),

})).json();

const jobId = job.job_id;

```

```
{"job_id": "…", "status": "queued", "submitted_at": "…"}

```

params is validated against the engine's schema before anything runs. An unknown or out-of-range field is a 422 listing every problem at once.

4. Poll status​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status \

  -H "Authorization: Bearer $MOTH_API_KEY"

```

```
import time

while True:

    st = requests.get(f"{API}/jobs/{job_id}/status", headers=H).json()

    if st["status"] in ("completed", "failed", "cancelled"):

        break

    time.sleep(2)

```

```
let st;

do {

  await new Promise(r => setTimeout(r, 2000));

  st = await (await fetch(`${API}/jobs/${jobId}/status`, { headers: H })).json();

} while (!["completed", "failed", "cancelled"].includes(st.status));

```

status goes queued, processing, then completed or failed. Poll every couple of seconds; do not busy-loop.

5. Fetch the result​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result \

  -H "Authorization: Bearer $MOTH_API_KEY"

```

```
res = requests.get(f"{API}/jobs/{job_id}/result", headers=H).json()

print(res["result"])

```

```
const res = await (await fetch(`${API}/jobs/${jobId}/result`, { headers: H })).json();

console.log(res.result);

```

Coin toss returns its counts inline in result. Engines that produce files return an outputs array with a presigned download URL per file instead. See Job status and results.

Next​

An engine that takes an image: Assets, then Examples.

What every field means: its page in the Engines.

