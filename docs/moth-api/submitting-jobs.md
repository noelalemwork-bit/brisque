Submitting jobsOn this page
Submitting jobs

POST /api/v1/engines/{engineID}/process with a JSON body:

curlPythonJavaScript
```
curl -s -X POST https://api.mothquantum.com/api/v1/engines/blur-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{"params": {"strength": 0.5, "style": "rx"}, "input_files": {"image": "<asset_id>"}}'

```

```
job = requests.post(f"{API}/engines/blur-v1/process", headers=H, json={

    "params": {"strength": 0.5, "style": "rx"},

    "input_files": {"image": asset_id},

}).json()

```

```
const job = await (await fetch(`${API}/engines/blur-v1/process`, {

  method: "POST",

  headers: { ...H, "Content-Type": "application/json" },

  body: JSON.stringify({ params: { strength: 0.5, style: "rx" }, input_files: { image: assetId } }),

})).json();

```

FieldRequiredMeaningparamsif the engine has parametersValidated against the engine's params_schema.input_filesfor engines that declare input slotsSlot name to the id of an asset you uploaded and completed. See Assets.
What happens​

params is validated against the schema. Unknown fields fail: schemas default to additionalProperties: false.

Each input_files entry is checked: the asset must exist, be yours, and be uploaded.

The job is recorded and handed to the engine's worker.

You get 202 Accepted with a job_id. Nothing has run yet.

```
{"job_id": "…", "status": "queued", "submitted_at": "2026-09-08T10:00:00Z"}

```

Validation errors​

One 422 lists every violation, so fix them all in one round trip:

```
{

  "title": "Unprocessable Entity",

  "status": 422,

  "detail": "validation failed",

  "errors": [

    {"location": "body.params.strength", "message": "expected number <= 1", "value": 3},

    {"location": "body.params.mode", "message": "additional properties are not allowed"}

  ]

}

```

Other responses​

StatusMeaning404Unknown engine, or an engine you cannot see.415The engine takes files but the request carried none it could use.422Params or input files rejected. See errors[].429Over 300 requests per minute on this key. Back off.503The job runtime is unavailable. Retry with backoff; nothing was recorded.
Next: Job status and results.
