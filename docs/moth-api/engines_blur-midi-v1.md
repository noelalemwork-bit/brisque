Blur JazzBlur Jazz

POST/api/v1/engines/blur-midi-v1/processliveRun in dashboard ↗Try the API call ↗

Engineblur-midi-v1
Usage1 credit / run
UpdatedAug 28, 2026

A unitary, information-preserving blur applied to MIDI piano rolls.

Audio → Audio1 file slotfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/blur-midi-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "margin": 0.15,

    "qubits": 20,

    "reach": 0,

    "resolution": 0,

    "strength": 0.5,

    "threshold": 0.1

  },

  "input_files": {

    "midi": "9f8e7d6c-5b4a-4d21-8abc-def012345678"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionmarginnumber | nullno0.15Fraction of the active pitch span to pad above and below before blurring, giving the blur room to spread into adjacent pitches. 0 — no padding; blur is hard-clipped at the boundary notes. Default 0.15.maskarray | nullnonullList of regions to blur, each as [track_index, start_seconds, end_seconds]. When omitted every note track is blurred in full. Tracks and time ranges not covered by the mask pass through unchanged. Example: [[1, 0.5, 2.0], [2, 1.0, 3.5]].qubitsintegerno20Qubit budget per blur pass (4–20). Determines the largest piano-roll tile the quantum simulator handles in one shot; larger values avoid tiling but require more simulation memory. Default 20. (min 4, max 20)reachnumberno0Non-locality of the blur:  - 0 — fully local: only neighbouring pitches/times mix. - 1 — fully non-local: any pitch can mix with any other. (min 0, max 1)resolutionintegerno0Number of MIDI ticks per piano-roll step (integer ≥ 0). 0 (default) — auto: uses the 5th-percentile note duration, robust to sequencer-artefact grace notes. Any positive value sets the step size directly; larger values produce a coarser grid and faster blur. (min 0)strengthnumberno0.5Blur strength (0 = unchanged, 1 = maximum). (min 0, max 1)thresholdnumberno0.1Relative noise gate: a velocity delta must exceed threshold × max_velocity_in_roll to emit a note. Scales with the loudest note so it suppresses artefacts proportionally regardless of the overall dynamic level. Default 0.1. (min 0, max 1)Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionmidiaudio/midi, audio/midyesThe MIDI file to process. Supported formats: MIDI 0, 1, and 2. Output is returned in the same format and tick resolution as the input.
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

      "slot": "result",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345670",

      "filename": "blur-midi-v1-1b9d6bcd-result.mid",

      "content_type": "audio/midi",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 18000 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultaudio/midiyesThe blurred MIDI file, in the same SMF type and tick resolution as the input.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_midiThe MIDI file could not be parsed (corrupt, truncated, or not a valid SMF file).no_notesThe MIDI file contains no note_on events — nothing to blur.invalid_paramsOne or more params fields failed Pydantic validation.blur_failedThe quantum blur circuit failed on a piano-roll tile.encoding_failedThe blurred piano roll could not be re-encoded as a MIDI file.
Generated from this engine's definition: upload, submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Upload the input as an asset (slot "midi": audio/midi, audio/mid)

path = Path("input.png"); data = path.read_bytes()

asset = requests.post(f"{API}/assets", headers=H,

    json={"filename": path.name, "content_type": "audio/midi", "size_bytes": len(data)}).json()

requests.put(asset["upload"]["url"], data=data, headers=asset["upload"]["headers"]).raise_for_status()

requests.post(f"{API}/assets/{asset['asset_id']}/complete", headers=H).raise_for_status()

asset_id = asset["asset_id"]

# 2. Submit to blur-midi-v1

job = requests.post(f"{API}/engines/blur-midi-v1/process", headers=H,

    json={

        "params": {

            "margin": 0.15,

            "qubits": 20,

            "reach": 0,

            "resolution": 0,

            "strength": 0.5,

            "threshold": 0.1

        },

        "input_files": {

            "midi": asset_id

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

# 4. Fetch the result — output slots: result

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
# Upload first — see the Assets guide; put the returned asset_id in input_files.

curl -s -X POST https://api.mothquantum.com/api/v1/engines/blur-midi-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "margin": 0.15,

    "qubits": 20,

    "reach": 0,

    "resolution": 0,

    "strength": 0.5,

    "threshold": 0.1

  },

  "input_files": {

    "midi": "$ASSET_ID"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Instead of shifting notes by a fixed interval or time offset, Quantum Blur
scatters every note across every other note at once. The result sounds like a
quantum echo — pitches and rhythmic patterns from one moment and register
reappear, rearranged and faintly, throughout the rest of the piece.The effect works by representing each MIDI track as a list of multi-stack piano
rolls (note × time), blurring each stack as though it were a height map, then
reconstructing MIDI note events from the blurred stacks.How to use​
Invoke the engine with a JSON params payload and one MIDI file attached:
midi — required. Standard MIDI file (.mid/.midi), SMF type 0, 1, or 2.

Optional params:
strength — blur strength (0 = unchanged, 1 = maximum). Default 0.5.

reach — non-locality of the blur: 0 is fully local (only neighbouring
pitches/times mix); 1 is maximally non-local. Default 0.0.

qubits — qubit budget per blur pass (4–20); determines the largest piano-roll
tile handled in one quantum simulation. Default 20.

threshold — relative noise gate: a velocity delta must exceed
threshold × max_velocity_in_roll to emit a note event. Suppresses
low-energy blur artefacts proportionally to the loudest note. Default 0.1.

resolution — number of MIDI ticks per piano-roll step. 0 (default) =
auto-detect as the 5th-percentile note duration (robust to grace-note
artefacts). Any positive integer sets the step size directly, e.g. 120
groups 120 ticks per step. Default 0.

margin — fraction of the active pitch span to pad above and below before
blurring, giving the blur room to spread into adjacent pitches. Default 0.15.

mask — list of [track_index, start_seconds, end_seconds] entries that
define which regions to blur. When omitted every note track is blurred in
full. Tracks and time ranges not in the mask pass through unchanged.

Output​
Returns the processed MIDI in the same SMF type and tick resolution as the
input (audio/midi). SMF types 0, 1, and 2 are all preserved.
Note: only SMF (MIDI 1.0 file format) is supported — MIDI 2.0 is not.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Blur Jazz",

    "summary": "Apply a quantum blur effect to a MIDI file.",

    "description": "A unitary, information-preserving blur applied to MIDI piano rolls.",

    "version": "live",

    "x-engine-id": "blur-midi-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "audio-to-audio"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 18000,

    "x-registered-at": "2026-08-28T07:44:24Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/blur-midi-v1"

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

    "/api/v1/engines/blur-midi-v1/process": {

      "post": {

        "operationId": "blur-midi-v1",

        "summary": "Blur Jazz",

        "description": "A unitary, information-preserving blur applied to MIDI piano rolls.",

        "x-error-codes": [

          {

            "type": "invalid_midi",

            "description": "The MIDI file could not be parsed (corrupt, truncated, or not a valid SMF file)."

          },

          {

            "type": "no_notes",

            "description": "The MIDI file contains no note_on events — nothing to blur."

          },

          {

            "type": "invalid_params",

            "description": "One or more params fields failed Pydantic validation."

          },

          {

            "type": "blur_failed",

            "description": "The quantum blur circuit failed on a piano-roll tile."

          },

          {

            "type": "encoding_failed",

            "description": "The blurred piano roll could not be re-encoded as a MIDI file."

          }

        ],

        "x-output-files": [

          {

            "name": "result",

            "content_types": [

              "audio/midi"

            ],

            "required": true,

            "description": "The blurred MIDI file, in the same SMF type and tick resolution as the input."

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

                      "margin": {

                        "anyOf": [

                          {

                            "maximum": 1,

                            "minimum": 0,

                            "type": "number"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": 0.15,

                        "description": "Fraction of the active pitch span to pad above and below before blurring, giving the blur room to spread into adjacent pitches. `0` — no padding; blur is hard-clipped at the boundary notes. Default 0.15.",

                        "title": "Margin"

                      },

                      "mask": {

                        "anyOf": [

                          {

                            "items": {

                              "maxItems": 3,

                              "minItems": 3,

                              "prefixItems": [

                                {

                                  "type": "integer"

                                },

                                {

                                  "type": "number"

                                },

                                {

                                  "type": "number"

                                }

                              ],

                              "type": "array"

                            },

                            "type": "array"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "List of regions to blur, each as [track_index, start_seconds, end_seconds]. When omitted every note track is blurred in full. Tracks and time ranges not covered by the mask pass through unchanged. Example: [[1, 0.5, 2.0], [2, 1.0, 3.5]].",

                        "title": "Mask"

                      },

                      "qubits": {

                        "default": 20,

                        "description": "Qubit budget per blur pass (4–20). Determines the largest piano-roll tile the quantum simulator handles in one shot; larger values avoid tiling but require more simulation memory. Default 20.",

                        "maximum": 20,

                        "minimum": 4,

                        "title": "Qubits",

                        "type": "integer"

                      },

                      "reach": {

                        "default": 0,

                        "description": "Non-locality of the blur:\n\n- `0` — fully local: only neighbouring pitches/times mix.\n- `1` — fully non-local: any pitch can mix with any other.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Reach",

                        "type": "number"

                      },

                      "resolution": {

                        "default": 0,

                        "description": "Number of MIDI ticks per piano-roll step (integer ≥ 0). `0` (default) — auto: uses the 5th-percentile note duration, robust to sequencer-artefact grace notes. Any positive value sets the step size directly; larger values produce a coarser grid and faster blur.",

                        "minimum": 0,

                        "title": "Resolution",

                        "type": "integer"

                      },

                      "strength": {

                        "default": 0.5,

                        "description": "Blur strength (0 = unchanged, 1 = maximum).",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Strength",

                        "type": "number"

                      },

                      "threshold": {

                        "default": 0.1,

                        "description": "Relative noise gate: a velocity delta must exceed threshold × max_velocity_in_roll to emit a note. Scales with the loudest note so it suppresses artefacts proportionally regardless of the overall dynamic level. Default 0.1.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Threshold",

                        "type": "number"

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

                      "midi": {

                        "type": "string",

                        "format": "uuid",

                        "description": "The MIDI file to process. Supported formats: MIDI 0, 1, and 2. Output is returned in the same format and tick resolution as the input. Accepts: audio/midi, audio/mid."

                      }

                    },

                    "required": [

                      "midi"

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

            "source": "# Upload first (see the Assets guide) and put the returned asset_id in input_files.\ncurl -s -X POST https://api.mothquantum.com/api/v1/engines/blur-midi-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"margin\": 0.15,\n    \"qubits\": 20,\n    \"reach\": 0,\n    \"resolution\": 0,\n    \"strength\": 0.5,\n    \"threshold\": 0.1\n  },\n  \"input_files\": {\n    \"midi\": \"$ASSET_ID\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Upload the input as an asset (slot \"midi\": audio/midi, audio/mid)\npath = Path(\"input.png\"); data = path.read_bytes()\nasset = requests.post(f\"{API}/assets\", headers=H,\n    json={\"filename\": path.name, \"content_type\": \"audio/midi\", \"size_bytes\": len(data)}).json()\nrequests.put(asset[\"upload\"][\"url\"], data=data, headers=asset[\"upload\"][\"headers\"]).raise_for_status()\nrequests.post(f\"{API}/assets/{asset['asset_id']}/complete\", headers=H).raise_for_status()\nasset_id = asset[\"asset_id\"]\n\n# 2. Submit to blur-midi-v1\njob = requests.post(f\"{API}/engines/blur-midi-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"margin\": 0.15,\n            \"qubits\": 20,\n            \"reach\": 0,\n            \"resolution\": 0,\n            \"strength\": 0.5,\n            \"threshold\": 0.1\n        },\n        \"input_files\": {\n            \"midi\": asset_id\n        }\n    }).json()\n\n# 3. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 4. Fetch the result — output slots: result\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "import fs from \"node:fs/promises\";\n\nconst API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Upload the input as an asset (slot \"midi\")\nconst data = await fs.readFile(\"input.png\");\nconst asset = await (await fetch(`${API}/assets`, { method: \"POST\", headers: json,\n  body: JSON.stringify({ filename: \"input.png\", content_type: \"audio/midi\", size_bytes: data.byteLength }) })).json();\nawait fetch(asset.upload.url, { method: \"PUT\", headers: asset.upload.headers, body: data });\nawait fetch(`${API}/assets/${asset.asset_id}/complete`, { method: \"POST\", headers: H });\nconst assetId = asset.asset_id;\n\n// Submit\nconst job = await (await fetch(`${API}/engines/blur-midi-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"margin\": 0.15,\n      \"qubits\": 20,\n      \"reach\": 0,\n      \"resolution\": 0,\n      \"strength\": 0.5,\n      \"threshold\": 0.1\n    },\n    \"input_files\": {\n      \"midi\": assetId\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

QRC MIDI — qrc-midi-v1, Audio → Audio

Entanglement Shader — entanglement-shader-v1, JSON → File

QRC Train — qrc-train-v2, JSON → JSON

Quantum Blur — blur-v1, Image → Image

