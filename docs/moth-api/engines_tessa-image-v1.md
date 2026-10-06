Tessa ImageTessa Image

POST/api/v1/engines/tessa-image-v1/processliveRun in dashboard ↗Try the API call ↗

Enginetessa-image-v1
Usage1 credit / run
UpdatedSep 15, 2026

Encode an image onto a quantum device using Tessa (the iqpixl library).

Image → Image1 file slotfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/tessa-image-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "distortion": 0,

    "fixed_palette": false,

    "gate_pauli": "XZ",

    "machine": "aer",

    "range_correction": false,

    "separate_rgb": true,

    "shots": 4096

  },

  "input_files": {

    "image": "9f8e7d6c-5b4a-4d21-8abc-def012345678"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptiondistortionnumberno0Alpha for the exp(ialpha/2(P⊗Q)) gate applied between adjacent data qubits in transform_channels, where (P, Q) is gate_pauli.fixed_palettebooleannofalseImport the image through a palette of its own colours (capped at 256) and run only the resulting per-pixel palette index through the device -- as exact, losslessly-quantized levels -- instead of decomposing it into the continuous colour-sphere coordinates. Good for flat-color/graphic-style images.gate_paulistringno"XZ"Which two-qubit Pauli pair (P, Q) to use for the exp(idistortion/2(P⊗Q)) gate applied between adjacent data qubits in transform_channels, e.g. 'XY', 'ZZ'. (pattern ^[IXYZ]{2}$)machinestringno"aer"Where to run the circuit. 'aer' is a noiseless local simulator. 'fake_<chip>' options (e.g. 'fake_fez', 'fake_sherbrooke', 'fake_torino') are local simulators calibrated to a real current IBM chip's noise. 'ibm_<chip>' options (e.g. 'ibm_fez', 'ibm_miami', 'ibm_marrakesh') submit to that real IBM Quantum hardware; 'least_busy' submits to whichever operational device currently has the shortest queue. (one of aer, ibm_fez, ibm_miami, ibm_marrakesh, least_busy, fake_fez, fake_marrakesh, fake_torino, fake_brisbane, fake_kyiv, fake_sherbrooke, fake_kyoto, fake_osaka, fake_quebec, fake_cusco, fake_strasbourg, fake_brussels)range_correctionbooleannofalseStretch each decoded field back over its original dynamic range. Off by default -- the raw decoded values are used as-is, with no correction.separate_rgbbooleannotrueGive each of the three colour coordinates its own circuit. Turn this off to put the two angles on one circuit instead: a qubit is cos(theta/2)|0> + e^(i phi)|1>, so the sphere's polar angle can ride in the rotation and hue in the phase of the same cell, turning three circuits into two at the cost of a second measurement setting and a noisier reconstruction. Ignored when fixed_palette is set.shotsintegerno4096Number of measurement shots to sample, per processed field.Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionimageimage/png, image/jpeg, image/webp, image/tiff, image/bmpyesThe image to encode. By default every pixel becomes a point on the colour sphere -- a radius and two angles, the same coordinates that describe a qubit's own state -- and each of those three goes through the quantum encode/measure/decode round trip, any that doesn't vary passed through unencoded, before the image is recomposed. With fixed_palette the image is instead quantized to a palette of its own colours (capped at 256) and only the per-pixel palette index makes the trip. The alpha channel, if any, passes through unchanged.
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

      "filename": "tessa-image-v1-1b9d6bcd-result.png",

      "content_type": "image/png",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 18000 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultimage/pngyesThe recomposed image after the quantum round trip.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_imageThe image file could not be decoded.distortion_without_hardwaredistortion is greater than 0 on a machine that reads out per-group (every machine except real IBM hardware) -- the cross-cell gate it adds is silently dropped there, so it would have no effect.too_many_valuesthe image's pixel count exceeds the largest supported simulated lattice (64x64).insufficient_qubitsthe image still exceeds the selected machine's data-qubit capacity after being downsampled to fit it -- a degenerate-case fallback, not the normal outcome for an oversized image.unsupported_machinethe requested machine name isn't recognized.ibm_connection_failedCould not authenticate/connect to IBM Quantum with the given token/instance.submission_failedThe transpiled circuit was rejected or the sampling job failed to submit.encoding_failedThe output image could not be encoded.
Generated from this engine's definition: upload, submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Upload the input as an asset (slot "image": image/png, image/jpeg, image/webp, image/tiff, image/bmp)

path = Path("input.png"); data = path.read_bytes()

asset = requests.post(f"{API}/assets", headers=H,

    json={"filename": path.name, "content_type": "image/png", "size_bytes": len(data)}).json()

requests.put(asset["upload"]["url"], data=data, headers=asset["upload"]["headers"]).raise_for_status()

requests.post(f"{API}/assets/{asset['asset_id']}/complete", headers=H).raise_for_status()

asset_id = asset["asset_id"]

# 2. Submit to tessa-image-v1

job = requests.post(f"{API}/engines/tessa-image-v1/process", headers=H,

    json={

        "params": {

            "distortion": 0,

            "fixed_palette": False,

            "gate_pauli": "XZ",

            "machine": "aer",

            "range_correction": False,

            "separate_rgb": True,

            "shots": 4096

        },

        "input_files": {

            "image": asset_id

        }

    }).json()

# 3. Poll until terminal

while True:

    st = requests.get(f"{API}/jobs/{job['job_id']}/status", headers=H).json()

    if st["status"] in ("completed", "failed", "cancelled"):

        break

    time.sleep(2)

if st["status"] != "completed":

    raise RuntimeError(f"job {st['status']}: {st['error']}")

# 4. Fetch the result — output slots: result

res = requests.get(f"{API}/jobs/{job['job_id']}/result", headers=H).json()

for out in res["outputs"]:

    Path(out["slot"]).write_bytes(requests.get(out["url"]).content)

```

```
# Upload first — see the Assets guide; put the returned asset_id in input_files.

curl -s -X POST https://api.mothquantum.com/api/v1/engines/tessa-image-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "distortion": 0,

    "fixed_palette": false,

    "gate_pauli": "XZ",

    "machine": "aer",

    "range_correction": false,

    "separate_rgb": true,

    "shots": 4096

  },

  "input_files": {

    "image": "$ASSET_ID"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
The pipeline is three steps, and run is those three calls:image  ->  circuits  ->  circuits  ->  image
encode_    transform_   decode_
channels    channels     channelsencode_channels splits the image into fields and writes each onto its own
circuit. transform_channels is the seam -- the image is on the circuits and
nothing has run yet, so gates appended there change the picture, computed on
the device rather than on the array. decode_channels measures what comes out
and turns it back into fields. Only the middle step is optional; it is the
identity today.The colour sphere. Every pixel is a point on it
(media_utils.image.rgb_to_sphere): 50% grey at the centre, the white pole at
theta = 0, the black pole at theta = pi, maximum brightness and
saturation around the equator, and hue as the azimuth phi. A colour is
therefore (r, theta, phi) -- a radius and the two angles of a direction --
which is the same shape as a qubit's own state,
cos(theta/2)|0> + e^\{i phi} sin(theta/2)|1>. That is what makes gates in the
middle step mean something: a rotation on a cell is a rotation of a colour.
theta is bent toward the equator on the way in and bent back on the way out
(_EQUATOR_PULL), which is exactly reversible and gives the saturated colours
more of the encoded range than the near-white and near-black caps.What lands on a channel is chosen by two flags:
Params.separate_rgb (default) puts r, theta and phi on three
circuits. Turn it off and theta/phi share one cell -- see
_encode_angle_pair.

Params.fixed_palette replaces the sphere entirely: the image is quantized
to a palette of its own colours (capped at 256, see _read_as_palette) and
only the per-pixel palette index -- one discrete
channel -- makes the trip, encoded losslessly via iqpixl's codebook
quantization. Good for flat-colour/graphic-style images where the
discreteness itself should survive the round trip.

How a channel is read back is decode's per_group flag:
per_group=True -- one tiny (<= 4-qubit) sub-circuit per data qubit. This
is what makes noisy whole-chip simulation cheap (machine="aer" /
"fake_&lt;chip>"): a 156-qubit noise model would be infeasible to simulate
jointly, but each data qubit's own local sub-circuit is exactly its reduced
state by the bipartite construction, independent of every other group. It
also means a gate spanning two cells is dropped -- see transform_channels.

per_group=False -- the whole circuit read out in one joint measurement.
This is what you want on real hardware (machine="ibm_fez" / "ibm_miami"
/ "least_busy"): one job beats one job per data qubit.

Params.sampler is the SamplerV2-like primitive built automatically from
Params.machine -- see topology.build_sampler. Params.shots defaults to
4096 and must be positive -- there's no exact/noiseless mode for a sampled run.Every field is encoded, including one that turns out to be constant (hue on a
grayscale image, all three on a flat-colour one). That costs a circuit it can't
learn anything from, but it costs nothing in accuracy: a constant field
normalises to a single angle, and on a noiseless machine the device reproduces
that angle deterministically. The one caveat is shot starvation -- the shots
are split across each cell's 2**degree address configurations, and a
configuration that draws none at all has no counts to invert, so at very low
Params.shots a pixel here or there can still come back wrong.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Tessa Image",

    "summary": "Encode an image's colours as points on a sphere with the Tessa quantum encoder and read them back",

    "description": "Encode an image onto a quantum device using Tessa (the `iqpixl` library).",

    "version": "live",

    "x-engine-id": "tessa-image-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-capabilities": [

      "image-to-image"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 18000,

    "x-registered-at": "2026-08-28T05:25:03Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/tessa-image-v1"

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

    "/api/v1/engines/tessa-image-v1/process": {

      "post": {

        "operationId": "tessa-image-v1",

        "summary": "Tessa Image",

        "description": "Encode an image onto a quantum device using Tessa (the `iqpixl` library).",

        "x-error-codes": [

          {

            "type": "invalid_image",

            "description": "The image file could not be decoded."

          },

          {

            "type": "distortion_without_hardware",

            "description": "distortion is greater than 0 on a machine that reads out per-group (every machine except real IBM hardware) -- the cross-cell gate it adds is silently dropped there, so it would have no effect."

          },

          {

            "type": "too_many_values",

            "description": "the image's pixel count exceeds the largest supported simulated lattice (64x64)."

          },

          {

            "type": "insufficient_qubits",

            "description": "the image still exceeds the selected machine's data-qubit capacity after being downsampled to fit it -- a degenerate-case fallback, not the normal outcome for an oversized image."

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

          },

          {

            "type": "encoding_failed",

            "description": "The output image could not be encoded."

          }

        ],

        "x-output-files": [

          {

            "name": "result",

            "content_types": [

              "image/png"

            ],

            "required": true,

            "description": "The recomposed image after the quantum round trip."

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

                      "distortion": {

                        "default": 0,

                        "description": "Alpha for the exp(i*alpha/2*(P⊗Q)) gate applied between adjacent data qubits in transform_channels, where (P, Q) is `gate_pauli`.",

                        "title": "Distortion",

                        "type": "number"

                      },

                      "fixed_palette": {

                        "default": false,

                        "description": "Import the image through a palette of its own colours (capped at 256) and run only the resulting per-pixel palette index through the device -- as exact, losslessly-quantized levels -- instead of decomposing it into the continuous colour-sphere coordinates. Good for flat-color/graphic-style images.",

                        "title": "Fixed Palette",

                        "type": "boolean"

                      },

                      "gate_pauli": {

                        "default": "XZ",

                        "description": "Which two-qubit Pauli pair (P, Q) to use for the exp(i*distortion/2*(P⊗Q)) gate applied between adjacent data qubits in transform_channels, e.g. 'XY', 'ZZ'.",

                        "pattern": "^[IXYZ]{2}$",

                        "title": "Gate Pauli",

                        "type": "string"

                      },

                      "machine": {

                        "default": "aer",

                        "description": "Where to run the circuit. 'aer' is a noiseless local simulator. 'fake_<chip>' options (e.g. 'fake_fez', 'fake_sherbrooke', 'fake_torino') are local simulators calibrated to a real current IBM chip's noise. 'ibm_<chip>' options (e.g. 'ibm_fez', 'ibm_miami', 'ibm_marrakesh') submit to that real IBM Quantum hardware; 'least_busy' submits to whichever operational device currently has the shortest queue.",

                        "enum": [

                          "aer",

                          "ibm_fez",

                          "ibm_miami",

                          "ibm_marrakesh",

                          "least_busy",

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

                      "range_correction": {

                        "default": false,

                        "description": "Stretch each decoded field back over its original dynamic range. Off by default -- the raw decoded values are used as-is, with no correction.",

                        "title": "Range Correction",

                        "type": "boolean"

                      },

                      "separate_rgb": {

                        "default": true,

                        "description": "Give each of the three colour coordinates its own circuit. Turn this off to put the two angles on one circuit instead: a qubit is cos(theta/2)|0> + e^(i phi)|1>, so the sphere's polar angle can ride in the rotation and hue in the phase of the same cell, turning three circuits into two at the cost of a second measurement setting and a noisier reconstruction. Ignored when fixed_palette is set.",

                        "title": "Separate Rgb",

                        "type": "boolean"

                      },

                      "shots": {

                        "default": 4096,

                        "description": "Number of measurement shots to sample, per processed field.",

                        "exclusiveMinimum": 0,

                        "title": "Shots",

                        "type": "integer"

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

                      "image": {

                        "type": "string",

                        "format": "uuid",

                        "description": "The image to encode. By default every pixel becomes a point on the colour sphere -- a radius and two angles, the same coordinates that describe a qubit's own state -- and each of those three goes through the quantum encode/measure/decode round trip, any that doesn't vary passed through unencoded, before the image is recomposed. With fixed_palette the image is instead quantized to a palette of its own colours (capped at 256) and only the per-pixel palette index makes the trip. The alpha channel, if any, passes through unchanged. Accepts: image/png, image/jpeg, image/webp, image/tiff, image/bmp."

                      }

                    },

                    "required": [

                      "image"

                    ]

                  }

                },

                "required": [

                  "params",

                  "input_files"

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

            "source": "# Upload first (see the Assets guide) and put the returned asset_id in input_files.\ncurl -s -X POST https://api.mothquantum.com/api/v1/engines/tessa-image-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"distortion\": 0,\n    \"fixed_palette\": false,\n    \"gate_pauli\": \"XZ\",\n    \"machine\": \"aer\",\n    \"range_correction\": false,\n    \"separate_rgb\": true,\n    \"shots\": 4096\n  },\n  \"input_files\": {\n    \"image\": \"$ASSET_ID\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Upload the input as an asset (slot \"image\": image/png, image/jpeg, image/webp, image/tiff, image/bmp)\npath = Path(\"input.png\"); data = path.read_bytes()\nasset = requests.post(f\"{API}/assets\", headers=H,\n    json={\"filename\": path.name, \"content_type\": \"image/png\", \"size_bytes\": len(data)}).json()\nrequests.put(asset[\"upload\"][\"url\"], data=data, headers=asset[\"upload\"][\"headers\"]).raise_for_status()\nrequests.post(f\"{API}/assets/{asset['asset_id']}/complete\", headers=H).raise_for_status()\nasset_id = asset[\"asset_id\"]\n\n# 2. Submit to tessa-image-v1\njob = requests.post(f\"{API}/engines/tessa-image-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"distortion\": 0,\n            \"fixed_palette\": False,\n            \"gate_pauli\": \"XZ\",\n            \"machine\": \"aer\",\n            \"range_correction\": False,\n            \"separate_rgb\": True,\n            \"shots\": 4096\n        },\n        \"input_files\": {\n            \"image\": asset_id\n        }\n    }).json()\n\n# 3. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 4. Fetch the result — output slots: result\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "import fs from \"node:fs/promises\";\n\nconst API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Upload the input as an asset (slot \"image\")\nconst data = await fs.readFile(\"input.png\");\nconst asset = await (await fetch(`${API}/assets`, { method: \"POST\", headers: json,\n  body: JSON.stringify({ filename: \"input.png\", content_type: \"image/png\", size_bytes: data.byteLength }) })).json();\nawait fetch(asset.upload.url, { method: \"PUT\", headers: asset.upload.headers, body: data });\nawait fetch(`${API}/assets/${asset.asset_id}/complete`, { method: \"POST\", headers: H });\nconst assetId = asset.asset_id;\n\n// Submit\nconst job = await (await fetch(`${API}/engines/tessa-image-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"distortion\": 0,\n      \"fixed_palette\": false,\n      \"gate_pauli\": \"XZ\",\n      \"machine\": \"aer\",\n      \"range_correction\": false,\n      \"separate_rgb\": true,\n      \"shots\": 4096\n    },\n    \"input_files\": {\n      \"image\": assetId\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

Quantum Blur — blur-v1, Image → Image

Quantum Teleblur — telablur-v1, Image → Image

Deep Fryer — deep-fryer-v1, Image → Image

Blur Jazz — blur-midi-v1, Audio → Audio

