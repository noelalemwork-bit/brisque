Quantum TeleblurQuantum Teleblur

POST/api/v1/engines/telablur-v1/processliveRun in dashboard ↗Try the API call ↗

Enginetelablur-v1
PublisherMoth
Usage1 credit / run
UpdatedSep 9, 2026

Quantum Teleblur — morphs one image into another through qubit rotations.

Image → Image3 file slotsfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/telablur-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "direction": "full",

    "downscale": true,

    "mask_bin_size": 4,

    "mask_min_region": 16,

    "size": 1024,

    "strength": 0.5

  },

  "input_files": {

    "image1": "9f8e7d6c-5b4a-4d21-8abc-def012345678",

    "image2": "9f8e7d6c-5b4a-4d21-8abc-def012345678"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptiondirectionstringno"full"Which qubits receive the blur rotation, controlling the spatial direction of the blur effect:  - full — all pixel qubits are rotated, producing blur in both directions (default). - vertical — only the y-encoding qubits are rotated; the blur spreads vertically. - horizontal — only the x-encoding qubits are rotated; the blur spreads horizontally. (one of full, vertical, horizontal)downscalebooleannotrueIf True, oversized regions are downscaled before teleport and upscaled back. If False, oversized regions are tiled into adjacent sub-images.mask_bin_sizenumber | nullno4Mask quantisation step as a percentage of 255 (0–100). Pixel values below this threshold are treated as background, preventing near-zero JPEG/WebP compression artifacts from being detected as separate mask regions. Default 4 (~10/255).mask_min_regioninteger | nullno16Minimum mask region size in pixels. Connected components smaller than this are discarded after quantisation, removing residual compression artifacts that survive the binning step. Default 16.sizeintegerno1024Pixel budget per teleblur pass: a region up to size × size pixels is teleported in a single pass. Must be between 8 and 1024. Default 1024. (min 8, max 1024)strengthnumberno0.5Strength of the teleportation effect, between 0.0 and 1.0 (min 0, max 1)Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionimage1image/png, image/jpeg, image/webp, image/tiff, image/bmpyesThe source image. The teleblur effect morphs this image toward image2 through quantum rotation gates. Supported formats: PNG, JPEG, WebP, TIFF, BMP.image2image/png, image/jpeg, image/webp, image/tiff, image/bmpyesThe target image. The teleblur effect morphs image1 toward this image. If the dimensions differ from image1, image2 is resized to match before processing.maskimage/png, image/jpeg, image/webp, image/tiff, image/bmpnoOptional mask controlling where the effect is applied, on a per-pixel basis. Must match the size of image1. Each output pixel is a soft blend C = m · C_teleblurred + (1 - m) · C_image1, where m is the normalised mask intensity at that pixel: black keeps image1, white takes the fully teleblurred result, and grey values blend smoothly between the two. Single-channel masks are used directly; RGB masks are converted to luminance.  Alpha-channel fallback  If no mask is provided, the alpha channel of image1 is used instead (transparent pixels keep image1, opaque pixels are teleblurred). For RGB input with no alpha channel, the whole image is teleblurred.
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

      "filename": "telablur-v1-1b9d6bcd-result.png",

      "content_type": "image/png",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 18000 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultimage/png, image/jpeg, image/webp, image/tiff, image/bmpyesThe processed image.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_image1The first image file could not be decoded.invalid_image2The second image file could not be decoded.mask_size_mismatchMask dimensions do not match image1 dimensions.no_mask_regionThe provided mask has no non-zero pixels — nothing to teleblur.invalid_paramsOne or more params fields failed Pydantic validation.processing_failedThe quantum teleport circuit failed during processing.
Generated from this engine's definition: upload, submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Upload the input as an asset (slot "image1": image/png, image/jpeg, image/webp, image/tiff, image/bmp)

#    Optional slots not shown: mask

path = Path("input.png"); data = path.read_bytes()

asset = requests.post(f"{API}/assets", headers=H,

    json={"filename": path.name, "content_type": "image/png", "size_bytes": len(data)}).json()

requests.put(asset["upload"]["url"], data=data, headers=asset["upload"]["headers"]).raise_for_status()

requests.post(f"{API}/assets/{asset['asset_id']}/complete", headers=H).raise_for_status()

asset_id = asset["asset_id"]

# 2. Submit to telablur-v1

job = requests.post(f"{API}/engines/telablur-v1/process", headers=H,

    json={

        "params": {

            "direction": "full",

            "downscale": True,

            "mask_bin_size": 4,

            "mask_min_region": 16,

            "size": 1024,

            "strength": 0.5

        },

        "input_files": {

            "image1": asset_id,

            "image2": asset_id

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

curl -s -X POST https://api.mothquantum.com/api/v1/engines/telablur-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "direction": "full",

    "downscale": true,

    "mask_bin_size": 4,

    "mask_min_region": 16,

    "size": 1024,

    "strength": 0.5

  },

  "input_files": {

    "image1": "$ASSET_ID",

    "image2": "$ASSET_ID"

  }

}'

# → 202 {"job_id": "...", "status": "queued"}

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H "Authorization: Bearer $MOTH_API_KEY"

curl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H "Authorization: Bearer $MOTH_API_KEY"

```

Example outputs and interactive runs: browse showcases in the dashboard.
Both images are placed into a shared quantum state on n+1 qubits, where n
encodes the image pixels and one extra selector qubit identifies each image.
Rotating the selector qubit interpolates between the two images at the
amplitude level.Notes​

An optional mask selects where the effect is applied. If omitted,
image1's alpha channel is used (RGBA) or the full image (RGB).

The two images must share the same dimensions; mismatched sizes are
rejected.

Disjoint mask regions are processed independently from their bounding
boxes.

The simulator caps each region at 2 ** max_qubits pixels. When a region
exceeds that, downscale=True does downscale → teleport → upscale;
downscale=False tiles the region. Output always matches input dimensions.

The output is the composition (1-mask)·image1 + mask·teleblurred, where the
teleblurred alpha is alpha1·(1-strength) + alpha2·strength.

Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Quantum Teleblur",

    "summary": "Morph one image into another through quantum rotation gates.",

    "description": "Quantum Teleblur — morphs one image into another through qubit rotations.",

    "version": "live",

    "x-engine-id": "telablur-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-publisher": "Moth",

    "x-capabilities": [

      "image-to-image"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 18000,

    "x-registered-at": "2026-06-15T16:43:34Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/telablur-v1"

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

    "/api/v1/engines/telablur-v1/process": {

      "post": {

        "operationId": "telablur-v1",

        "summary": "Quantum Teleblur",

        "description": "Quantum Teleblur — morphs one image into another through qubit rotations.",

        "x-error-codes": [

          {

            "type": "invalid_image1",

            "description": "The first image file could not be decoded."

          },

          {

            "type": "invalid_image2",

            "description": "The second image file could not be decoded."

          },

          {

            "type": "mask_size_mismatch",

            "description": "Mask dimensions do not match image1 dimensions."

          },

          {

            "type": "no_mask_region",

            "description": "The provided mask has no non-zero pixels — nothing to teleblur."

          },

          {

            "type": "invalid_params",

            "description": "One or more params fields failed Pydantic validation."

          },

          {

            "type": "processing_failed",

            "description": "The quantum teleport circuit failed during processing."

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

                      "direction": {

                        "default": "full",

                        "description": "Which qubits receive the blur rotation, controlling the spatial direction of the blur effect:\n\n- `full` — all pixel qubits are rotated, producing blur in both directions (default).\n- `vertical` — only the y-encoding qubits are rotated; the blur spreads vertically.\n- `horizontal` — only the x-encoding qubits are rotated; the blur spreads horizontally.",

                        "enum": [

                          "full",

                          "vertical",

                          "horizontal"

                        ],

                        "title": "Direction",

                        "type": "string"

                      },

                      "downscale": {

                        "default": true,

                        "description": "If True, oversized regions are downscaled before teleport and upscaled back. If False, oversized regions are tiled into adjacent sub-images.",

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

                      "size": {

                        "default": 1024,

                        "description": "Pixel budget per teleblur pass: a region up to `size × size` pixels is teleported in a single pass. Must be between 8 and 1024. Default 1024.",

                        "maximum": 1024,

                        "minimum": 8,

                        "title": "Size",

                        "type": "integer"

                      },

                      "strength": {

                        "default": 0.5,

                        "description": "Strength of the teleportation effect, between 0.0 and 1.0",

                        "maximum": 1,

                        "minimum": 0,

                        "title": "Strength",

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

                      "image1": {

                        "type": "string",

                        "format": "uuid",

                        "description": "The source image. The teleblur effect morphs this image toward image2 through quantum rotation gates. Supported formats: PNG, JPEG, WebP, TIFF, BMP. Accepts: image/png, image/jpeg, image/webp, image/tiff, image/bmp."

                      },

                      "image2": {

                        "type": "string",

                        "format": "uuid",

                        "description": "The target image. The teleblur effect morphs image1 toward this image. If the dimensions differ from image1, image2 is resized to match before processing. Accepts: image/png, image/jpeg, image/webp, image/tiff, image/bmp."

                      },

                      "mask": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Optional mask controlling where the effect is applied, on a per-pixel\nbasis. Must match the size of `image1`. Each output pixel is a soft\nblend `C = m · C_teleblurred + (1 - m) · C_image1`, where `m` is the\nnormalised mask intensity at that pixel: black keeps image1, white takes\nthe fully teleblurred result, and grey values blend smoothly between the\ntwo. Single-channel masks are used directly; RGB masks are converted to\nluminance.\n\n**Alpha-channel fallback**\n\nIf no mask is provided, the alpha channel of `image1` is used instead\n(transparent pixels keep image1, opaque pixels are teleblurred). For\nRGB input with no alpha channel, the whole image is teleblurred.\n Accepts: image/png, image/jpeg, image/webp, image/tiff, image/bmp."

                      }

                    },

                    "required": [

                      "image1",

                      "image2"

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

            "source": "# Upload first (see the Assets guide) and put the returned asset_id in input_files.\ncurl -s -X POST https://api.mothquantum.com/api/v1/engines/telablur-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"direction\": \"full\",\n    \"downscale\": true,\n    \"mask_bin_size\": 4,\n    \"mask_min_region\": 16,\n    \"size\": 1024,\n    \"strength\": 0.5\n  },\n  \"input_files\": {\n    \"image1\": \"$ASSET_ID\",\n    \"image2\": \"$ASSET_ID\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Upload the input as an asset (slot \"image1\": image/png, image/jpeg, image/webp, image/tiff, image/bmp)\n#    Optional slots not shown: mask\npath = Path(\"input.png\"); data = path.read_bytes()\nasset = requests.post(f\"{API}/assets\", headers=H,\n    json={\"filename\": path.name, \"content_type\": \"image/png\", \"size_bytes\": len(data)}).json()\nrequests.put(asset[\"upload\"][\"url\"], data=data, headers=asset[\"upload\"][\"headers\"]).raise_for_status()\nrequests.post(f\"{API}/assets/{asset['asset_id']}/complete\", headers=H).raise_for_status()\nasset_id = asset[\"asset_id\"]\n\n# 2. Submit to telablur-v1\njob = requests.post(f\"{API}/engines/telablur-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"direction\": \"full\",\n            \"downscale\": True,\n            \"mask_bin_size\": 4,\n            \"mask_min_region\": 16,\n            \"size\": 1024,\n            \"strength\": 0.5\n        },\n        \"input_files\": {\n            \"image1\": asset_id,\n            \"image2\": asset_id\n        }\n    }).json()\n\n# 3. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 4. Fetch the result — output slots: result\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "import fs from \"node:fs/promises\";\n\nconst API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Upload the input as an asset (slot \"image1\")\nconst data = await fs.readFile(\"input.png\");\nconst asset = await (await fetch(`${API}/assets`, { method: \"POST\", headers: json,\n  body: JSON.stringify({ filename: \"input.png\", content_type: \"image/png\", size_bytes: data.byteLength }) })).json();\nawait fetch(asset.upload.url, { method: \"PUT\", headers: asset.upload.headers, body: data });\nawait fetch(`${API}/assets/${asset.asset_id}/complete`, { method: \"POST\", headers: H });\nconst assetId = asset.asset_id;\n\n// Submit\nconst job = await (await fetch(`${API}/engines/telablur-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"direction\": \"full\",\n      \"downscale\": true,\n      \"mask_bin_size\": 4,\n      \"mask_min_region\": 16,\n      \"size\": 1024,\n      \"strength\": 0.5\n    },\n    \"input_files\": {\n      \"image1\": assetId,\n      \"image2\": assetId\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

Tessa Image — tessa-image-v1, Image → Image

Deep Fryer — deep-fryer-v1, Image → Image

Blur Jazz — blur-midi-v1, Audio → Audio

