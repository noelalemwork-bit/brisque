Quantum BlurQuantum Blur

POST/api/v1/engines/blur-v1/processliveRun in dashboard ↗Try the API call ↗

Engineblur-v1
Versionv1.1.9
PublisherMoth
Usage1 credit / run
UpdatedSep 10, 2026

Blur an image with a quantum rotation and get back an image of the same size and format, optionally only inside a masked region.

Image → Image2 file slotsfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/blur-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "downscale": true,

    "mask_bin_size": 4,

    "mask_min_region": 16,

    "reach": 0,

    "size": 1024,

    "strength": 0.5,

    "style": "rx"

  },

  "input_files": {

    "image": "9f8e7d6c-5b4a-4d21-8abc-def012345678"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptiondownscalebooleannotrueStrategy used when a mask region is larger than the maximum number of qubits allows:  - true — the region is downscaled to fit, blurred, and upscaled back. - false — the region is split into adjacent tiles that are blurred independently.mask_bin_sizenumber | nullno4Mask quantisation step as a percentage of 255 (0–100). Pixel values below this threshold are treated as background, preventing near-zero JPEG/WebP compression artifacts from being detected as separate mask regions. Default 4 (~10/255).mask_min_regioninteger | nullno16Minimum mask region size in pixels. Connected components smaller than this are discarded after quantisation, removing residual compression artifacts that survive the binning step. Default 16.reachnumberno0Controls how far from its original position a pixel can be affected by the blur:  - 0 — fully local: only nearby pixels are affected (default). - 1 — fully non-local: pixels anywhere on the canvas can be affected equally. (min 0, max 1)sizeintegerno1024Pixel budget per blur pass: a region up to size × size pixels is blurred in a single pass. Internally converted to a qubit budget via ceil(log2(size)) * 2. Must be between 8 and 1024. Default 1024. (min 8, max 1024)strengthnumberno0.5Strength of the effect, which controls the rotation applied to each qubit:  - 0 — the image is left unchanged. - 1 — maximum blur. (min 0, max 1)stylestringno"rx"Quantum gate used to apply the effect:  - rx — rotation around the x-axis of the Bloch sphere. - ry — rotation around the y-axis of the Bloch sphere. (one of rx, ry)Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionimageimage/png, image/jpeg, image/webp, image/tiff, image/bmpyesThe image of your choice. The blur effect is applied RGB pixel values only, not the alpha channel. It means that if you submitted a PNG with transparent background, the background from the output will also be transparent.maskimage/png, image/jpeg, image/webp, image/tiff, image/bmpnoOptional mask controlling where the effect is applied, on a per-pixel basis. Must match the size of image. Each output pixel is a soft blend C = m · C_blurred + (1 - m) · C_original, where m is the normalised mask intensity at that pixel: black keeps the original, white takes the fully blurred version, and grey values blend smoothly between the two. Single-channel masks are used directly; RGB masks are converted to luminance.  Alpha-channel fallback  If no mask is provided, the alpha channel of image is used instead (transparent pixels keep the original, opaque pixels are blurred). For RGB input with no alpha channel, the whole image is blurred.
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

      "filename": "blur-v1-1b9d6bcd-result.png",

      "content_type": "image/png",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 300 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultimage/png, image/jpeg, image/webp, image/tiff, image/bmpyesThe processed image.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaningmask_size_mismatchMask dimensions do not match the image dimensions.no_mask_regionThe provided mask has no non-zero pixels — nothing to blur.invalid_paramsOne or more params fields failed Pydantic validation.invalid_imageThe image or mask file could not be decoded.blur_failedThe quantum blur circuit failed on a mask region.region_extraction_failedA mask region could not be extracted from the image (e.g. an invalid bounding box).compose_failedA blurred region could not be blended back into the output image.encoding_failedThe output image could not be encoded in the input's format.
Generated from this engine's definition: upload, submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Upload the input as an asset (slot "image": image/png, image/jpeg, image/webp, image/tiff, image/bmp)

#    Optional slots not shown: mask

path = Path("input.png"); data = path.read_bytes()

asset = requests.post(f"{API}/assets", headers=H,

    json={"filename": path.name, "content_type": "image/png", "size_bytes": len(data)}).json()

requests.put(asset["upload"]["url"], data=data, headers=asset["upload"]["headers"]).raise_for_status()

requests.post(f"{API}/assets/{asset['asset_id']}/complete", headers=H).raise_for_status()

asset_id = asset["asset_id"]

# 2. Submit to blur-v1

job = requests.post(f"{API}/engines/blur-v1/process", headers=H,

    json={

        "params": {

            "downscale": True,

            "mask_bin_size": 4,

            "mask_min_region": 16,

            "reach": 0,

            "size": 1024,

            "strength": 0.5,

            "style": "rx"

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

curl -s -X POST https://api.mothquantum.com/api/v1/engines/blur-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "downscale": true,

    "mask_bin_size": 4,

    "mask_min_region": 16,

    "reach": 0,

    "size": 1024,

    "strength": 0.5,

    "style": "rx"

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
Each pixel's brightness is encoded into a quantum state, one rotation gate is
applied per qubit, and the state is read back into pixels. Because a single gate
moves weight across many pixels at once, the blur spreads as interference echoes
rather than a soft focus: shapes reappear faintly elsewhere on the canvas.
Colour images are processed one channel at a time; the alpha channel is untouched.How it works​

Reads image and, if given, mask. Without a mask the alpha channel selects
the region; RGB input with no alpha is blurred everywhere.

Splits the mask into connected regions and, for each, encodes the pixels into
a statevector, applies the style rotation at the given strength, and reads
the result back. Regions larger than size are downscaled or tiled per
downscale.

Blends each blurred region with the original by mask intensity and writes the
image in the input's format and dimensions.

Output​
One file in slot result: same format, dimensions and alpha channel as image.Limits​

Runs on a classical statevector simulator, not a QPU. Memory and time grow with
region size; a 1024 x 1024 region uses 20 qubits.

strength above 1 (with reach 0) starts to reverse the effect.

ry on smooth gradients can collapse to a mostly dark image; prefer rx there.

Further reading​

QuantumBlur library: the
encoding and rotation this engine wraps.

ILA, Recurse: the album produced with this
colour-channel technique.

Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Quantum Blur",

    "summary": "Apply a quantum blur algorithm to the image.",

    "description": "Blur an image with a quantum rotation and get back an image of the same size and format, optionally only inside a masked region.",

    "version": "1.1.9",

    "x-engine-id": "blur-v1",

    "x-engine-version": "1.1.9",

    "x-status": "live",

    "x-visibility": "public",

    "x-publisher": "Moth",

    "x-capabilities": [

      "image-to-image"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 300,

    "x-registered-at": "2026-05-26T13:52:59Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/blur-v1"

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

    "/api/v1/engines/blur-v1/process": {

      "post": {

        "operationId": "blur-v1",

        "summary": "Quantum Blur",

        "description": "Blur an image with a quantum rotation and get back an image of the same size and format, optionally only inside a masked region.",

        "x-error-codes": [

          {

            "type": "mask_size_mismatch",

            "description": "Mask dimensions do not match the image dimensions."

          },

          {

            "type": "no_mask_region",

            "description": "The provided mask has no non-zero pixels — nothing to blur."

          },

          {

            "type": "invalid_params",

            "description": "One or more params fields failed Pydantic validation."

          },

          {

            "type": "invalid_image",

            "description": "The image or mask file could not be decoded."

          },

          {

            "type": "blur_failed",

            "description": "The quantum blur circuit failed on a mask region."

          },

          {

            "type": "region_extraction_failed",

            "description": "A mask region could not be extracted from the image (e.g. an invalid bounding box)."

          },

          {

            "type": "compose_failed",

            "description": "A blurred region could not be blended back into the output image."

          },

          {

            "type": "encoding_failed",

            "description": "The output image could not be encoded in the input's format."

          }

        ],

        "x-output-files": [

          {

            "name": "result",

            "content_types": [

              "image/png",

              "image/jpeg",

              "image/webp",

              "image/tiff",

              "image/bmp"

            ],

            "required": true,

            "description": "The processed image."

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

                      "downscale": {

                        "default": true,

                        "description": "Strategy used when a mask region is larger than the maximum number of qubits allows:\n\n- `true` — the region is downscaled to fit, blurred, and upscaled back.\n- `false` — the region is split into adjacent tiles that are blurred independently.",

                        "title": "Downscale",

                        "type": "boolean"

                      },

                      "mask_bin_size": {

                        "anyOf": [

                          {

                            "maximum": 100,

                            "minimum": 0,

                            "type": "number"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": 4,

                        "description": "Mask quantisation step as a percentage of 255 (0–100). Pixel values below this threshold are treated as background, preventing near-zero JPEG/WebP compression artifacts from being detected as separate mask regions. Default 4 (~10/255).",

                        "title": "Mask Bin Size"

                      },

                      "mask_min_region": {

                        "anyOf": [

                          {

                            "minimum": 1,

                            "type": "integer"

                          },

                          {

                            "type": "null"

                          }

                        ],

                        "default": 16,

                        "description": "Minimum mask region size in pixels. Connected components smaller than this are discarded after quantisation, removing residual compression artifacts that survive the binning step. Default 16.",

                        "title": "Mask Min Region"

                      },

                      "reach": {

                        "default": 0,

                        "description": "Controls how far from its original position a pixel can be affected by the blur:\n\n- `0` — fully local: only nearby pixels are affected (default).\n- `1` — fully non-local: pixels anywhere on the canvas can be affected equally.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Reach",

                        "type": "number"

                      },

                      "size": {

                        "default": 1024,

                        "description": "Pixel budget per blur pass: a region up to `size × size` pixels is blurred in a single pass. Internally converted to a qubit budget via `ceil(log2(size)) * 2`. Must be between 8 and 1024. Default 1024.",

                        "maximum": 1024,

                        "minimum": 8,

                        "title": "Size",

                        "type": "integer"

                      },

                      "strength": {

                        "default": 0.5,

                        "description": "Strength of the effect, which controls the rotation applied to each qubit:\n\n- `0` — the image is left unchanged.\n- `1` — maximum blur.",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Strength",

                        "type": "number"

                      },

                      "style": {

                        "default": "rx",

                        "description": "Quantum gate used to apply the effect:\n\n- `rx` — rotation around the x-axis of the Bloch sphere.\n- `ry` — rotation around the y-axis of the Bloch sphere.",

                        "enum": [

                          "rx",

                          "ry"

                        ],

                        "title": "Style",

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

                      "image": {

                        "type": "string",

                        "format": "uuid",

                        "description": "The image of your choice. The blur effect is applied RGB pixel values only, not the alpha channel. It means that if you submitted a PNG with transparent background, the background from the output will also be transparent. Accepts: image/png, image/jpeg, image/webp, image/tiff, image/bmp."

                      },

                      "mask": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Optional mask controlling where the effect is applied, on a per-pixel\nbasis. Must match the size of `image`. Each output pixel is a soft\nblend `C = m · C_blurred + (1 - m) · C_original`, where `m` is the\nnormalised mask intensity at that pixel: black keeps the original,\nwhite takes the fully blurred version, and grey values blend smoothly\nbetween the two. Single-channel masks are used directly; RGB masks are\nconverted to luminance.\n\n**Alpha-channel fallback**\n\nIf no mask is provided, the alpha channel of `image` is used instead\n(transparent pixels keep the original, opaque pixels are blurred). For\nRGB input with no alpha channel, the whole image is blurred.\n Accepts: image/png, image/jpeg, image/webp, image/tiff, image/bmp."

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

            "source": "# Upload first (see the Assets guide) and put the returned asset_id in input_files.\ncurl -s -X POST https://api.mothquantum.com/api/v1/engines/blur-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"downscale\": true,\n    \"mask_bin_size\": 4,\n    \"mask_min_region\": 16,\n    \"reach\": 0,\n    \"size\": 1024,\n    \"strength\": 0.5,\n    \"style\": \"rx\"\n  },\n  \"input_files\": {\n    \"image\": \"$ASSET_ID\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Upload the input as an asset (slot \"image\": image/png, image/jpeg, image/webp, image/tiff, image/bmp)\n#    Optional slots not shown: mask\npath = Path(\"input.png\"); data = path.read_bytes()\nasset = requests.post(f\"{API}/assets\", headers=H,\n    json={\"filename\": path.name, \"content_type\": \"image/png\", \"size_bytes\": len(data)}).json()\nrequests.put(asset[\"upload\"][\"url\"], data=data, headers=asset[\"upload\"][\"headers\"]).raise_for_status()\nrequests.post(f\"{API}/assets/{asset['asset_id']}/complete\", headers=H).raise_for_status()\nasset_id = asset[\"asset_id\"]\n\n# 2. Submit to blur-v1\njob = requests.post(f\"{API}/engines/blur-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"downscale\": True,\n            \"mask_bin_size\": 4,\n            \"mask_min_region\": 16,\n            \"reach\": 0,\n            \"size\": 1024,\n            \"strength\": 0.5,\n            \"style\": \"rx\"\n        },\n        \"input_files\": {\n            \"image\": asset_id\n        }\n    }).json()\n\n# 3. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 4. Fetch the result — output slots: result\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "import fs from \"node:fs/promises\";\n\nconst API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Upload the input as an asset (slot \"image\")\nconst data = await fs.readFile(\"input.png\");\nconst asset = await (await fetch(`${API}/assets`, { method: \"POST\", headers: json,\n  body: JSON.stringify({ filename: \"input.png\", content_type: \"image/png\", size_bytes: data.byteLength }) })).json();\nawait fetch(asset.upload.url, { method: \"PUT\", headers: asset.upload.headers, body: data });\nawait fetch(`${API}/assets/${asset.asset_id}/complete`, { method: \"POST\", headers: H });\nconst assetId = asset.asset_id;\n\n// Submit\nconst job = await (await fetch(`${API}/engines/blur-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"downscale\": true,\n      \"mask_bin_size\": 4,\n      \"mask_min_region\": 16,\n      \"reach\": 0,\n      \"size\": 1024,\n      \"strength\": 0.5,\n      \"style\": \"rx\"\n    },\n    \"input_files\": {\n      \"image\": assetId\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

Quantum Teleblur — telablur-v1, Image → Image

Tessa Image — tessa-image-v1, Image → Image

Deep Fryer — deep-fryer-v1, Image → Image

Blur Jazz — blur-midi-v1, Audio → Audio

