EnginesOn this page
Engines

An engine is a registered quantum program. The catalog tells you what each one accepts and produces; the Engines renders the same data as pages.

Reading an engine definition​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/engines/blur-v1 -H "Authorization: Bearer $MOTH_API_KEY"

```

```
engine = requests.get(f"{API}/engines/blur-v1", headers=H).json()

print(engine["params_schema"], engine["input_files"], engine["output_files"])

```

```
const engine = await (await fetch(`${API}/engines/blur-v1`, { headers: H })).json();

console.log(engine.params_schema, engine.input_files, engine.output_files);

```

The fields you use when calling it:

FieldMeaningengine_idThe id in the URL, for example blur-v1.params_schemaJSON Schema for the params object you send. Unknown fields are rejected.input_filesNamed file slots the engine reads. Each has accepted MIME types and whether it is required. You upload the file as an asset and pass its id under the slot name.output_filesNamed output slots the engine writes. Each completed job returns one asset per slot.credits_per_runCost of one job.run_policy.timeoutSeconds a run may take before it fails.error_codesEngine-specific failure codes you may see in a 422.visibility, ownerpublic engines are visible to everyone. private ones only to their owner.
The fields queue, sidecar_endpoint, has_* and estimate* are internal to the runtime. Ignore them.

Public and private​

Listing engines returns every public engine plus your own private ones. Another user's private engine is a 404. There is no way to discover it, and no 403 that would confirm it exists.

Publishing your own engine​

Engines are registered with POST /api/v1/engines and updated with PATCH /api/v1/engines/{engineID}. New engines default to visibility: private and credits_per_run: 1. The engine_id and owner are fixed at creation. Built-in engines owned by moth cannot be changed through the API.

Registering the definition is the catalog half. The engine's worker is deployed separately; see the engine authoring guides in the moth-quantum GitHub organisation. Until a worker is running, jobs for the engine queue and time out.

Reference​

List engines, Get engine, Create engine, Update engine.

