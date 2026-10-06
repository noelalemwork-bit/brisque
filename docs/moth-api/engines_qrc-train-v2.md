QRC TrainQRC Train

POST/api/v1/engines/qrc-train-v2/processliveRun in dashboard ↗Try the API call ↗

Engineqrc-train-v2
Usage5 credits / run
UpdatedAug 25, 2026

qrc-train-v1 — train a quantum reservoir on a token sequence, emit a reusable model artifact.

JSON → JSONfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/qrc-train-v2/process with a JSON body:
```
{

  "params": {

    "epochs": 50,

    "mixing": 0.7,

    "mode": "order",

    "num_qubits": 5,

    "num_random_gates": 10,

    "periodic": true,

    "sample_fraction": 1,

    "sample_length": 15,

    "sequence": [

      1,

      2,

      3,

      2,

      1,

      1,

      2,

      3,

      2,

      1,

      1,

      2,

      3,

      2,

      1,

      1,

      2,

      3,

      2,

      1

    ],

    "shots": 3000,

    "washout": 5

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionepochsintegerno50Readout training epochs (readout.epoch) (min 1, max 500)mixingnumberno0.7How much each reservoir step replaces its memory (reservoir.mixing); 1 = fully replaced (max 1)modestringno"order"Window-sampling mode (handler.mode) (one of random, order, stride)num_qubitsintegerno5Reservoir qubits (reservoir.num_qubits) (min 2, max 12)num_random_gatesintegerno10Random gates mixed into each reservoir step (reservoir.num_random_gates) (min 0, max 100)periodicbooleannotrueAllow windows to wrap past the end of the sequence (handler.periodic)sample_fractionnumberno1Fraction of the candidate windows mode can produce that are kept, via quasi-random subsampling (handler.sample_fraction) (max 1)sample_lengthintegerno15Window length (handler.sample_length) (min 1, max 256)seedinteger | nullnonullTop-level RNG seed shared by every component that doesn't set its own (config.seed). None = pick a random seed for this run; it's recorded in the returned model's state, so the exact run can be reproduced later by passing it back explicitly.sequencearrayno[1,2,3,2,1,1,2,3,2,1,1,2,3,2,1,1,2,3,2,1]Tokens to train on — any hashable values (ints, strings, ...) forming a unique setshotsintegerno3000Measurement shots (backend.shots) (min 1, max 8192)vocabularyarray | nullnonullFixed vocabulary covering the full input space (e.g. all MIDI pitches, all ascii chars). None = derive the vocabulary from the sequence's own distinct tokens, in the order they first appear (default).washoutintegerno5Washout period; must be < sample_length (readout.washout). (max 255)
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

      "filename": "qrc-train-v2-1b9d6bcd-state.json",

      "content_type": "application/json",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/state?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 3600 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionstateapplication/jsonyesTrained reservoir state; reuse in qrc-gen-v2 via input_files.state (train once, generate many).
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to qrc-train-v2

job = requests.post(f"{API}/engines/qrc-train-v2/process", headers=H,

    json={

        "params": {

            "epochs": 50,

            "mixing": 0.7,

            "mode": "order",

            "num_qubits": 5,

            "num_random_gates": 10,

            "periodic": True,

            "sample_fraction": 1,

            "sample_length": 15,

            "sequence": [

                1,

                2,

                3,

                2,

                1,

                1,

                2,

                3,

                2,

                1,

                1,

                2,

                3,

                2,

                1,

                1,

                2,

                3,

                2,

                1

            ],

            "shots": 3000,

            "washout": 5

        }

    }).json()

# 2. Poll until terminal

while True:

    st = requests.get(f"{API}/jobs/{job['job_id']}/status", headers=H).json()

    if st["status"] in ("completed", "failed", "cancelled"):

        break

    time.sleep(2)

if st["status"] != "completed":

    raise RuntimeError(f"job {st['status']}: {st['error']}")

# 3. Fetch the result — output slots: state

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
curl -s -X POST https://api.mothquantum.com/api/v1/engines/qrc-train-v2/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "epochs": 50,

    "mixing": 0.7,

    "mode": "order",

    "num_qubits": 5,

    "num_random_gates": 10,

    "periodic": true,

    "sample_fraction": 1,

    "sample_length": 15,

    "sequence": [

      1,

      2,

      3,

      2,

      1,

      1,

      2,

      3,

      2,

      1,

      1,

      2,

      3,

      2,

      1,

      1,

      2,

      3,

      2,

      1

    ],

    "shots": 3000,

    "washout": 5

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Trains via qrc.generator.QRCGenerator (Qiskit Aer backend). The event <-> index vocabulary
(a SequenceMapping) is fixed up front from the request's tokens, since the new library sizes
the readout from it and does not refit one during learn(). Returns the training loss inline as
output, and the trained state (vocabulary, training params, readout weights + reservoir
memory — everything qrc-gen-v1 needs to rebuild an identical generator and load it, version
included) as the named binary output state (archaeo-sdk's named-binary-output + JSON envelope,
see features-0.6.md) — pass it straight through as qrc-gen-v1's own state input.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — QRC Train",

    "summary": "Train a quantum reservoir on a token sequence and emit a reusable model artifact.",

    "description": "qrc-train-v1 — train a quantum reservoir on a token sequence, emit a reusable model artifact.",

    "version": "live",

    "x-engine-id": "qrc-train-v2",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 5,

    "x-timeout-seconds": 3600,

    "x-registered-at": "2026-08-24T12:42:06Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/qrc-train-v2"

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

    "/api/v1/engines/qrc-train-v2/process": {

      "post": {

        "operationId": "qrc-train-v2",

        "summary": "QRC Train",

        "description": "qrc-train-v1 — train a quantum reservoir on a token sequence, emit a reusable model artifact.",

        "x-error-codes": [],

        "x-output-files": [

          {

            "name": "state",

            "content_types": [

              "application/json"

            ],

            "required": true,

            "description": "Trained reservoir state; reuse in qrc-gen-v2 via input_files.state (train once, generate many)."

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

                      "epochs": {

                        "default": 50,

                        "description": "Readout training epochs (readout.epoch)",

                        "maximum": 500,

                        "minimum": 1,

                        "title": "Epochs",

                        "type": "integer"

                      },

                      "mixing": {

                        "default": 0.7,

                        "description": "How much each reservoir step replaces its memory (reservoir.mixing); 1 = fully replaced",

                        "exclusiveMinimum": 0,

                        "maximum": 1,

                        "title": "Mixing",

                        "type": "number"

                      },

                      "mode": {

                        "default": "order",

                        "description": "Window-sampling mode (handler.mode)",

                        "enum": [

                          "random",

                          "order",

                          "stride"

                        ],

                        "title": "Mode",

                        "type": "string"

                      },

                      "num_qubits": {

                        "default": 5,

                        "description": "Reservoir qubits (reservoir.num_qubits)",

                        "maximum": 12,

                        "minimum": 2,

                        "title": "Num Qubits",

                        "type": "integer"

                      },

                      "num_random_gates": {

                        "default": 10,

                        "description": "Random gates mixed into each reservoir step (reservoir.num_random_gates)",

                        "maximum": 100,

                        "minimum": 0,

                        "title": "Num Random Gates",

                        "type": "integer"

                      },

                      "periodic": {

                        "default": true,

                        "description": "Allow windows to wrap past the end of the sequence (handler.periodic)",

                        "title": "Periodic",

                        "type": "boolean"

                      },

                      "sample_fraction": {

                        "default": 1,

                        "description": "Fraction of the candidate windows `mode` can produce that are kept, via quasi-random subsampling (handler.sample_fraction)",

                        "exclusiveMinimum": 0,

                        "maximum": 1,

                        "title": "Sample Fraction",

                        "type": "number"

                      },

                      "sample_length": {

                        "default": 15,

                        "description": "Window length (handler.sample_length)",

                        "maximum": 256,

                        "minimum": 1,

                        "title": "Sample Length",

                        "type": "integer"

                      },

                      "seed": {

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

                        "description": "Top-level RNG seed shared by every component that doesn't set its own (config.seed). None = pick a random seed for this run; it's recorded in the returned model's state, so the exact run can be reproduced later by passing it back explicitly.",

                        "title": "Seed"

                      },

                      "sequence": {

                        "default": [

                          1,

                          2,

                          3,

                          2,

                          1,

                          1,

                          2,

                          3,

                          2,

                          1,

                          1,

                          2,

                          3,

                          2,

                          1,

                          1,

                          2,

                          3,

                          2,

                          1

                        ],

                        "description": "Tokens to train on — any hashable values (ints, strings, ...) forming a unique set",

                        "items": {},

                        "title": "Sequence",

                        "type": "array"

                      },

                      "shots": {

                        "default": 3000,

                        "description": "Measurement shots (backend.shots)",

                        "maximum": 8192,

                        "minimum": 1,

                        "title": "Shots",

                        "type": "integer"

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

                        "description": "Fixed vocabulary covering the full input space (e.g. all MIDI pitches, all ascii chars). None = derive the vocabulary from the sequence's own distinct tokens, in the order they first appear (default).",

                        "title": "Vocabulary"

                      },

                      "washout": {

                        "default": 5,

                        "description": "Washout period; must be < sample_length (readout.washout).",

                        "exclusiveMinimum": 1,

                        "maximum": 255,

                        "title": "Washout",

                        "type": "integer"

                      }

                    },

                    "title": "Params",

                    "type": "object",

                    "description": "Engine parameters, validated against this schema."

                  }

                },

                "required": [

                  "params"

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/qrc-train-v2/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"epochs\": 50,\n    \"mixing\": 0.7,\n    \"mode\": \"order\",\n    \"num_qubits\": 5,\n    \"num_random_gates\": 10,\n    \"periodic\": true,\n    \"sample_fraction\": 1,\n    \"sample_length\": 15,\n    \"sequence\": [\n      1,\n      2,\n      3,\n      2,\n      1,\n      1,\n      2,\n      3,\n      2,\n      1,\n      1,\n      2,\n      3,\n      2,\n      1,\n      1,\n      2,\n      3,\n      2,\n      1\n    ],\n    \"shots\": 3000,\n    \"washout\": 5\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to qrc-train-v2\njob = requests.post(f\"{API}/engines/qrc-train-v2/process\", headers=H,\n    json={\n        \"params\": {\n            \"epochs\": 50,\n            \"mixing\": 0.7,\n            \"mode\": \"order\",\n            \"num_qubits\": 5,\n            \"num_random_gates\": 10,\n            \"periodic\": True,\n            \"sample_fraction\": 1,\n            \"sample_length\": 15,\n            \"sequence\": [\n                1,\n                2,\n                3,\n                2,\n                1,\n                1,\n                2,\n                3,\n                2,\n                1,\n                1,\n                2,\n                3,\n                2,\n                1,\n                1,\n                2,\n                3,\n                2,\n                1\n            ],\n            \"shots\": 3000,\n            \"washout\": 5\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — output slots: state\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/qrc-train-v2/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"epochs\": 50,\n      \"mixing\": 0.7,\n      \"mode\": \"order\",\n      \"num_qubits\": 5,\n      \"num_random_gates\": 10,\n      \"periodic\": true,\n      \"sample_fraction\": 1,\n      \"sample_length\": 15,\n      \"sequence\": [\n        1,\n        2,\n        3,\n        2,\n        1,\n        1,\n        2,\n        3,\n        2,\n        1,\n        1,\n        2,\n        3,\n        2,\n        1,\n        1,\n        2,\n        3,\n        2,\n        1\n      ],\n      \"shots\": 3000,\n      \"washout\": 5\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: state\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

Blur Jazz — blur-midi-v1, Audio → Audio

Entanglement Shader — entanglement-shader-v1, JSON → File

Quantum Blur — blur-v1, Image → Image

Quantum Teleblur — telablur-v1, Image → Image

