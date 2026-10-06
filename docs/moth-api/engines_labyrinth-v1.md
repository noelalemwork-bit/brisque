Quantum Labyrinth EngineQuantum Labyrinth Engine

POST/api/v1/engines/labyrinth-v1/processliveRun in dashboard ↗Try the API call ↗

Enginelabyrinth-v1
PublisherMoth
Usage5 credits / run
UpdatedSep 10, 2026

Quantum Labyrinth Engine — turn a level blueprint into a quantum-generated maze.

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/labyrinth-v1/process with a JSON body:
```
{

  "params": {

    "fraction": 0.3333333333333333,

    "k": 3,

    "mode": "emu",

    "shots": 4096,

    "steps": 3,

    "top_n": 16

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionbackend_namestring | nullnonullIBM backend to target; omit to auto-select the least busy device. Ignored when mode='emu'.fractionnumberno0.3333333333333333Strength of each ZZ prep step, as a fraction of a full rotation. (max 1)kintegerno3Tomography correlation length: expectation values tracked over paths of k connected qubits; higher is more faithful but costlier (max 4). (min 1, max 4)level_dataobjectnoLevel definition: grid size, qubit count, coupling map, and initial states.modestringno"emu"'emu' runs on a local Aer simulator; 'qpu' submits to IBM hardware. (one of emu, qpu)qpu_instancestring | nullnonullIBM Quantum instance CRN; falls back to IBM_QUANTUM_INSTANCE env var.qpu_tokenstring | nullnonullIBM Quantum API token; falls back to IBM_QUANTUM_TOKEN env var.shotsintegerno4096Number of measurement shots (max 10,000). (max 10000)stepsintegerno3Number of ZZ prep sweeps over the lattice (max 5). (min 1, max 5)top_nintegerno16Most-probable measurements kept in the output; -1 keeps all. (min -1)
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

result holds this engine's JSON inline. The engine author has not documented its fields yet.A run still going after 300 s is cancelled and the job ends failed.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_levellevel_data validation failed — missing grid_size, num_qubits, or coupling_map.graph_init_failedQuantumGraph initialization failed.prep_failedZZ state preparation loop failed.emu_cap_exceedednum_qubits exceeds the local-simulation cap; use mode="qpu" for larger lattices.simulation_failedAer simulation failed.ibm_auth_failedIBM authentication failed — IBM_QUANTUM_TOKEN missing or invalid.backend_too_smalllevel_data requires more qubits than the selected IBM backend provides.ibm_submission_failedCircuit submission to the IBM QPU failed.ibm_collection_failedCould not retrieve QPU result — job may have been cancelled or backend errored.invalid_paramsParameter validation failed.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to labyrinth-v1

job = requests.post(f"{API}/engines/labyrinth-v1/process", headers=H,

    json={

        "params": {

            "fraction": 0.3333333333333333,

            "k": 3,

            "mode": "emu",

            "shots": 4096,

            "steps": 3,

            "top_n": 16

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
curl -s -X POST https://api.mothquantum.com/api/v1/engines/labyrinth-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "fraction": 0.3333333333333333,

    "k": 3,

    "mode": "emu",

    "shots": 4096,

    "steps": 3,

    "top_n": 16

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
You describe a maze as a grid of rooms and say which neighbouring rooms connect.
The engine turns each connection into a two-qubit correlation, prepares that
quantum state, samples it (locally or on IBM hardware), and returns level data
your game can render directly.What you send​
application/json:
```
{

  "level_data": {

    "grid_size": {"rows": 4, "cols": 4},

    "num_qubits": 16,

    "coupling_map": [[0, 4], [1, 5], [4, 5], [5, 9]]

  },

  "shots": 4096,

  "mode": "emu"

}

