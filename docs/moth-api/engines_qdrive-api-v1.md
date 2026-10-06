QDriveQDrive

POST/api/v1/engines/qdrive-api-v1/processliveRun in dashboard ↗Try the API call ↗

Engineqdrive-api-v1
Usage1 credit / run
UpdatedSep 1, 2026

QDrive engine

Text → Text1 file slotfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/qdrive-api-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "machine": "aer",

    "sample": false,

    "shots": 1024,

    "tomography": 0,

    "update_method": "spectral"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionansatzobject | string | nullnonullQASM3 ansatz circuits keyed by the number of qubits they act on.coupling_maparray | string | nullnonullOptional coupling map edges, e.g. [[0, 1], [1, 2]].machinestringno"aer"Backend to run on; see backend.MACHINESn_qubitsinteger | nullnonullNumber of qubits in the circuit; required unless the initial_circuit file input is givensamplebooleannofalseAlso run a shot-based sampler on the final circuitseedinteger | nullnonullRNG seed; a random one is drawn if omittedshotsintegerno1024Shot count used by both the estimator and the samplertargetsarray | array | stringnoOrdered QDrive.target() calls; an empty/null entry calls update() instead. An expvals value may be a number, [value, certainty], or a measured[...]-style expression [[word, qubits, coefficient], ...] (optionally [terms, certainty]).tomographyintegerno00: none, 1: single-qubit tomography, 2: two-qubit tomography (min 0, max 2)update_methodstringno"spectral"QDrive.update() fitting method: one of ('spectral', 'direct', 'constrained')Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptioninitial_circuittext/plainno
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

      "slot": "circuit",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345670",

      "filename": "qdrive-api-v1-1b9d6bcd-circuit.bin",

      "content_type": "text/plain",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/circuit?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 120 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptioncircuittext/plainyesThe final circuit (QASM3), also chainable into a later job's initial_circuit via job:<id>/circuit.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_paramsparams fail Params' own field validation (type/range).invalid_initial_circuitinitial_circuit bytes aren't parseable QASM3.n_qubits_mismatchn_qubits disagrees with initial_circuit's own qubit count.invalid_coupling_mapcoupling_map isn't a list of 2-qubit edges.coupling_map_out_of_rangecoupling_map references more qubits than n_qubits.invalid_ansatzan ansatz key isn't an integer qubit count.invalid_ansatz_qasman ansatz value isn't parseable QASM3.ansatz_width_mismatchan ansatz circuit's qubit count doesn't match its key.unsupported_target_ansatza target dict carries its own 'ansatz' key, which isn't supported — use the top-level ansatz parameter.invalid_targeta target is missing 'qubits', has duplicate/out-of-range qubits, or a non-mapping 'expvals'.invalid_update_methodupdate_method isn't one of spectral, direct, or constrained.invalid_machinemachine isn't a backend.get_backend() knows about.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to qdrive-api-v1

