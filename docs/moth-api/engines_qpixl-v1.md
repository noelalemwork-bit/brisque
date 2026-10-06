QpixlQpixl

POST/api/v1/engines/qpixl-v1/processliveRun in dashboard ↗Try the API call ↗

Engineqpixl-v1
PublisherMoth
Usage1 credit / run
UpdatedSep 9, 2026

Encode an array of floats onto a quantum device using Interwoven QPIXL.

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/qpixl-v1/process with a JSON body:
```
{

  "params": {

    "allow_high_shots": false,

    "discretize": 0,

    "dynamic_range": "none",

    "machine": "aer",

    "mode": "emu",

    "shots": 4096,

    "values": [

      0.05,

      0.2,

      0.4,

      0.6,

      0.8,

      0.95

    ]

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionallow_high_shotsbooleannofalsePermit shots above 8192. Real hardware time scales linearly with shots, and emulated runs multiply shots by the number of data-qubit groups, so raising this can be expensive. Off by default.backend_namestring | nullnonullIBM device to target when mode='qpu', e.g. 'ibm_fez'. Required in that mode -- there is no least-busy auto-select. Ignored when mode='emu'.discretizeintegerno0Number of discrete levels to quantize values to. 0 encodes them continuously. (min 0)dynamic_rangestringno"none"Rescale the reconstruction to match a summary statistic of the original values, to counteract shot noise/decoherence shrinking its spread toward the middle of the range. 'none' leaves the reconstruction unchanged. 'min_max' rescales so its min and max match the input's. 'percentile' does the same using the 2nd/98th percentiles instead, less sensitive to outliers. 'mean_std' matches mean and standard deviation. 'abs_max' rescales by the single largest absolute value. 'min_avg_max' matches min, mean, and max all three at once. (one of none, min_max, percentile, mean_std, abs_max, min_avg_max)machinestringno"aer"Which emulator to use when mode='emu' (ignored when mode='qpu'). 'aer' is noiseless. 'fake_<chip>' options (e.g. 'fake_fez', 'fake_sherbrooke', 'fake_torino') are each calibrated to a real current IBM chip's noise. (one of aer, fake_fez, fake_marrakesh, fake_torino, fake_brisbane, fake_kyiv, fake_sherbrooke, fake_kyoto, fake_osaka, fake_quebec, fake_cusco, fake_strasbourg, fake_brussels)modestringno"emu"'emu' simulates the circuit (see machine for noiseless vs. noisy); 'qpu' submits to real IBM hardware (see backend_name). Both run server-side on mothbackend. (one of emu, qpu)shotsintegerno4096Number of measurement shots to sample. Capped at 8192 unless allow_high_shots is set; the hard ceiling is 32768. Note this is shots PER data-qubit group when mode='emu', not per run. (max 32768)valuesstring | array | arrayno[0.05,0.2,0.4,0.6,0.8,0.95]Array of floating-point values to encode. Either a flat list, a nested list of groups (one sublist per data-qubit group, in the exact order list_groups(values, machine) returns them), or that same shape written as a single string wrapped in [..] or (..), e.g. "[0.1,0.2,0.3]" for a flat list or "[[0.1,0.2],[0.3,0.4]]" / "([0.1,0.2],[0.3,0.4])" for groups. A group with more values than its capacity is rejected; a group with fewer is padded with zeros. (min length 1)
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

result holds this engine's JSON inline. The engine author has not documented its fields yet.A run still going after 18000 s is cancelled and the job ends failed.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaningunparseable_valuesa string values input isn't a valid comma-separated (optionally [..]/(..) grouped) number list.too_few_valuesvalues must contain at least 2 numbers.non_finite_valuesvalues must contain only finite numbers (no NaN/Infinity).too_many_valuesvalues exceeds the largest supported simulated lattice (64x64).insufficient_qubitsvalues exceeds the selected machine's data-qubit capacity.group_count_mismatcha nested (grouped) values input has a different number of groups than the machine's lattice.group_overflowone group in a nested (grouped) values input has more values than that group's data qubit can hold.unsupported_machinethe requested machine name isn't recognized.ibm_connection_failedCould not authenticate/connect to IBM Quantum with the given token/instance.submission_failedThe transpiled circuit was rejected or the sampling job failed to submit.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to qpixl-v1

job = requests.post(f"{API}/engines/qpixl-v1/process", headers=H,

    json={

        "params": {

            "allow_high_shots": False,

            "discretize": 0,

            "dynamic_range": "none",

            "machine": "aer",

            "mode": "emu",

            "shots": 4096,

            "values": [

                0.05,

                0.2,

                0.4,

                0.6,

                0.8,

                0.95

            ]

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
curl -s -X POST https://api.mothquantum.com/api/v1/engines/qpixl-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "allow_high_shots": false,

    "discretize": 0,

    "dynamic_range": "none",

    "machine": "aer",

    "mode": "emu",

    "shots": 4096,

    "values": [

      0.05,

      0.2,

      0.4,

      0.6,

      0.8,

      0.95

    ]

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Execution is delegated to mothbackend (mothbackend.client): the engine builds
circuits locally, decomposes them to a QASM2-safe basis, and submits QASM.
mothbackend takes a single backend name and derives its own mode from it
("aer" -> sim, "fake_<chip>" -> emu, anything else -> qpu), so the public
mode/machine/backend_name triple is collapsed into that one name by
topology.resolve_backend() before anything is submitted.
mode="emu", machine="aer" -- mothbackend's noiseless simulator. The
encoding graph is still an auto-sized checkerboard lattice built engine-side
(topology.py) -- a bare simulator imposes no topology of its own.
Reconstructed one data-qubit group at a time via _run_by_groups, same as
the fake_* machines below -- there's no joint statevector limit to worry
about since each group runs as its own tiny circuit.

mode="qpu", backend_name="ibm_fez" -- real IBM hardware via
mothbackend's qpu mode. Runs the whole circuit as one joint measurement via
_run_joint -- submitting one job per data-qubit group to real hardware
would be far slower and more expensive than a single combined job. machine
is ignored in this mode. backend_name is required here: mothbackend
exposes no least_busy selector, so there's no auto-select to fall back on.

Credentials are never handled engine-side. mothbackend resolves IBM
credentials itself from its own secret store; the engine holds no token, is
passed none, and returns none. There is deliberately no BYOK parameter on
Params -- adding one would put a user-supplied secret in the job payload,
the job record, and any error text quoting it.
mode="emu", machine="fake_&lt;chip>" (e.g. "fake_fez",
"fake_sherbrooke", "fake_torino" -- see topology.FAKE_MACHINES for
the full list) -- that real IBM chip's noisy stand-in, simulated server-side
by mothbackend's emu mode. A full chip-scale statevector can't be simulated
jointly, so
_run_by_groups reconstructs one data-qubit group at a time: each group's
tiny sub-circuit is submitted with initial_layout pinning it onto its own
real physical qubits -- cheap regardless of how many qubits the chip actually
has, because different data-qubit groups' encoding gates commute (address
qubits are only ever controls, never targets), so each group's own marginal
statistics don't depend on any other group.

Bitstring convention: mothbackend reports counts qubit-0-LEFTMOST
(bit_order: "qubit0_left"), while iqpixl.decode_counts consumes Qiskit's
native qubit-0-rightmost bitstrings -- _run_counts reverses each key exactly
once at the boundary. Nothing else in the pipeline reverses anything.Params.shots defaults to 4096 and must be positive -- there's no exact/
noiseless mode for a sampled run.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Qpixl",

    "summary": "An array encoded as qubit angles, decoded in a single measurement.",

    "description": "Encode an array of floats onto a quantum device using Interwoven QPIXL.",

    "version": "live",

    "x-engine-id": "qpixl-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-publisher": "Moth",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 18000,

    "x-registered-at": "2026-08-19T12:24:36Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/qpixl-v1"

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

    "/api/v1/engines/qpixl-v1/process": {

      "post": {

        "operationId": "qpixl-v1",

        "summary": "Qpixl",

        "description": "Encode an array of floats onto a quantum device using Interwoven QPIXL.",

        "x-error-codes": [

          {

            "type": "unparseable_values",

            "description": "a string values input isn't a valid comma-separated (optionally [..]/(..) grouped) number list."

          },

          {

            "type": "too_few_values",

            "description": "values must contain at least 2 numbers."

          },

          {

            "type": "non_finite_values",

            "description": "values must contain only finite numbers (no NaN/Infinity)."

          },

          {

            "type": "too_many_values",

            "description": "values exceeds the largest supported simulated lattice (64x64)."

          },

          {

            "type": "insufficient_qubits",

            "description": "values exceeds the selected machine's data-qubit capacity."

          },

          {

            "type": "group_count_mismatch",

            "description": "a nested (grouped) values input has a different number of groups than the machine's lattice."

          },

          {

            "type": "group_overflow",

            "description": "one group in a nested (grouped) values input has more values than that group's data qubit can hold."

          },

          {

            "type": "unsupported_machine",

            "description": "the requested machine name isn't recognized."

          },

          {

            "type": "ibm_connection_failed",

            "description": "Could not authenticate/connect to IBM Quantum with the given token/instance."

          },

          {

            "type": "submission_failed",

            "description": "The transpiled circuit was rejected or the sampling job failed to submit."

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

                      "allow_high_shots": {

                        "default": false,

                        "description": "Permit `shots` above 8192. Real hardware time scales linearly with shots, and emulated runs multiply shots by the number of data-qubit groups, so raising this can be expensive. Off by default.",

                        "title": "Allow High Shots",

                        "type": "boolean"

                      },

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

                        "description": "IBM device to target when mode='qpu', e.g. 'ibm_fez'. Required in that mode -- there is no least-busy auto-select. Ignored when mode='emu'.",

                        "title": "Backend Name"

                      },

                      "discretize": {

                        "default": 0,

                        "description": "Number of discrete levels to quantize `values` to. 0 encodes them continuously.",

                        "minimum": 0,

                        "title": "Discretize",

                        "type": "integer"

                      },

                      "dynamic_range": {

                        "default": "none",

                        "description": "Rescale the reconstruction to match a summary statistic of the original `values`, to counteract shot noise/decoherence shrinking its spread toward the middle of the range. 'none' leaves the reconstruction unchanged. 'min_max' rescales so its min and max match the input's. 'percentile' does the same using the 2nd/98th percentiles instead, less sensitive to outliers. 'mean_std' matches mean and standard deviation. 'abs_max' rescales by the single largest absolute value. 'min_avg_max' matches min, mean, and max all three at once.",

                        "enum": [

                          "none",

                          "min_max",

                          "percentile",

                          "mean_std",

                          "abs_max",

                          "min_avg_max"

                        ],

                        "title": "Dynamic Range",

                        "type": "string"

                      },

                      "machine": {

                        "default": "aer",

                        "description": "Which emulator to use when mode='emu' (ignored when mode='qpu'). 'aer' is noiseless. 'fake_<chip>' options (e.g. 'fake_fez', 'fake_sherbrooke', 'fake_torino') are each calibrated to a real current IBM chip's noise.",

                        "enum": [

                          "aer",

                          "fake_fez",

                          "fake_marrakesh",

                          "fake_torino",

                          "fake_brisbane",

                          "fake_kyiv",

                          "fake_sherbrooke",

                          "fake_kyoto",

                          "fake_osaka",

                          "fake_quebec",

                          "fake_cusco",

                          "fake_strasbourg",

                          "fake_brussels"

                        ],

                        "title": "Machine",

                        "type": "string"

                      },

                      "mode": {

                        "default": "emu",

                        "description": "'emu' simulates the circuit (see `machine` for noiseless vs. noisy); 'qpu' submits to real IBM hardware (see `backend_name`). Both run server-side on mothbackend.",

                        "enum": [

                          "emu",

                          "qpu"

                        ],

                        "title": "Mode",

                        "type": "string"

                      },

                      "shots": {

                        "default": 4096,

                        "description": "Number of measurement shots to sample. Capped at 8192 unless `allow_high_shots` is set; the hard ceiling is 32768. Note this is shots PER data-qubit group when mode='emu', not per run.",

                        "exclusiveMinimum": 0,

                        "maximum": 32768,

                        "title": "Shots",

                        "type": "integer"

                      },

                      "values": {

                        "anyOf": [

                          {

                            "type": "string"

                          },

                          {

                            "items": {

                              "type": "number"

                            },

                            "type": "array"

                          },

                          {

                            "items": {

                              "items": {

                                "type": "number"

                              },

                              "type": "array"

                            },

                            "type": "array"

                          }

                        ],

                        "default": [

                          0.05,

                          0.2,

                          0.4,

                          0.6,

                          0.8,

                          0.95

                        ],

                        "description": "Array of floating-point values to encode. Either a flat list, a nested list of groups (one sublist per data-qubit group, in the exact order `list_groups(values, machine)` returns them), or that same shape written as a single string wrapped in [..] or (..), e.g. \"[0.1,0.2,0.3]\" for a flat list or \"[[0.1,0.2],[0.3,0.4]]\" / \"([0.1,0.2],[0.3,0.4])\" for groups. A group with more values than its capacity is rejected; a group with fewer is padded with zeros.",

                        "minLength": 1,

                        "title": "Values"

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/qpixl-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"allow_high_shots\": false,\n    \"discretize\": 0,\n    \"dynamic_range\": \"none\",\n    \"machine\": \"aer\",\n    \"mode\": \"emu\",\n    \"shots\": 4096,\n    \"values\": [\n      0.05,\n      0.2,\n      0.4,\n      0.6,\n      0.8,\n      0.95\n    ]\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to qpixl-v1\njob = requests.post(f\"{API}/engines/qpixl-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"allow_high_shots\": False,\n            \"discretize\": 0,\n            \"dynamic_range\": \"none\",\n            \"machine\": \"aer\",\n            \"mode\": \"emu\",\n            \"shots\": 4096,\n            \"values\": [\n                0.05,\n                0.2,\n                0.4,\n                0.6,\n                0.8,\n                0.95\n            ]\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/qpixl-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"allow_high_shots\": false,\n      \"discretize\": 0,\n      \"dynamic_range\": \"none\",\n      \"machine\": \"aer\",\n      \"mode\": \"emu\",\n      \"shots\": 4096,\n      \"values\": [\n        0.05,\n        0.2,\n        0.4,\n        0.6,\n        0.8,\n        0.95\n      ]\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

Coin Toss — coin-toss-v1, JSON → JSON

Quantum Blur Core — blur-core-v1, JSON → JSON

Quantum Echo — otoc-echo-v1, JSON → JSON

Quantum Graph Engine — graph-v1, JSON → JSON

