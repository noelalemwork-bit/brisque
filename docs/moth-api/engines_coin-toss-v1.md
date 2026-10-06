Coin TossCoin Toss

POST/api/v1/engines/coin-toss-v1/processliveRun in dashboard ↗Try the API call ↗

Enginecoin-toss-v1
Versionv1.0.15
PublisherMoth
Usage2 credits / run
UpdatedSep 10, 2026

Flip a quantum coin a number of times and get back the heads and tails counts.

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/coin-toss-v1/process with a JSON body:
```
{

  "params": {

    "mode": "emu",

    "shots": 10

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionbackend_namestring | nullnonullIBM Quantum backend to run on when mode is qpu, e.g. ibm_brisbane. Leave blank to let the platform choose the least busy one.modestringno"emu"Where the circuit runs. emu uses the platform's simulator and returns in seconds; qpu submits to real IBM Quantum hardware and can queue for minutes. (one of emu, qpu)qpu_instancestring | nullnonullIBM Quantum instance (hub/group/project) that pairs with qpu_token. Leave blank together with qpu_token to use Moth's account.qpu_tokenstring | nullnonullYour own IBM Quantum API token for mode qpu. Recommended to leave blank: runs then use Moth's own IBM account through the platform backend.shotsintegerno10Number of coin tosses to run. More shots bring the heads/tails split closer to 50/50.
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

Inline JSON in result:
output: "heads" or "tails", whichever had more counts.

heads, tails: integer counts.

shots: the number of measurements taken.

A run still going after 300 s is cancelled and the job ends failed.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaningcoin_toss_failedThe quantum circuit failed to execute.missing_credentialsNo IBM Quantum token available for a QPU run.unknown_backendThe requested backend does not exist.circuit_too_largeThe circuit does not fit the selected backend.ibm_submission_failedmothbackend could not submit the circuit to IBM.ibm_collection_failedThe QPU job did not complete successfully.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to coin-toss-v1

job = requests.post(f"{API}/engines/coin-toss-v1/process", headers=H,

    json={

        "params": {

            "mode": "emu",

            "shots": 10

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
curl -s -X POST https://api.mothquantum.com/api/v1/engines/coin-toss-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "mode": "emu",

    "shots": 10

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
A single qubit is put into equal superposition with a Hadamard gate and measured
shots times. Each measurement lands on heads or tails with 50/50 probability, so
the counts converge towards an even split as shots grows. Runs on an emulator
by default, or on an IBM Quantum device when mode is qpu.How it works​

Builds a one-qubit circuit: Hadamard gate, then measurement.

Runs it for shots measurements on the emulator, or submits it to the chosen
IBM Quantum backend and waits for the device to finish.

Counts the outcomes and reports the majority as the result.

Output​
Inline JSON in result:
output: "heads" or "tails", whichever had more counts.

heads, tails: integer counts.

shots: the number of measurements taken.

Limits​

mode: "qpu" needs an IBM Quantum token, either supplied per request or
configured on the platform; device queue times can be minutes to hours.

The circuit is one qubit; results are a probability sample, not a random-number
service with guarantees.

Further reading​

Hadamard gate:
the single operation this engine uses.

Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Coin Toss",

    "summary": "Flip a quantum coin with a Hadamard gate and return heads and tails counts.",

    "description": "Flip a quantum coin a number of times and get back the heads and tails counts.",

    "version": "1.0.15",

    "x-engine-id": "coin-toss-v1",

    "x-engine-version": "1.0.15",

    "x-status": "live",

    "x-visibility": "public",

    "x-publisher": "Moth",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 2,

    "x-timeout-seconds": 300,

    "x-registered-at": "2026-06-23T14:49:24Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/coin-toss-v1"

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

    "/api/v1/engines/coin-toss-v1/process": {

      "post": {

        "operationId": "coin-toss-v1",

        "summary": "Coin Toss",

        "description": "Flip a quantum coin a number of times and get back the heads and tails counts.",

        "x-error-codes": [

          {

            "type": "coin_toss_failed",

            "description": "The quantum circuit failed to execute."

          },

          {

            "type": "missing_credentials",

            "description": "No IBM Quantum token available for a QPU run."

          },

          {

            "type": "unknown_backend",

            "description": "The requested backend does not exist."

          },

          {

            "type": "circuit_too_large",

            "description": "The circuit does not fit the selected backend."

          },

          {

            "type": "ibm_submission_failed",

            "description": "mothbackend could not submit the circuit to IBM."

          },

          {

            "type": "ibm_collection_failed",

            "description": "The QPU job did not complete successfully."

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

                        "description": "IBM Quantum backend to run on when mode is qpu, e.g. ibm_brisbane. Leave blank to let the platform choose the least busy one.",

                        "title": "Backend Name"

                      },

                      "mode": {

                        "default": "emu",

                        "description": "Where the circuit runs. emu uses the platform's simulator and returns in seconds; qpu submits to real IBM Quantum hardware and can queue for minutes.",

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

                        "description": "IBM Quantum instance (hub/group/project) that pairs with qpu_token. Leave blank together with qpu_token to use Moth's account.",

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

                        "description": "Your own IBM Quantum API token for mode qpu. Recommended to leave blank: runs then use Moth's own IBM account through the platform backend.",

                        "title": "Qpu Token"

                      },

                      "shots": {

                        "default": 10,

                        "description": "Number of coin tosses to run. More shots bring the heads/tails split closer to 50/50.",

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/coin-toss-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"mode\": \"emu\",\n    \"shots\": 10\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to coin-toss-v1\njob = requests.post(f\"{API}/engines/coin-toss-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"mode\": \"emu\",\n            \"shots\": 10\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/coin-toss-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"mode\": \"emu\",\n      \"shots\": 10\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

Qpixl — qpixl-v1, JSON → JSON

Quantum Blur Core — blur-core-v1, JSON → JSON

Quantum Echo — otoc-echo-v1, JSON → JSON

Quantum Graph Engine — graph-v1, JSON → JSON

