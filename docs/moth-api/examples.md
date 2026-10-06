ExamplesOn this page
Examples

Two complete scripts, one per engine shape. Each is runnable with MOTH_API_KEY set. Every engine page in the catalog carries the same script filled in with that engine's own parameters.

JSON in, JSON out​

coin-toss-v1: no files, inline result.

PythonJavaScript
```
import os, time, requests

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

def wait(job_id):

    while True:

        st = requests.get(f"{API}/jobs/{job_id}/status", headers=H).json()

        if st["status"] in ("completed", "failed", "cancelled"):

            return st

        time.sleep(2)

job = requests.post(f"{API}/engines/coin-toss-v1/process", headers=H,

                    json={"params": {"shots": 100}}).json()

st = wait(job["job_id"])

if st["status"] != "completed":

    raise RuntimeError(f"job {st['status']}: {st['error']}")

print(requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()["result"])

```

```
const API = "https://api.mothquantum.com/api/v1";

const H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };

async function wait(jobId) {

  for (;;) {

    const st = await (await fetch(`${API}/jobs/${jobId}/status`, { headers: H })).json();

    if (["completed", "failed", "cancelled"].includes(st.status)) return st;

    await new Promise(r => setTimeout(r, 2000));

  }

}

const job = await (await fetch(`${API}/engines/coin-toss-v1/process`, {

  method: "POST", headers: { ...H, "Content-Type": "application/json" },

  body: JSON.stringify({ params: { shots: 100 } }),

})).json();

const st = await wait(job.job_id);

if (st.status !== "completed") throw new Error(JSON.stringify(st.error));

console.log((await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json()).result);

```

File in, file out​

blur-v1: upload an image, blur it, download the result.

PythonJavaScript
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

def upload(path: Path, content_type: str) -> str:

    data = path.read_bytes()

    a = requests.post(f"{API}/assets", headers=H, json={

        "filename": path.name, "content_type": content_type, "size_bytes": len(data)}).json()

    requests.put(a["upload"]["url"], data=data, headers=a["upload"]["headers"]).raise_for_status()

    requests.post(f"{API}/assets/{a['asset_id']}/complete", headers=H).raise_for_status()

    return a["asset_id"]

def wait(job_id):

    while True:

        st = requests.get(f"{API}/jobs/{job_id}/status", headers=H).json()

        if st["status"] in ("completed", "failed", "cancelled"):

            return st

        time.sleep(2)

image_id = upload(Path("photo.png"), "image/png")

job = requests.post(f"{API}/engines/blur-v1/process", headers=H, json={

    "params": {"strength": 0.5, "style": "rx", "size": 1024},

    "input_files": {"image": image_id},

}).json()

st = wait(job["job_id"])

if st["status"] != "completed":

    raise RuntimeError(f"job {st['status']}: {st['error']}")

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:                       # blur-v1 declares one slot: "result"

    Path(f"{out['slot']}.png").write_bytes(requests.get(out["url"]).content)

```

```
import fs from "node:fs/promises";

const API = "https://api.mothquantum.com/api/v1";

const H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };

async function upload(path, contentType) {

  const data = await fs.readFile(path);

  const a = await (await fetch(`${API}/assets`, {

    method: "POST", headers: { ...H, "Content-Type": "application/json" },

    body: JSON.stringify({ filename: path, content_type: contentType, size_bytes: data.byteLength }),

  })).json();

  await fetch(a.upload.url, { method: "PUT", headers: a.upload.headers, body: data });

  await fetch(`${API}/assets/${a.asset_id}/complete`, { method: "POST", headers: H });

  return a.asset_id;

}

async function wait(jobId) {

  for (;;) {

    const st = await (await fetch(`${API}/jobs/${jobId}/status`, { headers: H })).json();

    if (["completed", "failed", "cancelled"].includes(st.status)) return st;

    await new Promise(r => setTimeout(r, 2000));

  }

}

const imageId = await upload("photo.png", "image/png");

const job = await (await fetch(`${API}/engines/blur-v1/process`, {

  method: "POST", headers: { ...H, "Content-Type": "application/json" },

  body: JSON.stringify({ params: { strength: 0.5, style: "rx", size: 1024 }, input_files: { image: imageId } }),

})).json();

const st = await wait(job.job_id);

if (st.status !== "completed") throw new Error(JSON.stringify(st.error));

const res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();

for (const out of res.outputs) {                 // blur-v1 declares one slot: "result"

  await fs.writeFile(`${out.slot}.png`, Buffer.from(await (await fetch(out.url)).arrayBuffer()));

}

```

Patterns worth copying​

Treat failed and cancelled as terminal and read error before deciding to resubmit.

Upload once, submit many. An asset id can be reused across jobs.

Delete output assets you have downloaded; they count toward your quota.