job = requests.post(f"{API}/engines/qdrive-api-v1/process", headers=H,

    json={

        "params": {

            "machine": "aer",

            "sample": False,

            "shots": 1024,

            "tomography": 0,

            "update_method": "spectral"

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

# 3. Fetch the result — output slots: circuit

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
curl -s -X POST https://api.mothquantum.com/api/v1/engines/qdrive-api-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "machine": "aer",

    "sample": false,

    "shots": 1024,

    "tomography": 0,

    "update_method": "spectral"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
No further details provided by the engine author.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — QDrive",

    "summary": "Build a quantum circuit by specifying target expectation values instead of gates.",

    "description": "QDrive engine",

    "version": "live",

    "x-engine-id": "qdrive-api-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "text-to-text"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 120,

    "x-registered-at": "2026-08-21T15:37:48Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/qdrive-api-v1"

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

    "/api/v1/engines/qdrive-api-v1/process": {

      "post": {

        "operationId": "qdrive-api-v1",

        "summary": "QDrive",

        "description": "QDrive engine",

        "x-error-codes": [

          {

            "type": "invalid_params",

            "description": "params fail Params' own field validation (type/range)."

          },

          {

            "type": "invalid_initial_circuit",

            "description": "initial_circuit bytes aren't parseable QASM3."

          },

          {

            "type": "n_qubits_mismatch",

            "description": "n_qubits disagrees with initial_circuit's own qubit count."

          },

          {

            "type": "invalid_coupling_map",

            "description": "coupling_map isn't a list of 2-qubit edges."

          },

          {

            "type": "coupling_map_out_of_range",

            "description": "coupling_map references more qubits than n_qubits."

          },

          {

            "type": "invalid_ansatz",

            "description": "an ansatz key isn't an integer qubit count."

          },

          {

            "type": "invalid_ansatz_qasm",

            "description": "an ansatz value isn't parseable QASM3."

          },

          {

            "type": "ansatz_width_mismatch",

            "description": "an ansatz circuit's qubit count doesn't match its key."

          },

          {

            "type": "unsupported_target_ansatz",

            "description": "a target dict carries its own 'ansatz' key, which isn't supported — use the top-level ansatz parameter."

          },

          {

            "type": "invalid_target",

            "description": "a target is missing 'qubits', has duplicate/out-of-range qubits, or a non-mapping 'expvals'."

          },

          {

            "type": "invalid_update_method",

            "description": "update_method isn't one of spectral, direct, or constrained."

          },

          {

            "type": "invalid_machine",

            "description": "machine isn't a backend.get_backend() knows about."

          }

        ],

        "x-output-files": [

          {

            "name": "circuit",

            "content_types": [

              "text/plain"

            ],

            "required": true,

            "description": "The final circuit (QASM3), also chainable into a later job's initial_circuit via job:<id>/circuit."

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

                      "ansatz": {

                        "anyOf": [

                          {

                            "additionalProperties": {

                              "type": "string"

                            },

                            "type": "object"

                          },

                          {

                            "type": "string"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "QASM3 ansatz circuits keyed by the number of qubits they act on.",

                        "title": "Ansatz"

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

                            "type": "string"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Optional coupling map edges, e.g. [[0, 1], [1, 2]].",

                        "title": "Coupling Map"

                      },

                      "machine": {

                        "default": "aer",

                        "description": "Backend to run on; see backend.MACHINES",

                        "title": "Machine",

                        "type": "string"

                      },

                      "n_qubits": {

                        "anyOf": [

                          {

                            "exclusiveMinimum": 0,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Number of qubits in the circuit; required unless the initial_circuit file input is given",

                        "title": "N Qubits"

                      },

                      "sample": {

                        "default": false,

                        "description": "Also run a shot-based sampler on the final circuit",

                        "title": "Sample",

                        "type": "boolean"

                      },

                      "seed": {

                        "anyOf": [

                          {

                            "minimum": 0,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "RNG seed; a random one is drawn if omitted",

                        "title": "Seed"

                      },

                      "shots": {

                        "default": 1024,

                        "description": "Shot count used by both the estimator and the sampler",

                        "exclusiveMinimum": 0,

                        "title": "Shots",

                        "type": "integer"

                      },

                      "targets": {

                        "anyOf": [

                          {

                            "items": {

                              "anyOf": [

                                {

                                  "additionalProperties": true,

                                  "type": "object"

                                },

                                {

                                  "type": "null"

                                }

                              ]

                            },

                            "type": "array"

                          },

                          {

                            "items": {

                              "type": "string"

                            },

                            "type": "array"

                          },

                          {

                            "type": "string"

                          }

                        ],

                        "description": "Ordered QDrive.target() calls; an empty/null entry calls update() instead. An expvals value may be a number, [value, certainty], or a measured[...]-style expression [[word, qubits, coefficient], ...] (optionally [terms, certainty]).",

                        "title": "Targets"

                      },

                      "tomography": {

                        "default": 0,

                        "description": "0: none, 1: single-qubit tomography, 2: two-qubit tomography",

                        "maximum": 2,

                        "minimum": 0,

                        "title": "Tomography",

                        "type": "integer"

                      },

                      "update_method": {

                        "default": "spectral",

                        "description": "QDrive.update() fitting method: one of ('spectral', 'direct', 'constrained')",

                        "title": "Update Method",

                        "type": "string"

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

                      "initial_circuit": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Accepts: text/plain."

                      }

                    },

                    "required": []

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/qdrive-api-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"machine\": \"aer\",\n    \"sample\": false,\n    \"shots\": 1024,\n    \"tomography\": 0,\n    \"update_method\": \"spectral\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to qdrive-api-v1\njob = requests.post(f\"{API}/engines/qdrive-api-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"machine\": \"aer\",\n            \"sample\": False,\n            \"shots\": 1024,\n            \"tomography\": 0,\n            \"update_method\": \"spectral\"\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — output slots: circuit\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/qdrive-api-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"machine\": \"aer\",\n      \"sample\": false,\n      \"shots\": 1024,\n      \"tomography\": 0,\n      \"update_method\": \"spectral\"\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: circuit\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

QRC Generate — qrc-gen-v2, File → JSON

QRC MIDI — qrc-midi-v1, Audio → Audio

Retrocausal Echo — retrocausal-echo-v1, Audio → Audio

