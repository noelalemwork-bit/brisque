QRC GenerateQRC Generate

POST/api/v1/engines/qrc-gen-v2/processliveRun in dashboard ↗Try the API call ↗

Engineqrc-gen-v2
Usage1 credit / run
UpdatedAug 25, 2026

qrc-gen-v1 — generate a sequence from a trained QRC model.

File → JSON1 file slotfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/qrc-gen-v2/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "length": 10,

    "variation": 1

  },

  "input_files": {

    "state": "9f8e7d6c-5b4a-4d21-8abc-def012345678"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptioninitial_eventsarray | nullnonullWarm up the reservoir on these events before generating, instead of the whole vocabulary (the default for a fresh model). Tokens must belong to the model's vocabulary. Ignored when continuing from a state that is itself a prior qrc-gen-v1 output, unless given explicitly to deliberately re-seed the trajectory.lengthintegerno10Number of tokens to generaterandom_seedinteger | nullnonullRNG seed for this call's own generation randomness (softmax sampling) — applied after the model is loaded, not the seed the QRC was trained with (that one is always reused exactly, to reconstruct the reservoir faithfully). None = keep whatever RNG state the model already has (deterministic given the same inputs); give a value to force a specific, reproducible sampling trajectory.shotsinteger | nullnonullMeasurement shots during generation (backend.shots). None = keep whatever shots the model was trained (or last generated) with.variationnumberno1Sampling temperature: low = deterministic/repetitive, high = randomvocabularyarray | nullnonullRelabel the model's output space: the trained reservoir/readout only depend on vocabulary size, not identity, so any vocabulary with the same number of distinct tokens as the model's own can be swapped in — generation then emits from this vocabulary instead. A different size raises incompatible_model (readout shape mismatch).Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionstateapplication/jsonyes
Submitting returns 202 Accepted:
```
{

  "job_id": "1b9d6bcd-2e3f-4a5b-8c7d-9e0f1a2b3c4d",

  "status": "queued",

  "submitted_at": "2026-09-08T14:40:02Z"

}

```

Poll job status until completed, then GET /api/v1/jobs/{job_id}/result returns:
```
{

  "outputs": [

    {

      "slot": "state",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345670",

      "filename": "qrc-gen-v2-1b9d6bcd-state.json",

      "content_type": "application/json",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/state?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 3600 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionstateapplication/jsonyesUpdated reservoir state; chain into a further qrc-gen-v2 call via input_files.state.
Generated from this engine's definition: upload, submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Upload the input as an asset (slot "state": application/json)

path = Path("input.png"); data = path.read_bytes()

asset = requests.post(f"{API}/assets", headers=H,

    json={"filename": path.name, "content_type": "application/json", "size_bytes": len(data)}).json()

requests.put(asset["upload"]["url"], data=data, headers=asset["upload"]["headers"]).raise_for_status()

requests.post(f"{API}/assets/{asset['asset_id']}/complete", headers=H).raise_for_status()

asset_id = asset["asset_id"]

# 2. Submit to qrc-gen-v2

job = requests.post(f"{API}/engines/qrc-gen-v2/process", headers=H,

    json={

        "params": {

            "length": 10,

            "variation": 1

        },

        "input_files": {

            "state": asset_id

        }

    }).json()

# 3. Poll until terminal

while True:

    st = requests.get(f"{API}/jobs/{job['job_id']}/status", headers=H).json()

    if st["status"] in ("completed", "failed", "cancelled"):

        break

    time.sleep(2)

if st["status"] != "completed":

    raise RuntimeError(f"job {st['status']}: {st['error']}")

# 4. Fetch the result — output slots: state

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
# Upload first — see the Assets guide; put the returned asset_id in input_files.

curl -s -X POST https://api.mothquantum.com/api/v1/engines/qrc-gen-v2/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "length": 10,

    "variation": 1

  },

  "input_files": {

    "state": "$ASSET_ID"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
The state input is qrc-train-v1's named binary output (or a prior qrc-gen-v1 call's own
state output) — a plain dict of JSON-safe values (see _to_native) carrying version, the
vocabulary, the training parameters, and the trained readout/reservoir weights. Accepted either
already as that dict (composing engines directly in Python, e.g. in a notebook) or as
JSON-encoded bytes/str (a file upload or job:&lt;id>/state named-output reference — see
features-0.6.md). Rebuilds the QRCGenerator the same way qrc-train-v1 does: load this engine's
own copy of config.yaml and apply the state's training parameters over it — then restores the
trained readout and reservoir memory, and generates a new sequence.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — QRC Generate",

    "summary": "Generate a sequence from a trained QRC model, reused by reference (train once, generate many).",

    "description": "qrc-gen-v1 — generate a sequence from a trained QRC model.",

    "version": "live",

    "x-engine-id": "qrc-gen-v2",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "file-to-json"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 3600,

    "x-registered-at": "2026-08-24T12:45:52Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/qrc-gen-v2"

  },

  "servers": [

    {

      "url": "https://api.mothquantum.com",

      "description": "Moth Quantum API"

    }

  ],

  "security": [

    {

      "bearerAuth": []

    }

  ],

  "paths": {

    "/api/v1/engines/qrc-gen-v2/process": {

      "post": {

        "operationId": "qrc-gen-v2",

        "summary": "QRC Generate",

        "description": "qrc-gen-v1 — generate a sequence from a trained QRC model.",

        "x-error-codes": [],

        "x-output-files": [

          {

            "name": "state",

            "content_types": [

              "application/json"

            ],

            "required": true,

            "description": "Updated reservoir state; chain into a further qrc-gen-v2 call via input_files.state."

          }

        ],

        "tags": [

          "Engine catalog"

        ],

        "security": [

          {

            "bearerAuth": []

          }

        ],

        "requestBody": {

          "required": true,

          "content": {

            "application/json": {

              "schema": {

                "type": "object",

                "properties": {

                  "params": {

                    "properties": {

                      "initial_events": {

                        "anyOf": [

                          {

                            "items": {},

                            "type": "array"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Warm up the reservoir on these events before generating, instead of the whole vocabulary (the default for a fresh model). Tokens must belong to the model's vocabulary. Ignored when continuing from a `state` that is itself a prior qrc-gen-v1 output, unless given explicitly to deliberately re-seed the trajectory.",

                        "title": "Initial Events"

                      },

                      "length": {

                        "default": 10,

                        "description": "Number of tokens to generate",

                        "exclusiveMinimum": 0,

                        "title": "Length",

                        "type": "integer"

                      },

                      "random_seed": {

                        "anyOf": [

                          {

                            "maximum": 4294967295,

                            "minimum": 0,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "RNG seed for this call's own generation randomness (softmax sampling) — applied after the model is loaded, not the seed the QRC was trained with (that one is always reused exactly, to reconstruct the reservoir faithfully). None = keep whatever RNG state the model already has (deterministic given the same inputs); give a value to force a specific, reproducible sampling trajectory.",

                        "title": "Random Seed"

                      },

                      "shots": {

                        "anyOf": [

                          {

                            "maximum": 8192,

                            "minimum": 1,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Measurement shots during generation (backend.shots). None = keep whatever shots the model was trained (or last generated) with.",

                        "title": "Shots"

                      },

                      "variation": {

                        "default": 1,

                        "description": "Sampling temperature: low = deterministic/repetitive, high = random",

                        "exclusiveMinimum": 0,

                        "title": "Variation",

                        "type": "number"

                      },

                      "vocabulary": {

                        "anyOf": [

                          {

                            "items": {},

                            "type": "array"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Relabel the model's output space: the trained reservoir/readout only depend on vocabulary *size*, not identity, so any vocabulary with the same number of distinct tokens as the model's own can be swapped in — generation then emits from this vocabulary instead. A different size raises `incompatible_model` (readout shape mismatch).",

                        "title": "Vocabulary"

                      }

                    },

                    "title": "Params",

                    "type": "object",

                    "description": "Engine parameters, validated against this schema."

                  },

                  "input_files": {

                    "type": "object",

                    "description": "Input slot name → id of an uploaded asset you own.",

                    "properties": {

                      "state": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Accepts: application/json."

                      }

                    },

                    "required": [

                      "state"

                    ]

                  }

                },

                "required": [

                  "params",

                  "input_files"

                ],

                "additionalProperties": false

              }

            }

          }

        },

        "responses": {

          "202": {

            "description": "Job accepted. Poll `GET /jobs/{job_id}/status`.",

            "content": {

              "application/json": {

                "schema": {

                  "$ref": "#/components/schemas/JobAccepted"

                }

              }

            }

          },

          "401": {

            "description": "Unauthorized",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "404": {

            "description": "Not found — no such engine, or not visible to you",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "422": {

            "description": "Params or input files rejected; every violation is listed in `errors[]`",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "429": {

            "description": "Rate limited (300 requests/minute per key)",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          },

          "503": {

            "description": "Job runtime unavailable; retry with backoff",

            "content": {

              "application/problem+json": {

                "schema": {

                  "$ref": "#/components/schemas/Problem"

                }

              }

            }

          }

        },

        "x-codeSamples": [

          {

            "lang": "bash",

            "label": "curl",

            "source": "# Upload first (see the Assets guide) and put the returned asset_id in input_files.\ncurl -s -X POST https://api.mothquantum.com/api/v1/engines/qrc-gen-v2/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"length\": 10,\n    \"variation\": 1\n  },\n  \"input_files\": {\n    \"state\": \"$ASSET_ID\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Upload the input as an asset (slot \"state\": application/json)\npath = Path(\"input.png\"); data = path.read_bytes()\nasset = requests.post(f\"{API}/assets\", headers=H,\n    json={\"filename\": path.name, \"content_type\": \"application/json\", \"size_bytes\": len(data)}).json()\nrequests.put(asset[\"upload\"][\"url\"], data=data, headers=asset[\"upload\"][\"headers\"]).raise_for_status()\nrequests.post(f\"{API}/assets/{asset['asset_id']}/complete\", headers=H).raise_for_status()\nasset_id = asset[\"asset_id\"]\n\n# 2. Submit to qrc-gen-v2\njob = requests.post(f\"{API}/engines/qrc-gen-v2/process\", headers=H,\n    json={\n        \"params\": {\n            \"length\": 10,\n            \"variation\": 1\n        },\n        \"input_files\": {\n            \"state\": asset_id\n        }\n    }).json()\n\n# 3. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 4. Fetch the result — output slots: state\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "import fs from \"node:fs/promises\";\n\nconst API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Upload the input as an asset (slot \"state\")\nconst data = await fs.readFile(\"input.png\");\nconst asset = await (await fetch(`${API}/assets`, { method: \"POST\", headers: json,\n  body: JSON.stringify({ filename: \"input.png\", content_type: \"application/json\", size_bytes: data.byteLength }) })).json();\nawait fetch(asset.upload.url, { method: \"PUT\", headers: asset.upload.headers, body: data });\nawait fetch(`${API}/assets/${asset.asset_id}/complete`, { method: \"POST\", headers: H });\nconst assetId = asset.asset_id;\n\n// Submit\nconst job = await (await fetch(`${API}/engines/qrc-gen-v2/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"length\": 10,\n      \"variation\": 1\n    },\n    \"input_files\": {\n      \"state\": assetId\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: state\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

          }

        ]

      }

    }

  },

  "components": {

    "securitySchemes": {

      "bearerAuth": {

        "type": "http",

        "scheme": "bearer",

        "description": "A moth_ API key from the dashboard."

      }

    },

    "schemas": {

      "JobAccepted": {

        "type": "object",

        "required": [

          "job_id",

          "status",

          "submitted_at"

        ],

        "properties": {

          "job_id": {

            "type": "string"

          },

          "status": {

            "type": "string",

            "enum": [

              "queued"

            ]

          },

          "submitted_at": {

            "type": "string",

            "format": "date-time"

          }

        }

      },

      "Problem": {

        "type": "object",

        "properties": {

          "title": {

            "type": "string"

          },

          "status": {

            "type": "integer"

          },

          "detail": {

            "type": "string"

          },

          "errors": {

            "type": "array",

            "items": {

              "type": "object",

              "properties": {

                "location": {

                  "type": "string"

                },

                "message": {

                  "type": "string"

                },

                "value": {}

              }

            }

          }

        }

      }

    }

  }

}

```

Related engines​

QRC Audio — qrc-audio-v1, Audio → Audio

QRC MIDI — qrc-midi-v1, Audio → Audio

Retrocausal Echo — retrocausal-echo-v1, Audio → Audio

QDrive — qdrive-api-v1, Text → Text

