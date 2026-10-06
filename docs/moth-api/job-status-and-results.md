Job status & resultsOn this page
Job status and results

Status values​

```
queued ──▶ processing ──▶ completed

                     └──▶ failed

                     └──▶ cancelled

```

completed, failed, and cancelled are terminal and never change. A job only moves forward; a stale read never shows it going back. Workers may report transient states such as fetching while processing; treat anything not in the list above as processing.

Polling​

curlPythonJavaScript
```
# JOB_ID is the job_id from your submit response

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

```

```
def wait(job_id):

    while True:

        st = requests.get(f"{API}/jobs/{job_id}/status", headers=H).json()

        if st["status"] in ("completed", "failed", "cancelled"):

            return st

        time.sleep(2)

```

```
async function wait(jobId) {

  for (;;) {

    const st = await (await fetch(`${API}/jobs/${jobId}/status`, { headers: H })).json();

    if (["completed", "failed", "cancelled"].includes(st.status)) return st;

    await new Promise(r => setTimeout(r, 2000));

  }

}

```

```
{

  "job_id": "…", "engine_id": "blur-v1", "status": "completed",

  "submitted_at": "…", "updated_at": "…",

  "outputs": [{"slot": "result", "output_asset_id": "…", "content_type": "image/png"}],

  "progress": null, "warnings": null, "error": null

}

```

outputs lists each output file the job has produced so far, one per declared slot.

error is set on failure: {type, message, retryable}. retryable: true means resubmitting may succeed.

Poll every two to five seconds. There is no webhook today.

GET /jobs/{jobID} returns the last persisted row without asking the runtime, and GET /jobs lists your jobs newest first with cursor pagination. Use them for history; use /status for live state.

Fetching the result​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

```
res = requests.get(f"{API}/jobs/{job_id}/result", headers=H).json()

for out in res.get("outputs") or []:

    open(out["slot"], "wb").write(requests.get(out["url"]).content)

print(res.get("result"))

```

```
const res = await (await fetch(`${API}/jobs/${jobId}/result`, { headers: H })).json();

for (const out of res.outputs ?? []) {

  const bytes = Buffer.from(await (await fetch(out.url)).arrayBuffer());

  await fs.promises.writeFile(out.slot, bytes);

}

console.log(res.result);

```

Two shapes, decided by the engine:

File outputs. One entry per declared output slot, each with a presigned url that needs no auth header and expires at expires_at. Every output is also an asset you own, so it is listed under your assets and can be downloaded again later.

```
{

  "outputs": [

    {

      "slot": "result",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345678",

      "filename": "blur-v1-1b9d6bcd-result.png",

      "content_type": "image/png",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Inline result. Engines that produce no files return JSON in result. This lives with the job runtime and is not kept as an asset.

```
{"result": {"counts": {"0": 4, "1": 6}}}

```

Result status codes​

StatusMeaning409Not finished yet, or the job failed. Check /status.410Finished, but no result is retrievable any more. File outputs survive as assets; an inline result that has aged out of the runtime is gone.404Not your job, or no such job.
Retention​

File outputs are stored as assets and count toward your storage quota. Delete them like any asset when you no longer need them. Inline JSON results are retained only for a limited time by the job runtime; copy what you need when you fetch it.
