Quantum Graph EngineQuantum Graph Engine

POST/api/v1/engines/graph-v1/processliveRun in dashboard ↗Try the API call ↗

Enginegraph-v1
PublisherMoth
Usage5 credits / run
UpdatedSep 9, 2026

Quantum Graph Engine — prepare a quantum graph state and sample it.

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/graph-v1/process with a JSON body:
```
{

  "params": {

    "mode": "emu",

    "num_qubits": 4,

    "shots": 1024

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionbackend_namestring | nullnonullIBM backend to target; omit to auto-select the least busy device. Ignored when mode='emu'.coupling_maparray | nullnonullGraph edges as qubit pairs; omit for a fully connected graph (QuantumGraph's default).modestringno"emu"'emu' runs on a local Aer simulator; 'qpu' submits to IBM hardware. (one of emu, qpu)num_qubitsintegerno4Number of qubits (graph nodes), 2-20. (min 2, max 20)operationsarray | nullnonullState-preparation targets applied in order: 'bloch' sets single-qubit Pauli targets, 'relationship' sets two-qubit targets on a coupled pair. Omit for a random state drawn from 'seed'.qpu_instancestring | nullnonullIBM Quantum instance CRN; required when mode='qpu'.qpu_tokenstring | nullnonullIBM Quantum API token; required when mode='qpu'.seedinteger | nullnonullSeeds the random graph; the same seed always builds the same circuit. Omit for a fresh random graph.shotsintegerno1024Number of measurement shots.
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
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninggraph_init_failedQuantumGraph initialization failed.prep_failedState-preparation operations failed — an operation could not be applied to the graph.simulation_failedAer simulation failed.ibm_auth_failedIBM authentication failed — IBM_QUANTUM_TOKEN missing or invalid.ibm_submission_failedCircuit submission to the IBM QPU failed.ibm_collection_failedCould not retrieve QPU result — job may have been cancelled or backend errored.invalid_paramsParameter validation failed.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to graph-v1

job = requests.post(f"{API}/engines/graph-v1/process", headers=H,

    json={

        "params": {

            "mode": "emu",

            "num_qubits": 4,

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
curl -s -X POST https://api.mothquantum.com/api/v1/engines/graph-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "mode": "emu",

    "num_qubits": 4,

    "shots": 1024

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
You describe a graph: which qubits are coupled (coupling_map, defaulting to
fully connected) and what state to prepare on it (operations — single-qubit
Bloch targets and two-qubit Pauli correlations, applied in order). The engine
prepares that state, returns its exact tomography (per-qubit Bloch vectors and
per-edge two-qubit expectation values), samples it (locally or on IBM
hardware), and scores the dominant outcome against the graph's edges. Omit
graph and operations and it demos itself with a random (seedable) state.Built on QuantumGraph.What you send​
application/json:
```
{

  "num_qubits": 4,

  "coupling_map": [[0, 1], [1, 2], [2, 3]],

  "operations": [

    {"type": "bloch", "qubit": 0, "paulis": {"X": 1.0}},

    {"type": "relationship", "qubits": [0, 1], "paulis": {"ZZ": 1.0}}

  ],

  "shots": 1024,

  "mode": "emu"

}

