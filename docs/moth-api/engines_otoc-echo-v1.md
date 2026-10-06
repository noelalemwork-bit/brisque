Quantum EchoQuantum Echo

POST/api/v1/engines/otoc-echo-v1/processliveRun in dashboard ↗Try the API call ↗

Engineotoc-echo-v1
Versionv0.1.2
Usage1 credit / run
UpdatedSep 15, 2026

otoc-echo-v1 — Quantum Echo. A core engine.

JSON → JSONJSON result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/otoc-echo-v1/process with a JSON body:
```
{

  "params": {

    "allow_high_shots": false,

    "depth": 8,

    "disorder": 0,

    "exact": true,

    "fractional_gates": true,

    "include_taps": true,

    "include_z": false,

    "kick": "Z",

    "lattice": "chain",

    "machine": "aer",

    "min_tap_level": 0.02,

    "n_sites": 8,

    "shots": 4096,

    "theta_x": 0.9424777960769379,

    "theta_z": 0,

    "theta_zz": 1.0995574287564276,

    "twirls": 1,

    "via": "direct"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionallow_high_shotsbooleannofalsePermit shots above 8192 (QPU time scales linearly).depthintegerno8Echo depths t = 1..depth — the tap time slots. Each circuit has 2·depth layers. (min 1, max 32)disordernumberno0Additive per-gate angle jitter, std in radians. 0 = clean Floquet. Localises the echo; the only lever that makes seed matter. (min 0, max 1)exactbooleannotrueaer only: exact (infinite-shot) expectation values instead of sampling.fractional_gatesbooleannotrueUse native rzz/rx on hardware where available. Halves the forward half's two-qubit count; disables gate twirling.heightinteger | nullnonullSquare lattice height. Required for square.include_tapsbooleannotrueAlso emit a flattened tap list (site, depth, F_re, F_im, level, polarity) in extras.include_zbooleannofalseAlso measure <Z_i>, completing each site's Bloch vector. Free on aer; a third measurement basis (1.5x shots) on hardware.kickstringno"Z"Perturbation Pauli applied to the kick site between U and U†. (one of Z, Y, X)kick_siteinteger | nullnonullRegeneration source: the site that receives the impulse. Default: centre.latticestringno"chain"Topology of the delay line. chain: site → pan. square (Nighthawk-native): x → pan, y → diffusion. (one of chain, square)machinestringno"aer"Backend: 'aer' (local, noiseless) or an IBM backend name such as 'ibm_phoenix'.min_tap_levelnumberno0.02|F| threshold for the emitted tap list. (min 0, max 1)n_sitesintegerno8Chain length in qubits (= pan positions). Ignored for square. (min 2, max 156)qpu_instancestring | nullnonullIBM Quantum instance CRN. As with the token: required for via: direct, optional BYOK for via: mothbackend. (format password)qpu_tokenstring | nullnonullIBM Quantum API token. Required for via: direct on an IBM machine (or the QISKIT_IBM_TOKEN env var); optional BYOK for via: mothbackend, which otherwise uses Moth's own credentials. (format password)ref_floornumber | nullnonull|c_ref| below which F is null. Default: 4/sqrt(shots), ~0 for exact simulation.seedinteger | nullnonullRNG seed for the disorder realisation. Only audible when disorder > 0. Drawn as a 31-bit integer and returned in provenance if omitted. Capped at 2**53-1: above that, moth-api (Go) and any browser client re-spell the integer as a float64 and it stops matching the seed you sent.shotsintegerno4096Shots per circuit. Ignored when machine='aer' and exact=true. Above 8192 requires allow_high_shots. (min 1)theta_xnumberno0.9424777960769379Transverse kick per layer (RX angle, rad). The 'how quantum' dial: low → loud regular taps; high → inverted, attenuated, erased. (min 0, max 3.141592653589793)theta_znumberno0Phase layer (RZ angle, rad). 0 → real, two-signed F. >0 → complex F: taps acquire a phase. (min 0, max 3.141592653589793)theta_zznumberno1.0995574287564276Coupling per layer (RZZ, rad). Non-monotonic: ≈0.25π is the sparse setting. π is a Clifford (no scrambling). θ and π−θ coincide only when theta_x = 0, not at the default drive, so the upper half of the range is its own territory. The sign is invisible unless theta_z > 0. (max 3.141592653589793)twirlsintegerno1ZZ-commutant Pauli twirls per circuit, averaged. Randomises off-axis coherent rzz error (not angle miscalibration, which the reference run absorbs). Multiplies circuit count. (min 1, max 32)viastringno"direct"How to reach the machine. direct: this engine drives qiskit-ibm-runtime itself (analytic emulation, native fractional gates, one batched QPU session). mothbackend: route through Moth's execution service, which holds the credentials — sampled only, so no analytic mode, no fractional gates, and one submission per circuit. (one of direct, mothbackend)widthinteger | nullnonullSquare lattice width. Required for square.
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

result holds this engine's JSON inline. The engine author has not documented its fields yet.A run still going after 7200 s is cancelled and the job ends failed.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_paramsparams fail Params' own field validation (type/range) or a cross-field check (square lattice without width/height, kick_site outside the line, shots over the cap without allow_high_shots).too_many_qubitsthe delay line needs more qubits than the machine allows — 24 for aer, the device's own width for an IBM backend.invalid_machinemachine is neither 'aer' nor an IBM backend name the runtime knows.backend_unavailablethe requested execution route could not be reached — for via: direct, qiskit-ibm-runtime is missing or no credentials were supplied (qpu_token param / QISKIT_IBM_TOKEN); for via: mothbackend, the mothbackend package is absent or the service returned a transport error. Retryable.execution_failedthe estimator returned an error while running the echo circuits.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to otoc-echo-v1

job = requests.post(f"{API}/engines/otoc-echo-v1/process", headers=H,

    json={

        "params": {

            "allow_high_shots": False,

            "depth": 8,

            "disorder": 0,

            "exact": True,

            "fractional_gates": True,

            "include_taps": True,

            "include_z": False,

            "kick": "Z",

            "lattice": "chain",

            "machine": "aer",

            "min_tap_level": 0.02,

            "n_sites": 8,

            "shots": 4096,

            "theta_x": 0.9424777960769379,

            "theta_z": 0,

            "theta_zz": 1.0995574287564276,

            "twirls": 1,

            "via": "direct"

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
curl -s -X POST https://api.mothquantum.com/api/v1/engines/otoc-echo-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "allow_high_shots": false,

    "depth": 8,

    "disorder": 0,

    "exact": true,

    "fractional_gates": true,

    "include_taps": true,

    "include_z": false,

    "kick": "Z",

    "lattice": "chain",

    "machine": "aer",

    "min_tap_level": 0.02,

    "n_sites": 8,

    "shots": 4096,

    "theta_x": 0.9424777960769379,

    "theta_z": 0,

    "theta_zz": 1.0995574287564276,

    "twirls": 1,

    "via": "direct"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Thin wrapper over the quantum-echo library: this file owns the platform contract
(params schema, validation, credits, estimate, the typed result envelope) and the
library owns the physics. Same relationship qdrive-api has with QDrive.params -> EchoSpec -> quantum_echo.measure_ir -> EchoIR.to_trajectory()Media engines (retrocausal-echo-v1 and friends) depend on the same library and either
call measure_ir in-process or rebuild an IR from this engine's result with
EchoIR.from_trajectory. Neither path reimplements the measurement.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Quantum Echo",

    "summary": "Perturb a scrambled qubit chain, reverse it, and listen for what returns — a signed, complex multi-tap delay map.",

    "description": "otoc-echo-v1 — Quantum Echo. A **core** engine.",

    "version": "0.1.2",

    "x-engine-id": "otoc-echo-v1",

    "x-engine-version": "0.1.2",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "json-to-json"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 7200,

    "x-registered-at": "2026-09-15T01:31:51Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/otoc-echo-v1"

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

    "/api/v1/engines/otoc-echo-v1/process": {

      "post": {

        "operationId": "otoc-echo-v1",

        "summary": "Quantum Echo",

        "description": "otoc-echo-v1 — Quantum Echo. A **core** engine.",

        "x-error-codes": [

          {

            "type": "invalid_params",

            "description": "params fail Params' own field validation (type/range) or a cross-field check (square lattice without width/height, kick_site outside the line, shots over the cap without allow_high_shots)."

          },

          {

            "type": "too_many_qubits",

            "description": "the delay line needs more qubits than the machine allows — 24 for aer, the device's own width for an IBM backend."

          },

          {

            "type": "invalid_machine",

            "description": "machine is neither 'aer' nor an IBM backend name the runtime knows."

          },

          {

            "type": "backend_unavailable",

            "description": "the requested execution route could not be reached — for `via: direct`, qiskit-ibm-runtime is missing or no credentials were supplied (qpu_token param / QISKIT_IBM_TOKEN); for `via: mothbackend`, the mothbackend package is absent or the service returned a transport error. Retryable."

          },

          {

            "type": "execution_failed",

            "description": "the estimator returned an error while running the echo circuits."

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

                        "description": "Permit shots above 8192 (QPU time scales linearly).",

                        "title": "Allow High Shots",

                        "type": "boolean"

                      },

                      "depth": {

                        "default": 8,

                        "description": "Echo depths t = 1..depth — the tap time slots. Each circuit has 2·depth layers.",

                        "maximum": 32,

                        "minimum": 1,

                        "title": "Depth",

                        "type": "integer"

                      },

                      "disorder": {

                        "default": 0,

                        "description": "Additive per-gate angle jitter, std in radians. 0 = clean Floquet. Localises the echo; the only lever that makes `seed` matter.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Disorder",

                        "type": "number"

                      },

                      "exact": {

                        "default": true,

                        "description": "aer only: exact (infinite-shot) expectation values instead of sampling.",

                        "title": "Exact",

                        "type": "boolean"

                      },

                      "fractional_gates": {

                        "default": true,

                        "description": "Use native rzz/rx on hardware where available. Halves the forward half's two-qubit count; disables gate twirling.",

                        "title": "Fractional Gates",

                        "type": "boolean"

                      },

                      "height": {

                        "anyOf": [

                          {

                            "maximum": 32,

                            "minimum": 2,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Square lattice height. Required for `square`.",

                        "title": "Height"

                      },

                      "include_taps": {

                        "default": true,

                        "description": "Also emit a flattened tap list (site, depth, F_re, F_im, level, polarity) in extras.",

                        "title": "Include Taps",

                        "type": "boolean"

                      },

                      "include_z": {

                        "default": false,

                        "description": "Also measure <Z_i>, completing each site's Bloch vector. Free on aer; a third measurement basis (1.5x shots) on hardware.",

                        "title": "Include Z",

                        "type": "boolean"

                      },

                      "kick": {

                        "default": "Z",

                        "description": "Perturbation Pauli applied to the kick site between U and U†.",

                        "enum": [

                          "Z",

                          "Y",

                          "X"

                        ],

                        "title": "Kick",

                        "type": "string"

                      },

                      "kick_site": {

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

                        "description": "Regeneration source: the site that receives the impulse. Default: centre.",

                        "title": "Kick Site"

                      },

                      "lattice": {

                        "default": "chain",

                        "description": "Topology of the delay line. `chain`: site → pan. `square` (Nighthawk-native): x → pan, y → diffusion.",

                        "enum": [

                          "chain",

                          "square"

                        ],

                        "title": "Lattice",

                        "type": "string"

                      },

                      "machine": {

                        "default": "aer",

                        "description": "Backend: 'aer' (local, noiseless) or an IBM backend name such as 'ibm_phoenix'.",

                        "title": "Machine",

                        "type": "string"

                      },

                      "min_tap_level": {

                        "default": 0.02,

                        "description": "|F| threshold for the emitted tap list.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Min Tap Level",

                        "type": "number"

                      },

                      "n_sites": {

                        "default": 8,

                        "description": "Chain length in qubits (= pan positions). Ignored for `square`.",

                        "maximum": 156,

                        "minimum": 2,

                        "title": "N Sites",

                        "type": "integer"

                      },

                      "qpu_instance": {

                        "anyOf": [

                          {

                            "type": "string"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "IBM Quantum instance CRN. As with the token: required for `via: direct`, optional BYOK for `via: mothbackend`.",

                        "format": "password",

                        "title": "Qpu Instance",

                        "writeOnly": true

                      },

                      "qpu_token": {

                        "anyOf": [

                          {

                            "type": "string"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "IBM Quantum API token. Required for `via: direct` on an IBM machine (or the QISKIT_IBM_TOKEN env var); optional BYOK for `via: mothbackend`, which otherwise uses Moth's own credentials.",

                        "format": "password",

                        "title": "Qpu Token",

                        "writeOnly": true

                      },

                      "ref_floor": {

                        "anyOf": [

                          {

                            "exclusiveMinimum": 0,

                            "maximum": 1,

                            "type": "number"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "|c_ref| below which F is null. Default: 4/sqrt(shots), ~0 for exact simulation.",

                        "title": "Ref Floor"

                      },

                      "seed": {

                        "anyOf": [

                          {

                            "maximum": 9007199254740991,

                            "minimum": 0,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "RNG seed for the disorder realisation. Only audible when disorder > 0. Drawn as a 31-bit integer and returned in provenance if omitted. Capped at 2**53-1: above that, moth-api (Go) and any browser client re-spell the integer as a float64 and it stops matching the seed you sent.",

                        "title": "Seed"

                      },

                      "shots": {

                        "default": 4096,

                        "description": "Shots per circuit. Ignored when machine='aer' and exact=true. Above 8192 requires allow_high_shots.",

                        "minimum": 1,

                        "title": "Shots",

                        "type": "integer"

                      },

                      "theta_x": {

                        "default": 0.9424777960769379,

                        "description": "Transverse kick per layer (RX angle, rad). The 'how quantum' dial: low → loud regular taps; high → inverted, attenuated, erased.",

                        "maximum": 3.141592653589793,

                        "minimum": 0,

                        "title": "Theta X",

                        "type": "number"

                      },

                      "theta_z": {

                        "default": 0,

                        "description": "Phase layer (RZ angle, rad). 0 → real, two-signed F. >0 → complex F: taps acquire a phase.",

                        "maximum": 3.141592653589793,

                        "minimum": 0,

                        "title": "Theta Z",

                        "type": "number"

                      },

                      "theta_zz": {

                        "default": 1.0995574287564276,

                        "description": "Coupling per layer (RZZ, rad). Non-monotonic: ≈0.25π is the sparse setting. π is a Clifford (no scrambling). θ and π−θ coincide only when theta_x = 0, not at the default drive, so the upper half of the range is its own territory. The sign is invisible unless theta_z > 0.",

                        "exclusiveMinimum": -3.141592653589793,

                        "maximum": 3.141592653589793,

                        "title": "Theta Zz",

                        "type": "number"

                      },

                      "twirls": {

                        "default": 1,

                        "description": "ZZ-commutant Pauli twirls per circuit, averaged. Randomises off-axis coherent rzz error (not angle miscalibration, which the reference run absorbs). Multiplies circuit count.",

                        "maximum": 32,

                        "minimum": 1,

                        "title": "Twirls",

                        "type": "integer"

                      },

                      "via": {

                        "default": "direct",

                        "description": "How to reach the machine. `direct`: this engine drives qiskit-ibm-runtime itself (analytic emulation, native fractional gates, one batched QPU session). `mothbackend`: route through Moth's execution service, which holds the credentials — sampled only, so no analytic mode, no fractional gates, and one submission per circuit.",

                        "enum": [

                          "direct",

                          "mothbackend"

                        ],

                        "title": "Via",

                        "type": "string"

                      },

                      "width": {

                        "anyOf": [

                          {

                            "maximum": 32,

                            "minimum": 2,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Square lattice width. Required for `square`.",

                        "title": "Width"

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/otoc-echo-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"allow_high_shots\": false,\n    \"depth\": 8,\n    \"disorder\": 0,\n    \"exact\": true,\n    \"fractional_gates\": true,\n    \"include_taps\": true,\n    \"include_z\": false,\n    \"kick\": \"Z\",\n    \"lattice\": \"chain\",\n    \"machine\": \"aer\",\n    \"min_tap_level\": 0.02,\n    \"n_sites\": 8,\n    \"shots\": 4096,\n    \"theta_x\": 0.9424777960769379,\n    \"theta_z\": 0,\n    \"theta_zz\": 1.0995574287564276,\n    \"twirls\": 1,\n    \"via\": \"direct\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to otoc-echo-v1\njob = requests.post(f\"{API}/engines/otoc-echo-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"allow_high_shots\": False,\n            \"depth\": 8,\n            \"disorder\": 0,\n            \"exact\": True,\n            \"fractional_gates\": True,\n            \"include_taps\": True,\n            \"include_z\": False,\n            \"kick\": \"Z\",\n            \"lattice\": \"chain\",\n            \"machine\": \"aer\",\n            \"min_tap_level\": 0.02,\n            \"n_sites\": 8,\n            \"shots\": 4096,\n            \"theta_x\": 0.9424777960769379,\n            \"theta_z\": 0,\n            \"theta_zz\": 1.0995574287564276,\n            \"twirls\": 1,\n            \"via\": \"direct\"\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — inline JSON\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nprint(res[\"result\"])"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/otoc-echo-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"allow_high_shots\": false,\n      \"depth\": 8,\n      \"disorder\": 0,\n      \"exact\": true,\n      \"fractional_gates\": true,\n      \"include_taps\": true,\n      \"include_z\": false,\n      \"kick\": \"Z\",\n      \"lattice\": \"chain\",\n      \"machine\": \"aer\",\n      \"min_tap_level\": 0.02,\n      \"n_sites\": 8,\n      \"shots\": 4096,\n      \"theta_x\": 0.9424777960769379,\n      \"theta_z\": 0,\n      \"theta_zz\": 1.0995574287564276,\n      \"twirls\": 1,\n      \"via\": \"direct\"\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — inline JSON\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nconsole.log(res.result);"

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

Quantum Graph Engine — graph-v1, JSON → JSON

