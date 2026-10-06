Quantum Blur CoreQuantum Blur Core

POST/api/v1/engines/blur-core-v1/processliveRun in dashboard ↗Try the API call ↗

Engineblur-core-v1
Usage1 credit / run
UpdatedSep 8, 2026

A unitary, information-preserving blur driven by quantum interference —
applied to an arbitrary N-dimensional grid of numbers, not to image files.

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/blur-core-v1/process with a JSON body:
```
{

  "params": {

    "max_qubits": 20,

    "reach": 0,

    "strength": 0.5,

    "style": "x"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionaxesarray | nullnonullWhich axes of values to blur along. null (default) blurs every axis. E.g. for a 2-D grid, [0] blurs only along axis 0, leaving axis 1 untouched. Negative indices count from the end, as in numpy.max_qubitsintegerno20Safety cap on the total number of qubits values's shape is allowed to require. A 1024x1024 2-D grid costs 20 qubits; a flat 1D list of up to 2**20 numbers also costs 20. Default 20, max 24. (min 1, max 24)reachnumberno0Controls how far from its original position a value can be affected by the blur:  - 0 — fully local: only neighbouring grid points are affected (default). - 1 — fully non-local: any point on the grid can be affected equally. (min 0, max 1)shotsinteger | nullnonullIf given, the grid is recovered from this many simulated projective measurements, introducing shot noise. If omitted (default), the exact (infinite-shot) probabilities are used.strengthnumber | arrayno0.5Strength of the effect, which controls the rotation applied to each qubit:  - 0 — the values are left unchanged. - 1 — maximum blur.  A single number applies to every axis identically. A list applies per axis instead — one entry per axis in axes (or, if axes is omitted, one per axis of values) — so e.g. one axis can be left at 0 (untouched) while another is fully blurred.stylestringno"x"Quantum gate(s) used to apply the effect: any non-empty combination of the letters x, y, each selecting a rotation around that axis of the Bloch sphere (Rx/Ry). Every qubit gets the gates in style applied in order, left to right, all using the same angle for that qubit — e.g. "xy" applies Rx then Ry to each qubit, both by the same amount. style picks which gates run; strength (below) picks how hard, per axis. (pattern ^[xy]+$)valuesarraynoAn arbitrarily nested list of non-negative numbers. The nesting depth is the grid's dimensionality: a flat list is 1-D, a list of lists is 2-D, etc. Must be rectangular (non-ragged).
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

Returns a JSON list, nested to the same shape as the input values, with
each entry rescaled relative to the input's maximum (an exact round-trip
when strength is 0).A run still going after 300 s is cancelled and the job ends failed.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_paramsOne or more params fields failed Pydantic validation.invalid_valuesvalues was not a rectangular nested list of non-negative numbers (ragged nesting, non-numeric entries, or a negative value).too_many_qubitsThe shape of values requires more qubits than max_qubits allows.invalid_axesOne or more entries in axes is out of range for the dimensionality of values.invalid_strengthstrength was given as a list whose length doesn't match the number of targeted axes (the length of axes, or the dimensionality of values if axes is omitted).
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to blur-core-v1

job = requests.post(f"{API}/engines/blur-core-v1/process", headers=H,

    json={

        "params": {

            "max_qubits": 20,

            "reach": 0,

            "strength": 0.5,

            "style": "x"

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
curl -s -X POST https://api.mothquantum.com/api/v1/engines/blur-core-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "max_qubits": 20,

    "reach": 0,

    "strength": 0.5,

    "style": "x"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Every value in the input is amplitude-encoded onto a Gray-coded qubit grid
(see gray_encoding.py for the encoding itself, which is intentionally kept
independent of this engine/Archaeo scaffolding so it can be lifted out into
its own library later), a single-qubit rotation is applied to each qubit,
and the grid is measured back out. Because adjacent grid points always
differ by exactly one bit in the encoding, the rotations scatter each
value's weight onto its neighbours — a blur, not noise.How to use​
Invoke the engine through the platform with a JSON params payload:
values — required. An arbitrarily nested list of non-negative numbers.
The nesting depth is the grid's dimensionality: a flat list is treated
as 1-D, a list of lists as 2-D, a list of lists of lists as 3-D, and so
on. The list must be rectangular (every sibling sub-list the same length).

Optionally, the params object may also include:
strength — strength of the blur. Default 0.5. Either a single number
(applied to every targeted axis identically) or a list with one entry per
targeted axis, letting different axes be blurred by different amounts
(including 0, i.e. left untouched).

style — quantum gate(s) used to apply the blur. Default "x".

reach — how far from its original position a value can be affected by
the blur. 0 is fully local (default); 1 is maximally non-local.
Default 0.0.

axes — which axes of values to blur along. null/omitted (default)
blurs every axis; e.g. for a 2-D grid, [0] blurs only "vertically"
(along axis 0), leaving axis 1 untouched. Negative indices count from the
end, as in numpy.

shots — if given, the grid is recovered from a finite number of
simulated projective measurements (introducing sampling noise), instead
of the default exact (infinite-shot) probabilities.

max_qubits — safety cap on the total number of qubits the input's shape
is allowed to require. Default 20 (a 1024x1024 2-D grid costs 20).

Output​
Returns a JSON list, nested to the same shape as the input values, with
each entry rescaled relative to the input's maximum (an exact round-trip
when strength is 0).
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Quantum Blur Core",

    "summary": "Apply a quantum blur to any N-dimensional grid of non-negative numbers.",

    "description": "A unitary, information-preserving blur driven by quantum interference —\napplied to an arbitrary N-dimensional grid of numbers, not to image files.",

    "version": "live",

    "x-engine-id": "blur-core-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 300,

    "x-registered-at": "2026-09-08T13:26:20Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/blur-core-v1"

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

    "/api/v1/engines/blur-core-v1/process": {

      "post": {

        "operationId": "blur-core-v1",

        "summary": "Quantum Blur Core",

        "description": "A unitary, information-preserving blur driven by quantum interference —\napplied to an arbitrary N-dimensional grid of numbers, not to image files.",

        "x-error-codes": [

          {

            "type": "invalid_params",

            "description": "One or more params fields failed Pydantic validation."

          },

          {

            "type": "invalid_values",

            "description": "`values` was not a rectangular nested list of non-negative numbers (ragged nesting, non-numeric entries, or a negative value)."

          },

          {

            "type": "too_many_qubits",

            "description": "The shape of `values` requires more qubits than `max_qubits` allows."

          },

          {

            "type": "invalid_axes",

            "description": "One or more entries in `axes` is out of range for the dimensionality of `values`."

          },

          {

            "type": "invalid_strength",

            "description": "`strength` was given as a list whose length doesn't match the number of targeted axes (the length of `axes`, or the dimensionality of `values` if `axes` is omitted)."

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

                      "axes": {

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

                        "description": "Which axes of `values` to blur along. `null` (default) blurs every axis. E.g. for a 2-D grid, `[0]` blurs only along axis 0, leaving axis 1 untouched. Negative indices count from the end, as in numpy.",

                        "title": "Axes"

                      },

                      "max_qubits": {

                        "default": 20,

                        "description": "Safety cap on the total number of qubits `values`'s shape is allowed to require. A 1024x1024 2-D grid costs 20 qubits; a flat 1D list of up to 2**20 numbers also costs 20. Default 20, max 24.",

                        "maximum": 24,

                        "minimum": 1,

                        "title": "Max Qubits",

                        "type": "integer"

                      },

                      "reach": {

                        "default": 0,

                        "description": "Controls how far from its original position a value can be affected by the blur:\n\n- `0` — fully local: only neighbouring grid points are affected (default).\n- `1` — fully non-local: any point on the grid can be affected equally.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Reach",

                        "type": "number"

                      },

                      "shots": {

                        "anyOf": [

                          {

                            "minimum": 1,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "If given, the grid is recovered from this many simulated projective measurements, introducing shot noise. If omitted (default), the exact (infinite-shot) probabilities are used.",

                        "title": "Shots"

                      },

                      "strength": {

                        "anyOf": [

                          {

                            "type": "number"

                          },

                          {

                            "items": {

                              "type": "number"

                            },

                            "type": "array"

                          }

                        ],

                        "default": 0.5,

                        "description": "Strength of the effect, which controls the rotation applied to each qubit:\n\n- `0` — the values are left unchanged.\n- `1` — maximum blur.\n\nA single number applies to every axis identically. A list applies per axis instead — one entry per axis in `axes` (or, if `axes` is omitted, one per axis of `values`) — so e.g. one axis can be left at `0` (untouched) while another is fully blurred.",

                        "title": "Strength"

                      },

                      "style": {

                        "default": "x",

                        "description": "Quantum gate(s) used to apply the effect: any non-empty combination of the letters `x`, `y`, each selecting a rotation around that axis of the Bloch sphere (Rx/Ry). Every qubit gets the gates in `style` applied in order, left to right, all using the same angle for that qubit — e.g. `\"xy\"` applies Rx then Ry to each qubit, both by the same amount. `style` picks which gates run; `strength` (below) picks how hard, per axis.",

                        "pattern": "^[xy]+$",

                        "title": "Style",

                        "type": "string"

                      },

                      "values": {

                        "description": "An arbitrarily nested list of non-negative numbers. The nesting depth is the grid's dimensionality: a flat list is 1-D, a list of lists is 2-D, etc. Must be rectangular (non-ragged).",

                        "items": {},

                        "title": "Values",

                        "type": "array"

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/blur-core-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"max_qubits\": 20,\n    \"reach\": 0,\n    \"strength\": 0.5,\n    \"style\": \"x\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to blur-core-v1\njob = requests.post(f\"{API}/engines/blur-core-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"max_qubits\": 20,\n            \"reach\": 0,\n            \"strength\": 0.5,\n            \"style\": \"x\"\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/blur-core-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"max_qubits\": 20,\n      \"reach\": 0,\n      \"strength\": 0.5,\n      \"style\": \"x\"\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

Quantum Echo — otoc-echo-v1, JSON → JSON

Quantum Graph Engine — graph-v1, JSON → JSON