```

coupling_map (optional) — the graph edges as qubit pairs. Omit for a
fully connected graph.

operations (optional) — state-preparation targets, applied in order.
"bloch" sets single-qubit Pauli expectation targets on one qubit;
"relationship" sets two-qubit targets (e.g. ZZ) on a coupled pair, which
must be a coupling_map edge. Each operation's update flag (default true)
refreshes the tracked state so later operations account for earlier ones;
set it false for a faster, blind application. Omit operations entirely for
a random state — every qubit gets a random Bloch vector and every edge a
random ±1 ZZ correlation.

seed — fixes the random state when operations is omitted: the same
seed always builds the same circuit, so you can compare emu and qpu runs
on identical states.

mode — "emu" (local simulator, noiseless, seconds) or "qpu"
(IBM hardware, real noise, queue can be minutes–hours; requires
qpu_token and qpu_instance).

Remaining parameters (num_qubits, shots, backend_name) are documented in
the request schema below.What you get back​

output.tomography — the exact prepared state, before any sampling:
bloch (per-qubit \{X, Y, Z} expectation values) and relationships
(per-edge two-qubit Pauli expectation values, keyed "a,b"). Computed
classically at build time, so it is noise-free even on QPU runs — compare it
against the sampled counts to see what the hardware did.

output.measurements — the top 20 bitstrings with count and
probability — plus dominant_bitstring and edge_agreement_score: the
fraction of graph edges whose two bits agree in the dominant bitstring.

The resolved coupling_map is echoed back so both are interpretable
without the request.

Pipeline (internal)​
build   → graph from coupling_map (default fully connected) → operations or
random (seeded) targets → capture exact tomography → QASM bytes
submit  → EMU: run Aer locally → counts │ QPU: transpile + submit to IBM → job_id
collect → EMU: passthrough │ QPU: poll IBM until done → counts
format  → rank bitstrings, score edge agreement → final outputBitstring convention: submit/collect reverse Qiskit's qubit-0-rightmost counts
to qubit-0-LEFTMOST before returning — index i of a bitstring addresses
qubit i directly.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Quantum Graph Engine",

    "summary": "Prepare a quantum graph state — your own couplings and correlations, or a random one — and sample it via Aer simulation (EMU) or an IBM QPU.",

    "description": "Quantum Graph Engine — prepare a quantum graph state and sample it.",

    "version": "live",

    "x-engine-id": "graph-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-publisher": "Moth",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 5,

    "x-timeout-seconds": 300,

    "x-registered-at": "2026-06-17T15:22:23Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/graph-v1"

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

    "/api/v1/engines/graph-v1/process": {

      "post": {

        "operationId": "graph-v1",

        "summary": "Quantum Graph Engine",

        "description": "Quantum Graph Engine — prepare a quantum graph state and sample it.",

        "x-error-codes": [

          {

            "type": "graph_init_failed",

            "description": "QuantumGraph initialization failed."

          },

          {

            "type": "prep_failed",

            "description": "State-preparation operations failed — an operation could not be applied to the graph."

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

                      "coupling_map": {

                        "anyOf": [

                          {

                            "items": {

                              "items": {

                                "type": "integer"

                              },

                              "type": "array"

                            },

                            "type": "array"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Graph edges as qubit pairs; omit for a fully connected graph (QuantumGraph's default).",

                        "title": "Coupling Map"

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

                      "num_qubits": {

                        "default": 4,

                        "description": "Number of qubits (graph nodes), 2-20.",

                        "maximum": 20,

                        "minimum": 2,

                        "title": "Num Qubits",

                        "type": "integer"

                      },

                      "operations": {

                        "anyOf": [

                          {

                            "items": {

                              "anyOf": [

                                {

                                  "$ref": "#/components/schemas/graph-v1__BlochOperation"

                                },

                                {

                                  "$ref": "#/components/schemas/graph-v1__RelationshipOperation"

                                }

                              ]

                            },

                            "type": "array"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "State-preparation targets applied in order: 'bloch' sets single-qubit Pauli targets, 'relationship' sets two-qubit targets on a coupled pair. Omit for a random state drawn from 'seed'.",

                        "title": "Operations"

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

                        "description": "IBM Quantum instance CRN; required when mode='qpu'.",

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

                        "description": "IBM Quantum API token; required when mode='qpu'.",

                        "title": "Qpu Token"

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

                        "description": "Seeds the random graph; the same seed always builds the same circuit. Omit for a fresh random graph.",

                        "title": "Seed"

                      },

                      "shots": {

                        "default": 1024,

                        "description": "Number of measurement shots.",

                        "exclusiveMinimum": 0,

                        "title": "Shots",

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/graph-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"mode\": \"emu\",\n    \"num_qubits\": 4,\n    \"shots\": 1024\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to graph-v1\njob = requests.post(f\"{API}/engines/graph-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"mode\": \"emu\",\n            \"num_qubits\": 4,\n            \"shots\": 1024\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/graph-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"mode\": \"emu\",\n      \"num_qubits\": 4,\n      \"shots\": 1024\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

      "graph-v1__BlochOperation": {

        "properties": {

          "fraction": {

            "default": 1,

            "description": "Fraction of the full rotation to apply.",

            "title": "Fraction",

            "type": "number"

          },

          "paulis": {

            "additionalProperties": {

              "type": "number"

            },

            "description": "Single-qubit Pauli targets, e.g. {'X': 1.0}.",

            "title": "Paulis",

            "type": "object"

          },

          "qubit": {

            "description": "Target qubit.",

            "minimum": 0,

            "title": "Qubit",

            "type": "integer"

          },

          "type": {

            "const": "bloch",

            "title": "Type",

            "type": "string"

          },

          "update": {

            "default": true,

            "description": "Refresh tomography after this operation so later operations see its effect (QuantumGraph's default). False is faster but blind.",

            "title": "Update",

            "type": "boolean"

          }

        },

        "required": [

          "type",

          "qubit",

          "paulis"

        ],

        "title": "BlochOperation",

        "type": "object"

      },

      "graph-v1__RelationshipOperation": {

        "properties": {

          "fraction": {

            "default": 1,

            "description": "Fraction of the full rotation to apply.",

            "title": "Fraction",

            "type": "number"

          },

          "paulis": {

            "additionalProperties": {

              "type": "number"

            },

            "description": "Two-qubit Pauli targets, e.g. {'ZZ': 1.0}.",

            "title": "Paulis",

            "type": "object"

          },

          "qubits": {

            "description": "The coupled qubit pair.",

            "items": {

              "type": "integer"

            },

            "maxItems": 2,

            "minItems": 2,

            "title": "Qubits",

            "type": "array"

          },

          "type": {

            "const": "relationship",

            "title": "Type",

            "type": "string"

          },

          "update": {

            "default": true,

            "description": "Refresh tomography after this operation so later operations see its effect (QuantumGraph's default). False is faster but blind.",

            "title": "Update",

            "type": "boolean"

          }

        },

        "required": [

          "type",

          "qubits",

          "paulis"

        ],

        "title": "RelationshipOperation",

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

