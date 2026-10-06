TamagotchiTamagotchi

POST/api/v1/engines/tamagotchi-v1/processliveRun in dashboard ↗Try the API call ↗

Enginetamagotchi-v1
Usage0 credits / run
UpdatedAug 27, 2026

Qiskit QEC engine.

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/tamagotchi-v1/process with a JSON body:
```
{

  "params": {

    "code": "steane",

    "method": "stabilizer",

    "n_logical": 1,

    "shots": 1024

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionactionsarraynolist of [gate, target] over logical qubits; gates: I,X,Z,H,S,CX,SEcodestringno"steane"CSS code key (see CODE_REGISTRY)expectedarray | nullnonulloptional expected per-logical outcome; auto-computed if omittedmethodstringno"stabilizer"Aer simulation methodn_logicalintegerno1number of logical qubitsnoiseobjectnoseedinteger | nullnonullsimulator seed for reproducibilityshotsintegerno1024number of measurement shots
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

  "outputs": null,

  "result": "<engine-specific JSON — fields below>"

}

```

result holds this engine's JSON inline. The engine author has not documented its fields yet.A run still going after 30000 s is cancelled and the job ends failed.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to tamagotchi-v1

job = requests.post(f"{API}/engines/tamagotchi-v1/process", headers=H,

    json={

        "params": {

            "code": "steane",

            "method": "stabilizer",

            "n_logical": 1,

            "shots": 1024

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

# 3. Fetch the result — inline JSON

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

print(res["result"])

```

```
curl -s -X POST https://api.mothquantum.com/api/v1/engines/tamagotchi-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "code": "steane",

    "method": "stabilizer",

    "n_logical": 1,

    "shots": 1024

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Turns a declarative list of logical actions into a physical qiskit circuit on a
CSS quantum-error-correcting code, runs it under a noise model on the Aer
stabilizer simulator, and reports how often the logical qubits end up in the
expected computational-basis state.Actions are (gate, target) tuples over logical qubit indices, e.g.::[("X", 0), ("CX", (0, 1)), ("SE", [0, 1])]Single-qubit gates (X/Z/H/S) and CX are applied transversally.
SE is a syndrome-extraction round: ancillas measure the stabilizers and the
error is corrected in-circuit using classically-controlled gates (qiskit's
switch conditions on the full syndrome-register integer, so the nonlinear
Hamming lookup — which qubit to flip — is expressible directly).The engine exposes the platform contract run(params) -> dict plus a separate
validate(params) -> None pre-flight check.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Tamagotchi",

    "summary": "Cute little thingy",

    "description": "Qiskit QEC engine.",

    "version": "live",

    "x-engine-id": "tamagotchi-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 0,

    "x-timeout-seconds": 30000,

    "x-registered-at": "2026-08-27T16:00:16Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/tamagotchi-v1"

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

    "/api/v1/engines/tamagotchi-v1/process": {

      "post": {

        "operationId": "tamagotchi-v1",

        "summary": "Tamagotchi",

        "description": "Qiskit QEC engine.",

        "x-error-codes": [],

        "x-output-files": [],

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

                      "actions": {

                        "description": "list of [gate, target] over logical qubits; gates: I,X,Z,H,S,CX,SE",

                        "items": {},

                        "title": "Actions",

                        "type": "array"

                      },

                      "code": {

                        "default": "steane",

                        "description": "CSS code key (see CODE_REGISTRY)",

                        "title": "Code",

                        "type": "string"

                      },

                      "expected": {

                        "anyOf": [

                          {

                            "items": {

                              "type": "integer"

                            },

                            "type": "array"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "optional expected per-logical outcome; auto-computed if omitted",

                        "title": "Expected"

                      },

                      "method": {

                        "default": "stabilizer",

                        "description": "Aer simulation method",

                        "title": "Method",

                        "type": "string"

                      },

                      "n_logical": {

                        "default": 1,

                        "description": "number of logical qubits",

                        "title": "N Logical",

                        "type": "integer"

                      },

                      "noise": {

                        "$ref": "#/components/schemas/tamagotchi-v1__NoiseParams"

                      },

                      "seed": {

                        "anyOf": [

                          {

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "simulator seed for reproducibility",

                        "title": "Seed"

                      },

                      "shots": {

                        "default": 1024,

                        "description": "number of measurement shots",

                        "title": "Shots",

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/tamagotchi-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"code\": \"steane\",\n    \"method\": \"stabilizer\",\n    \"n_logical\": 1,\n    \"shots\": 1024\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to tamagotchi-v1\njob = requests.post(f\"{API}/engines/tamagotchi-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"code\": \"steane\",\n            \"method\": \"stabilizer\",\n            \"n_logical\": 1,\n            \"shots\": 1024\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/tamagotchi-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"code\": \"steane\",\n      \"method\": \"stabilizer\",\n      \"n_logical\": 1,\n      \"shots\": 1024\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

      },

      "tamagotchi-v1__NoiseParams": {

        "properties": {

          "p_1q": {

            "default": 0,

            "description": "1-qubit gate depolarizing probability",

            "title": "P 1Q",

            "type": "number"

          },

          "p_gate": {

            "default": 0,

            "description": "2-qubit gate depolarizing probability",

            "title": "P Gate",

            "type": "number"

          },

          "p_idle": {

            "default": 0,

            "description": "idle depolarizing probability on data qubits",

            "title": "P Idle",

            "type": "number"

          },

          "p_meas": {

            "default": 0,

            "description": "measurement (readout) flip probability",

            "title": "P Meas",

            "type": "number"

          }

        },

        "title": "NoiseParams",

        "type": "object"

      }

    }

  }

}

```

Related engines​

Coin Toss — coin-toss-v1, JSON → JSON

Qpixl — qpixl-v1, JSON → JSON

Quantum Blur Core — blur-core-v1, JSON → JSON

Quantum Echo — otoc-echo-v1, JSON → JSON