```

level_data.grid_size — rows × cols; one room per cell.

level_data.num_qubits — must equal rows * cols (one qubit per room).

level_data.coupling_map — the adjacent room pairs that should be open
corridors. Any grid-adjacent pair not listed becomes a wall. Rooms are
numbered row-major (room r*cols + c); only horizontal/vertical neighbours are
valid edges — a diagonal or non-adjacent pair is rejected.

level_data.initial_states (optional) — game metadata keyed by room
number. Only the radiating flag is used and copied verbatim into the output;
any X/Y/Z here are ignored (prep always starts from |+⟩^N).

mode — "emu" (local simulator, ≤20 qubits, noiseless, seconds) or
"qpu" (IBM hardware, uncapped, real noise, queue can be minutes–hours).

Remaining parameters (shots, steps, fraction, k, top_n,
backend_name) are documented in the request schema below.Pipeline (internal)​
build   → level_data → ZZ-prep QuantumGraph (classical tomography) → QASM bytes
submit  → EMU: run Aer locally → counts │ QPU: transpile + submit to IBM → job_id
collect → EMU: passthrough │ QPU: poll IBM until done → counts
format  → assemble the game JSON contract → final outputBitstring convention: submit/collect reverse Qiskit's qubit-0-rightmost counts to
qubit-0-LEFTMOST before returning. The labyrinth room helpers and the per-edge
ZZ-from-counts math expect qubit-0 at string index 0, so format_result consumes
the leftmost strings DIRECTLY with no further reversal.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Quantum Labyrinth Engine",

    "summary": "Turn a Backrooms level definition into a game-readable maze: a ZZ-correlated quantum graph sampled on Aer (EMU) or IBM QPU.",

    "description": "Quantum Labyrinth Engine — turn a level blueprint into a quantum-generated maze.",

    "version": "live",

    "x-engine-id": "labyrinth-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-publisher": "Moth",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 5,

    "x-timeout-seconds": 300,

    "x-registered-at": "2026-07-13T13:41:58Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/labyrinth-v1"

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

    "/api/v1/engines/labyrinth-v1/process": {

      "post": {

        "operationId": "labyrinth-v1",

        "summary": "Quantum Labyrinth Engine",

        "description": "Quantum Labyrinth Engine — turn a level blueprint into a quantum-generated maze.",

        "x-error-codes": [

          {

            "type": "invalid_level",

            "description": "level_data validation failed — missing grid_size, num_qubits, or coupling_map."

          },

          {

            "type": "graph_init_failed",

            "description": "QuantumGraph initialization failed."

          },

          {

            "type": "prep_failed",

            "description": "ZZ state preparation loop failed."

          },

          {

            "type": "emu_cap_exceeded",

            "description": "num_qubits exceeds the local-simulation cap; use mode=\"qpu\" for larger lattices."

          },

          {

            "type": "simulation_failed",

            "description": "Aer simulation failed."

          },

          {

            "type": "ibm_auth_failed",

            "description": "IBM authentication failed — IBM_QUANTUM_TOKEN missing or invalid."

          },

          {

            "type": "backend_too_small",

            "description": "level_data requires more qubits than the selected IBM backend provides."

          },

          {

            "type": "ibm_submission_failed",

            "description": "Circuit submission to the IBM QPU failed."

          },

          {

            "type": "ibm_collection_failed",

            "description": "Could not retrieve QPU result — job may have been cancelled or backend errored."

          },

          {

            "type": "invalid_params",

            "description": "Parameter validation failed."

          }

        ],

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

                      "backend_name": {

                        "anyOf": [

                          {

                            "type": "string"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "IBM backend to target; omit to auto-select the least busy device. Ignored when mode='emu'.",

                        "title": "Backend Name"

                      },

                      "fraction": {

                        "default": 0.3333333333333333,

                        "description": "Strength of each ZZ prep step, as a fraction of a full rotation.",

                        "exclusiveMinimum": 0,

                        "maximum": 1,

                        "title": "Fraction",

                        "type": "number"

                      },

                      "k": {

                        "default": 3,

                        "description": "Tomography correlation length: expectation values tracked over paths of k connected qubits; higher is more faithful but costlier (max 4).",

                        "maximum": 4,

                        "minimum": 1,

                        "title": "K",

                        "type": "integer"

                      },

                      "level_data": {

                        "$ref": "#/components/schemas/labyrinth-v1__LevelData",

                        "description": "Level definition: grid size, qubit count, coupling map, and initial states."

                      },

                      "mode": {

                        "default": "emu",

                        "description": "'emu' runs on a local Aer simulator; 'qpu' submits to IBM hardware.",

                        "enum": [

                          "emu",

                          "qpu"

                        ],

                        "title": "Mode",

                        "type": "string"

                      },

                      "qpu_instance": {

                        "anyOf": [

                          {

                            "format": "password",

                            "type": "string",

                            "writeOnly": true

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "IBM Quantum instance CRN; falls back to IBM_QUANTUM_INSTANCE env var.",

                        "title": "Qpu Instance"

                      },

                      "qpu_token": {

                        "anyOf": [

                          {

                            "format": "password",

                            "type": "string",

                            "writeOnly": true

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "IBM Quantum API token; falls back to IBM_QUANTUM_TOKEN env var.",

                        "title": "Qpu Token"

                      },

                      "shots": {

                        "default": 4096,

                        "description": "Number of measurement shots (max 10,000).",

                        "exclusiveMinimum": 0,

                        "maximum": 10000,

                        "title": "Shots",

                        "type": "integer"

                      },

                      "steps": {

                        "default": 3,

                        "description": "Number of ZZ prep sweeps over the lattice (max 5).",

                        "maximum": 5,

                        "minimum": 1,

                        "title": "Steps",

                        "type": "integer"

                      },

                      "top_n": {

                        "default": 16,

                        "description": "Most-probable measurements kept in the output; -1 keeps all.",

                        "minimum": -1,

                        "title": "Top N",

                        "type": "integer"

                      }

                    },

                    "title": "Params",

                    "type": "object",

                    "description": "Engine parameters, validated against this schema."

                  },

                  "stop_after": {

                    "type": "string",

                    "enum": [

                      "build",

                      "submit",

                      "collect",

                      "format"

                    ],

                    "description": "Stop after this step."

                  },

                  "start_from": {

                    "type": "string",

                    "enum": [

                      "build",

                      "submit",

                      "collect",

                      "format"

                    ],

                    "description": "Resume from this step, reusing earlier results."

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/labyrinth-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"fraction\": 0.3333333333333333,\n    \"k\": 3,\n    \"mode\": \"emu\",\n    \"shots\": 4096,\n    \"steps\": 3,\n    \"top_n\": 16\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to labyrinth-v1\njob = requests.post(f\"{API}/engines/labyrinth-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"fraction\": 0.3333333333333333,\n            \"k\": 3,\n            \"mode\": \"emu\",\n            \"shots\": 4096,\n            \"steps\": 3,\n            \"top_n\": 16\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/labyrinth-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"fraction\": 0.3333333333333333,\n      \"k\": 3,\n      \"mode\": \"emu\",\n      \"shots\": 4096,\n      \"steps\": 3,\n      \"top_n\": 16\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

      "labyrinth-v1__GridSize": {

        "properties": {

          "cols": {

            "minimum": 1,

            "title": "Cols",

            "type": "integer"

          },

          "rows": {

            "minimum": 1,

            "title": "Rows",

            "type": "integer"

          }

        },

        "required": [

          "rows",

          "cols"

        ],

        "title": "GridSize",

        "type": "object"

      },

      "labyrinth-v1__LevelData": {

        "description": "Inline level definition — the parsed level_*.txt `level_data` dict.",

        "properties": {

          "coupling_map": {

            "items": {

              "items": {

                "type": "integer"

              },

              "type": "array"

            },

            "title": "Coupling Map",

            "type": "array"

          },

          "grid_size": {

            "$ref": "#/$defs/GridSize"

          },

          "initial_states": {

            "additionalProperties": {

              "additionalProperties": true,

              "type": "object"

            },

            "title": "Initial States",

            "type": "object"

          },

          "name": {

            "default": "<unnamed level>",

            "title": "Name",

            "type": "string"

          },

          "num_qubits": {

            "minimum": 2,

            "title": "Num Qubits",

            "type": "integer"

          },

          "relationships": {

            "items": {},

            "title": "Relationships",

            "type": "array"

          }

        },

        "required": [

          "grid_size",

          "num_qubits",

          "coupling_map"

        ],

        "title": "LevelData",

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

