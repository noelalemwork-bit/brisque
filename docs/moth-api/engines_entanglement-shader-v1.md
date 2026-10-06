Entanglement ShaderEntanglement Shader

POST/api/v1/engines/entanglement-shader-v1/processliveRun in dashboard ↗Try the API call ↗

Engineentanglement-shader-v1
Usage1 credit / run
UpdatedAug 27, 2026

Entanglement Shader

JSON → Filefile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/entanglement-shader-v1/process with a JSON body:
```
{

  "params": {

    "absorption": 0.95,

    "incoming_rays": 8,

    "interaction": 1,

    "layers": 2,

    "reflectance": 0.2,

    "resolution": 60,

    "style": "peaked"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionabsorptionnumberno0.95Fraction of the maximum absorption achievable at the given reflectance.  - 0 — no absorption. - 1 — maximum absorption and minimum transmission.  (min 0, max 1)incoming_raysintegerno8Number of light rays entering the stack simultaneously.  - Must be >= layers so that at least one ray is transmitted. - Maximum enforced by the 21-qubit budget at validation time.  (min 1)interactionnumberno1Strength of the nonlinear quantum interaction terms.  - 0 — interaction disabled; only reflectance and absorption shape the output. - Positive vs. negative values of the same magnitude produce distinct colour patterns.layersintegerno2Number of conducting sheets in the stack.  - Maximum enforced by the 21-qubit budget at validation time.  (min 1)reflectancenumberno0.2Fraction of reflected power of a single ray and layer at normal incidence.  - 0 — perfect transmittance and no absorption. - 1 — perfect mirror, no transmission or absorption.  (min 0, max 1)resolutioninteger | nullno60Density of the angle–phase lookup table baked into the shader.  - Higher values reduce banding on close-up or oblique surfaces.stylestringno"peaked"Selects which nonlinear interaction channels are active.  - peaked — reflection and transmission peak at the same angle for large number of layers. - frustrated — competing interaction channels produce a non-monotone colour pattern. - 3-body — three-body interactions only; subtle, low-contrast effect. - constrained — higher ray counts suppress transmission, deepening shadows.  (one of peaked, frustrated, 3-body, constrained)
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

      "filename": "entanglement-shader-v1-1b9d6bcd-result.bin",

      "content_type": "application/zip",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 18000 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultapplication/zipyesZIP archive containing all shader formats (OSL, Marmoset .frag, GLSL, HLSL, MaterialX) and the shared R/T lookup tables (EXR, HDR).Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaningmax_qubits_exceededConfiguration requires more qubits than the maximum allowed.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to entanglement-shader-v1

job = requests.post(f"{API}/engines/entanglement-shader-v1/process", headers=H,

    json={

        "params": {

            "absorption": 0.95,

            "incoming_rays": 8,

            "interaction": 1,

            "layers": 2,

            "reflectance": 0.2,

            "resolution": 60,

            "style": "peaked"

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

# 3. Fetch the result — output slots: result

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
curl -s -X POST https://api.mothquantum.com/api/v1/engines/entanglement-shader-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "absorption": 0.95,

    "incoming_rays": 8,

    "interaction": 1,

    "layers": 2,

    "reflectance": 0.2,

    "resolution": 60,

    "style": "peaked"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Generates an iridescent surface material driven by quantum entanglement.
Stacking ultra-thin conducting layers causes light to bounce and interfere,
producing angle-dependent colour shifts that no classical shader can replicate.How to use​
Invoke this endpoint with a POST request.The request body must be application/json.The body of the request must include:
reflectance

absorption

layers

incoming_rays

The body of the request may also include:
resolution

interaction

style

For more details about these parameters see the request schema below.Output​
Returns a ZIP archive containing all shader formats and shared textures:
entanglement_texture.osl  — Open Shading Language (Blender, Maya, Houdini, RenderMan).

entanglement_texture.frag — Marmoset Toolbag 4 custom shader.

entanglement_texture.glsl — Standalone GLSL fragment shader (OpenGL 3.3+).

entanglement_texture.hlsl — HLSL pixel shader (Direct3D 11 / SM 5.0).

entanglement_texture.mtlx — MaterialX material definition.

R_lut.exr / R_lut.hdr — Float32 reflectance lookup table.

T_lut.exr / T_lut.hdr — Float32 transmittance lookup table.

No quantum hardware is required at render time.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Entanglement Shader",

    "summary": "Quantum iridescent BSDF generator.",

    "description": "Entanglement Shader",

    "version": "live",

    "x-engine-id": "entanglement-shader-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "json-to-file"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 18000,

    "x-registered-at": "2026-08-27T09:52:26Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/entanglement-shader-v1"

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

    "/api/v1/engines/entanglement-shader-v1/process": {

      "post": {

        "operationId": "entanglement-shader-v1",

        "summary": "Entanglement Shader",

        "description": "Entanglement Shader",

        "x-error-codes": [

          {

            "type": "max_qubits_exceeded",

            "description": "Configuration requires more qubits than the maximum allowed."

          }

        ],

        "x-output-files": [

          {

            "name": "result",

            "content_types": [

              "application/zip"

            ],

            "required": true,

            "description": "ZIP archive containing all shader formats (OSL, Marmoset .frag, GLSL, HLSL, MaterialX) and the shared R/T lookup tables (EXR, HDR)."

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

                    "description": "Engine parameters, validated against this schema.",

                    "properties": {

                      "absorption": {

                        "default": 0.95,

                        "description": "Fraction of the maximum absorption achievable at the given reflectance.\n\n- `0` — no absorption.\n- `1` — maximum absorption and minimum transmission.\n",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Absorption",

                        "type": "number"

                      },

                      "incoming_rays": {

                        "default": 8,

                        "description": "Number of light rays entering the stack simultaneously.\n\n- Must be `>= layers` so that at least one ray is transmitted.\n- Maximum enforced by the 21-qubit budget at validation time.\n",

                        "minimum": 1,

                        "title": "Incoming Rays",

                        "type": "integer"

                      },

                      "interaction": {

                        "default": 1,

                        "description": "Strength of the nonlinear quantum interaction terms.\n\n- `0` — interaction disabled; only reflectance and absorption shape the output.\n- Positive vs. negative values of the same magnitude produce distinct colour patterns.\n",

                        "title": "Interaction",

                        "type": "number"

                      },

                      "layers": {

                        "default": 2,

                        "description": "Number of conducting sheets in the stack.\n\n- Maximum enforced by the 21-qubit budget at validation time.\n",

                        "minimum": 1,

                        "title": "Layers",

                        "type": "integer"

                      },

                      "reflectance": {

                        "default": 0.2,

                        "description": "Fraction of reflected power of a single ray and layer at normal incidence.\n\n- `0` — perfect transmittance and no absorption.\n- `1` — perfect mirror, no transmission or absorption.\n",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Reflectance",

                        "type": "number"

                      },

                      "resolution": {

                        "anyOf": [

                          {

                            "minimum": 10,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": 60,

                        "description": "Density of the angle–phase lookup table baked into the shader.\n\n- Higher values reduce banding on close-up or oblique surfaces.\n",

                        "title": "Resolution"

                      },

                      "style": {

                        "default": "peaked",

                        "description": "Selects which nonlinear interaction channels are active.\n\n- `peaked` — reflection and transmission peak at the same angle for large number of layers.\n- `frustrated` — competing interaction channels produce a non-monotone colour pattern.\n- `3-body` — three-body interactions only; subtle, low-contrast effect.\n- `constrained` — higher ray counts suppress transmission, deepening shadows.\n",

                        "enum": [

                          "peaked",

                          "frustrated",

                          "3-body",

                          "constrained"

                        ],

                        "title": "Style",

                        "type": "string"

                      }

                    },

                    "title": "Params",

                    "type": "object"

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/entanglement-shader-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"absorption\": 0.95,\n    \"incoming_rays\": 8,\n    \"interaction\": 1,\n    \"layers\": 2,\n    \"reflectance\": 0.2,\n    \"resolution\": 60,\n    \"style\": \"peaked\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to entanglement-shader-v1\njob = requests.post(f\"{API}/engines/entanglement-shader-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"absorption\": 0.95,\n            \"incoming_rays\": 8,\n            \"interaction\": 1,\n            \"layers\": 2,\n            \"reflectance\": 0.2,\n            \"resolution\": 60,\n            \"style\": \"peaked\"\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — output slots: result\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/entanglement-shader-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"absorption\": 0.95,\n      \"incoming_rays\": 8,\n      \"interaction\": 1,\n      \"layers\": 2,\n      \"reflectance\": 0.2,\n      \"resolution\": 60,\n      \"style\": \"peaked\"\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

QRC Train — qrc-train-v2, JSON → JSON

Quantum Blur — blur-v1, Image → Image

Quantum Teleblur — telablur-v1, Image → Image

