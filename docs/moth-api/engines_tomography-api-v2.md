Tomography ApiTomography Api

POST/api/v1/engines/tomography-api-v2/processliveRun in dashboard ↗Try the API call ↗

Enginetomography-api-v2
Versionv0.2.0
Usage1 credit / run
UpdatedSep 23, 2026

Simple core engine to compute relevant quantities of a quantum circuit

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/tomography-api-v2/process with a JSON body:
```
{

  "params": {

    "backend_name": "automatic",

    "circuit_qasm": "…",

    "classical_mutual_information": true,

    "double_tomography": true,

    "mutual_information": true,

    "provider_name": "aer",

    "shots": 4096,

    "single_tomography": true

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionbackend_namestringno"automatic"mothprovider backend/method within provider_namecircuit_qasmstringyesOpenQASM 2 source of the circuit to analyzeclassical_mutual_informationbooleannotrueWhether to compute classical (Shannon) mutual information between each pair's measurement outcomes, separately for the X, Y, and Z basisdouble_tomographybooleannotrueWhether to perform double tomographymutual_informationbooleannotrueWhether to compute quantum mutual information (von Neumann entropies)provider_namestringno"aer"mothprovider provider used to execute the circuitsqubit_listarraynoList of qubits to measurequbit_pair_listarraynoList of qubit pairs to measureshotsintegerno4096Shots per executed measurement circuitsingle_tomographybooleannotrueWhether to perform single tomography
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

result holds this engine's JSON inline. The engine author has not documented its fields yet.A run still going after 10800 s is cancelled and the job ends failed.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to tomography-api-v2

job = requests.post(f"{API}/engines/tomography-api-v2/process", headers=H,

    json={

        "params": {

            "backend_name": "automatic",

            "circuit_qasm": "…",

            "classical_mutual_information": True,

            "double_tomography": True,

            "mutual_information": True,

            "provider_name": "aer",

            "shots": 4096,

            "single_tomography": True

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
curl -s -X POST https://api.mothquantum.com/api/v1/engines/tomography-api-v2/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "backend_name": "automatic",

    "circuit_qasm": "…",

    "classical_mutual_information": true,

    "double_tomography": true,

    "mutual_information": true,

    "provider_name": "aer",

    "shots": 4096,

    "single_tomography": true

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

    "title": "Moth Quantum — Tomography Api",

    "summary": "Simple core engine to compute relevant quantities of a quantum circuit",

    "description": "Simple core engine to compute relevant quantities of a quantum circuit",

    "version": "0.2.0",

    "x-engine-id": "tomography-api-v2",

    "x-engine-version": "0.2.0",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 10800,

    "x-registered-at": "2026-09-23T10:54:08Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/tomography-api-v2"

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

    "/api/v1/engines/tomography-api-v2/process": {

      "post": {

        "operationId": "tomography-api-v2",

        "summary": "Tomography Api",

        "description": "Simple core engine to compute relevant quantities of a quantum circuit",

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

                      "backend_name": {

                        "default": "automatic",

                        "description": "mothprovider backend/method within provider_name",

                        "title": "Backend Name",

                        "type": "string"

                      },

                      "circuit_qasm": {

                        "description": "OpenQASM 2 source of the circuit to analyze",

                        "title": "Circuit Qasm",

                        "type": "string"

                      },

                      "classical_mutual_information": {

                        "default": true,

                        "description": "Whether to compute classical (Shannon) mutual information between each pair's measurement outcomes, separately for the X, Y, and Z basis",

                        "title": "Classical Mutual Information",

                        "type": "boolean"

                      },

                      "double_tomography": {

                        "default": true,

                        "description": "Whether to perform double tomography",

                        "title": "Double Tomography",

                        "type": "boolean"

                      },

                      "mutual_information": {

                        "default": true,

                        "description": "Whether to compute quantum mutual information (von Neumann entropies)",

                        "title": "Mutual Information",

                        "type": "boolean"

                      },

                      "provider_name": {

                        "default": "aer",

                        "description": "mothprovider provider used to execute the circuits",

                        "title": "Provider Name",

                        "type": "string"

                      },

                      "qubit_list": {

                        "description": "List of qubits to measure",

                        "items": {

                          "type": "integer"

                        },

                        "title": "Qubit List",

                        "type": "array"

                      },

                      "qubit_pair_list": {

                        "description": "List of qubit pairs to measure",

                        "items": {

                          "maxItems": 2,

                          "minItems": 2,

                          "prefixItems": [

                            {

                              "type": "integer"

                            },

                            {

                              "type": "integer"

                            }

                          ],

                          "type": "array"

                        },

                        "title": "Qubit Pair List",

                        "type": "array"

                      },

                      "shots": {

                        "default": 4096,

                        "description": "Shots per executed measurement circuit",

                        "title": "Shots",

                        "type": "integer"

                      },

                      "single_tomography": {

                        "default": true,

                        "description": "Whether to perform single tomography",

                        "title": "Single Tomography",

                        "type": "boolean"

                      }

                    },

                    "required": [

                      "circuit_qasm"

                    ],

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/tomography-api-v2/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"backend_name\": \"automatic\",\n    \"circuit_qasm\": \"…\",\n    \"classical_mutual_information\": true,\n    \"double_tomography\": true,\n    \"mutual_information\": true,\n    \"provider_name\": \"aer\",\n    \"shots\": 4096,\n    \"single_tomography\": true\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to tomography-api-v2\njob = requests.post(f\"{API}/engines/tomography-api-v2/process\", headers=H,\n    json={\n        \"params\": {\n            \"backend_name\": \"automatic\",\n            \"circuit_qasm\": \"…\",\n            \"classical_mutual_information\": True,\n            \"double_tomography\": True,\n            \"mutual_information\": True,\n            \"provider_name\": \"aer\",\n            \"shots\": 4096,\n            \"single_tomography\": True\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/tomography-api-v2/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"backend_name\": \"automatic\",\n      \"circuit_qasm\": \"…\",\n      \"classical_mutual_information\": true,\n      \"double_tomography\": true,\n      \"mutual_information\": true,\n      \"provider_name\": \"aer\",\n      \"shots\": 4096,\n      \"single_tomography\": true\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

Qpixl — qpixl-v1, JSON → JSON

Quantum Blur Core — blur-core-v1, JSON → JSON

Quantum Echo — otoc-echo-v1, JSON → JSON

