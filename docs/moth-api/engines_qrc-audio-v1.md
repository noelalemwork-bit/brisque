QRC AudioQRC Audio

POST/api/v1/engines/qrc-audio-v1/processliveRun in dashboard ↗Try the API call ↗

Engineqrc-audio-v1
Usage5 credits / run
UpdatedAug 25, 2026

qrc-audio-v1 — sequence audio with a quantum reservoir.

Audio → Audio3 file slotsfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/qrc-audio-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "chunk_seconds": 1,

    "crossfade": 0,

    "length": 10,

    "loop": true,

    "quality": "moderate",

    "variation": 1

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptionchunk_secondsnumberno1Length of each chunk in seconds when splitting the audio file. Ignored when chunks is given.crossfadeintegerno0Milliseconds of crossfade between chunks (0 = hard cuts). (min 0, max 1000)lengthintegerno10How many chunks to string together in the output (max 500)loopbooleannotrueTreat the audio as looping material — the end flows back into the start. Learning only.qualitystringno"moderate"How hard to train when learning a fresh piece (no model): instant skips training for a quick untrained shuffle; fast is quick and rough; complete is slow and tight. (one of instant, fast, moderate, complete)seedinteger | nullnonullChange for a different result, keep fixed to reproduce one. On a fresh piece it also fixes the learned reservoir; when reusing a model it just varies the take, so you can fan out independent takes by changing it.training_sequencearray | nullnonullAdvanced — chunk filenames in a specific order to learn. Omit to learn the chunks' natural order. Ignored when a model is given.variationnumberno1How freely the result departs from the learned order: low = tight and repetitive, high = loose and surprising.Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionaudioaudio/wav, audio/x-wav, audio/mpeg, audio/ogg, audio/flacnochunksapplication/zipnomodelapplication/jsonno
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

      "filename": "qrc-audio-v1-1b9d6bcd-result.wav",

      "content_type": "audio/wav",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    },

    {

      "slot": "state",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345671",

      "filename": "qrc-audio-v1-1b9d6bcd-state.json",

      "content_type": "application/json",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/state?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    },

    {

      "slot": "vocabulary",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345672",

      "filename": "qrc-audio-v1-1b9d6bcd-vocabulary.bin",

      "content_type": "application/zip",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/vocabulary?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    },

    {

      "slot": "model",

      "output_asset_id": "9f8e7d6c-5b4a-4d21-8abc-def012345673",

      "filename": "qrc-audio-v1-1b9d6bcd-model.json",

      "content_type": "application/json",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/model?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 3600 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultaudio/wavyesThe generated remix WAV.stateapplication/jsonyesAdvanced reservoir state; reuse on a later call as job:<id>/state.vocabularyapplication/zipyesZip of chunk WAVs (filenames are tokens); reuse as job:<id>/vocabulary.modelapplication/jsonnoPristine trained model for fan-out; reuse as job:<id>/model.
Generated from this engine's definition: submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Submit to qrc-audio-v1

job = requests.post(f"{API}/engines/qrc-audio-v1/process", headers=H,

    json={

        "params": {

            "chunk_seconds": 1,

            "crossfade": 0,

            "length": 10,

            "loop": True,

            "quality": "moderate",

            "variation": 1

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

# 3. Fetch the result — output slots: result, state, vocabulary, model

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
curl -s -X POST https://api.mothquantum.com/api/v1/engines/qrc-audio-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "chunk_seconds": 1,

    "crossfade": 0,

    "length": 10,

    "loop": true,

    "quality": "moderate",

    "variation": 1

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
A self-contained hybrid engine: one call trains a reservoir over a vocabulary of audio chunks,
generates a new ordering of them, and concatenates the chosen chunks back into one WAV. Each chunk's
filename is a token — the reservoir work is delegated to qrc_core (train/generate/state); this
engine only owns the audio codec (split/merge) and the audio-friendly parameter surface.The chunk vocabulary comes from EITHER:
audio  — a raw file the engine splits into fixed-length chunks (via media-utils), or

chunks — a pre-split zip of WAV chunks (filenames are the tokens).

quality: "instant" skips training entirely (a quick untrained shuffle); the other levels train.Three seed paths, chosen by which inputs arrive (no mode flag):
no model, quality != instant -> TRAIN, then generate. Emits a pristine files.model (reusable
for fan-out) plus the advanced files.state.

no model, quality == instant -> untrained shuffle, emits files.state only.

model given -> reuse it: a pristine model (job:&lt;id>/model) fans out an INDEPENDENT take (vary
seed); an advanced state (job:&lt;id>/state) CONTINUES that trajectory.

files.vocabulary (the chunk zip) rides alongside — reference it as job:&lt;id>/vocabulary on later calls.Reservoir tuning (qubits, shots, epochs, windowing) lives in reservoir_tuning.py — a self-contained
"don't touch" file. Everything here is audio: the chunk codec and the request/response flow.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — QRC Audio",

    "summary": "Sequence audio with a quantum reservoir — split a file into chunks, learn their order, and generate a new arrangement as one WAV.",

    "description": "qrc-audio-v1 — sequence audio with a quantum reservoir.",

    "version": "live",

    "x-engine-id": "qrc-audio-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "audio-to-audio"

    ],

    "x-credits-per-run": 5,

    "x-timeout-seconds": 3600,

    "x-registered-at": "2026-08-18T15:45:32Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/qrc-audio-v1"

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

    "/api/v1/engines/qrc-audio-v1/process": {

      "post": {

        "operationId": "qrc-audio-v1",

        "summary": "QRC Audio",

        "description": "qrc-audio-v1 — sequence audio with a quantum reservoir.",

        "x-error-codes": [],

        "x-output-files": [

          {

            "name": "result",

            "content_types": [

              "audio/wav"

            ],

            "required": true,

            "description": "The generated remix WAV."

          },

          {

            "name": "state",

            "content_types": [

              "application/json"

            ],

            "required": true,

            "description": "Advanced reservoir state; reuse on a later call as job:<id>/state."

          },

          {

            "name": "vocabulary",

            "content_types": [

              "application/zip"

            ],

            "required": true,

            "description": "Zip of chunk WAVs (filenames are tokens); reuse as job:<id>/vocabulary."

          },

          {

            "name": "model",

            "content_types": [

              "application/json"

            ],

            "required": false,

            "description": "Pristine trained model for fan-out; reuse as job:<id>/model."

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

                      "chunk_seconds": {

                        "default": 1,

                        "description": "Length of each chunk in seconds when splitting the `audio` file. Ignored when `chunks` is given.",

                        "exclusiveMinimum": 0,

                        "title": "Chunk Seconds",

                        "type": "number"

                      },

                      "crossfade": {

                        "default": 0,

                        "description": "Milliseconds of crossfade between chunks (0 = hard cuts).",

                        "maximum": 1000,

                        "minimum": 0,

                        "title": "Crossfade",

                        "type": "integer"

                      },

                      "length": {

                        "default": 10,

                        "description": "How many chunks to string together in the output",

                        "exclusiveMinimum": 0,

                        "maximum": 500,

                        "title": "Length",

                        "type": "integer"

                      },

                      "loop": {

                        "default": true,

                        "description": "Treat the audio as looping material — the end flows back into the start. Learning only.",

                        "title": "Loop",

                        "type": "boolean"

                      },

                      "quality": {

                        "default": "moderate",

                        "description": "How hard to train when learning a fresh piece (no `model`): instant skips training for a quick untrained shuffle; fast is quick and rough; complete is slow and tight.",

                        "enum": [

                          "instant",

                          "fast",

                          "moderate",

                          "complete"

                        ],

                        "title": "Quality",

                        "type": "string"

                      },

                      "seed": {

                        "anyOf": [

                          {

                            "maximum": 4294967295,

                            "minimum": 0,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Change for a different result, keep fixed to reproduce one. On a fresh piece it also fixes the learned reservoir; when reusing a `model` it just varies the take, so you can fan out independent takes by changing it.",

                        "title": "Seed"

                      },

                      "training_sequence": {

                        "anyOf": [

                          {

                            "items": {

                              "type": "string"

                            },

                            "type": "array"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": null,

                        "description": "Advanced — chunk filenames in a specific order to learn. Omit to learn the chunks' natural order. Ignored when a `model` is given.",

                        "title": "Training Sequence"

                      },

                      "variation": {

                        "default": 1,

                        "description": "How freely the result departs from the learned order: low = tight and repetitive, high = loose and surprising.",

                        "exclusiveMinimum": 0,

                        "title": "Variation",

                        "type": "number"

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

                      "audio": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Accepts: audio/wav, audio/x-wav, audio/mpeg, audio/ogg, audio/flac."

                      },

                      "chunks": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Accepts: application/zip."

                      },

                      "model": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Accepts: application/json."

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

            "source": "curl -s -X POST https://api.mothquantum.com/api/v1/engines/qrc-audio-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"chunk_seconds\": 1,\n    \"crossfade\": 0,\n    \"length\": 10,\n    \"loop\": true,\n    \"quality\": \"moderate\",\n    \"variation\": 1\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Submit to qrc-audio-v1\njob = requests.post(f\"{API}/engines/qrc-audio-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"chunk_seconds\": 1,\n            \"crossfade\": 0,\n            \"length\": 10,\n            \"loop\": True,\n            \"quality\": \"moderate\",\n            \"variation\": 1\n        }\n    }).json()\n\n# 2. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 3. Fetch the result — output slots: result, state, vocabulary, model\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "const API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Submit\nconst job = await (await fetch(`${API}/engines/qrc-audio-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"chunk_seconds\": 1,\n      \"crossfade\": 0,\n      \"length\": 10,\n      \"loop\": true,\n      \"quality\": \"moderate\",\n      \"variation\": 1\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result, state, vocabulary, model\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

QRC Generate — qrc-gen-v2, File → JSON

QRC MIDI — qrc-midi-v1, Audio → Audio

Retrocausal Echo — retrocausal-echo-v1, Audio → Audio

QDrive — qdrive-api-v1, Text → Text

