Deep FryerDeep Fryer

POST/api/v1/engines/deep-fryer-v1/processliveRun in dashboard ↗Try the API call ↗

Enginedeep-fryer-v1
PublisherMoth
Usage1 credit / run
UpdatedSep 9, 2026

Deep Fryer: a quantum kernel that gives images that blown-out, deep-fried meme look.

Image → Image2 file slotsfile result

RequestResponseExamplesDetailsSchemaPOST /api/v1/engines/deep-fryer-v1/process with a JSON body — upload files as assets first and pass their ids under the slot names:
```
{

  "params": {

    "gates": [

      [

        "rx",

        0.5

      ]

    ],

    "mask_bin_size": 4,

    "mask_min_region": 16,

    "tile_size": 4

  },

  "input_files": {

    "image": "9f8e7d6c-5b4a-4d21-8abc-def012345678"

  }

}

```

Values shown are the defaults. Validation rules: Submitting jobs.params​
FieldTypeRequiredDefaultDescriptiongatesarrayno[["rx",0.5]]Sequence of (gate_name, intensity) pairs applied to each tile's qubit lattice, in order.mask_bin_sizenumberno4Mask quantisation step as a percentage of 255 (0-100). Pixel values below this threshold are treated as background, preventing near-zero JPEG/WebP compression artifacts from being detected as separate mask regions. Default 4 (~10/255). (min 0, max 100)mask_min_regionintegerno16Minimum mask region size in pixels. Connected components smaller than this are discarded after quantisation, removing residual compression artifacts that survive the binning step. Default 16. (min 1)tile_sizeintegerno4Side length of the square qubit lattice used as the per-tile processing kernel. (min 2, max 4)Input files​
Upload each file as an asset first (Assets), then pass its id under the slot name.SlotAcceptsRequiredDescriptionimageimage/png, image/jpeg, image/webp, image/bmp, image/tiffyesmaskimage/png, image/jpeg, image/webp, image/bmp, image/tiffnoOptional mask controlling where the effect is applied, on a per-pixel basis. Resized (Lanczos) to match image if it isn't already the same size. Brighter mask pixels take more of the quantum-processed color, darker pixels keep more of the original. The mask is split into disjoint connected regions and each is processed independently, scoped to its own bounding box. If omitted, the alpha channel of image is used instead (transparent pixels stay original, opaque pixels are processed); for RGB input with no alpha channel, the whole image is processed.
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

      "filename": "deep-fryer-v1-1b9d6bcd-result.png",

      "content_type": "image/png",

      "size_bytes": 524288,

      "url": "https://storage.example.com/jobs/1b9d6bcd/result?X-Amz-Signature=…",

      "expires_at": "2026-09-08T14:43:18Z"

    }

  ],

  "result": null

}

```

Each url is presigned: fetch it with no auth header before expires_at. Every output is also an asset you own (output_asset_id), downloadable again later.A run still going after 30000 s is cancelled and the job ends failed.Output slots:SlotContent typesRequiredDescriptionresultimage/png, image/jpeg, image/webp, image/bmp, image/tiffyesThe processed image.Engine error codes​
Returned as 422 (validation) or as error.type on a failed job. Generic errors: Errors & rate limits.CodeMeaninginvalid_imageThe image or mask file could not be decoded.no_mask_regionThe provided mask has no non-zero regions after quantisation — nothing to process.invalid_paramsOne or more params fields failed Pydantic validation.tile_too_largetile_size ** 2 exceeds the MAX_QUBITS simulation budget.unsupported_gateA gate name in gates is not in the supported gate registry.kernel_failedThe quantum color kernel failed on a tile.encoding_failedThe output image could not be encoded in the input's format.
Generated from this engine's definition: upload, submit, poll, fetch.Pythoncurl
```
import os, time, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

# 1. Upload the input as an asset (slot "image": image/png, image/jpeg, image/webp, image/bmp, image/tiff)

#    Optional slots not shown: mask

path = Path("input.png"); data = path.read_bytes()

asset = requests.post(f"{API}/assets", headers=H,

    json={"filename": path.name, "content_type": "image/png", "size_bytes": len(data)}).json()

requests.put(asset["upload"]["url"], data=data, headers=asset["upload"]["headers"]).raise_for_status()

requests.post(f"{API}/assets/{asset['asset_id']}/complete", headers=H).raise_for_status()

asset_id = asset["asset_id"]

# 2. Submit to deep-fryer-v1

job = requests.post(f"{API}/engines/deep-fryer-v1/process", headers=H,

    json={

        "params": {

            "gates": [

                [

                    "rx",

                    0.5

                ]

            ],

            "mask_bin_size": 4,

            "mask_min_region": 16,

            "tile_size": 4

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

curl -s -X POST https://api.mothquantum.com/api/v1/engines/deep-fryer-v1/process \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d '{

  "params": {

    "gates": [

      [

        "rx",

        0.5

      ]

    ],

    "mask_bin_size": 4,

    "mask_min_region": 16,

    "tile_size": 4

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
A classic deep-fry filter gets there by cranking saturation, contrast, and
sharpening. This engine reaches for the same chaotic, crunchy color result
through genuine quantum interference instead, one tile at a time.Each tile becomes a square lattice of qubits, one per pixel. A pixel's hue and
lightness place its qubit on the Bloch sphere (hue as the azimuthal phase,
lightness as the polar angle, like a compass bearing and a latitude fixing a
point on a globe). Saturation stays out of the circuit and is reattached
afterwards, so the amount of color in a pixel never changes, only which color
and how bright. The requested gates are then applied across the tile: single-
qubit gates touch every pixel, two-qubit gates couple neighbors on the
lattice, so color genuinely mixes through interference and entanglement
rather than an average. Reading each qubit's Bloch vector back out gives the
tile its new, deep-fried hue and lightness.How to use​
Invoke the engine through the platform with a JSON params payload and one or
two image files attached:
image — required. The source image. Supported formats: PNG, JPEG, WebP,
BMP, TIFF.

mask — optional. A single-channel (or RGB) image the same size as image,
where brighter pixels receive more of the effect and darker pixels keep the
original color. If omitted, the alpha channel of image is used as the
mask; for RGB input with no alpha, the whole image is processed. The mask
is split into disjoint connected regions, each processed as its own tiled
sub-image scoped to that region's bounding box, so a few small scattered
selections on an otherwise-empty mask don't tile the entire canvas.

Optionally, the params object may also include:
gates — a list of [gate_name, intensity] pairs, applied to the tile's
qubit lattice in order. intensity is normalized to [0, 1]: for
parametric gates (rx, ry, rz, p, rxx, ryy, rzz, rzx, crx,
cry, crz, cp) it scales the rotation angle up to pi; for
non-parametric gates (h, x, y, z, s, sdg, t, tdg, sx, cx,
cy, cz, ch, swap, iswap) it raises the gate to that fractional
power, so 0 is the identity and 1 is the full gate. Default
[["rx", 0.5]].

tile_size — side length of the square qubit lattice used as the
processing kernel. A tile near a mask region's edge is simulated at its
true, smaller size rather than padded. Must keep tile_size ** 2 within
MAX_QUBITS, since the whole lattice is simulated as one statevector.
Default 4.

mask_bin_size — mask quantisation step as a percentage of 255. Pixel
values below this threshold collapse into the background, suppressing
JPEG/WebP compression artifacts from being treated as separate mask
regions. Default 4.0.

mask_min_region — minimum connected-component size in pixels after
quantisation. Smaller components are discarded. Default 16.

Output​
Returns an image the same size and format as the input, deep-fried by having
its hue and lightness reshaped by the circuit while saturation is preserved
exactly. The original alpha channel, if any, is preserved unchanged.
Fetch directly, no auth: openapi.json ↗ · page.md ⤓ · llms.txt ↗
```
{

  "openapi": "3.1.0",

  "info": {

    "title": "Moth Quantum — Deep Fryer",

    "summary": "Gives images a blown-out, deep-fried meme look by scrambling hue and lightness through a quantum kernel circuit, tile by tile.",

    "description": "Deep Fryer: a quantum kernel that gives images that blown-out, deep-fried meme look.",

    "version": "live",

    "x-engine-id": "deep-fryer-v1",

    "x-status": "live",

    "x-visibility": "public",

    "x-publisher": "Moth",

    "x-capabilities": [

      "image-to-image"

    ],

    "x-credits-per-run": 1,

    "x-timeout-seconds": 30000,

    "x-registered-at": "2026-07-10T10:46:01Z",

    "x-docs": "https://docs.mothquantum.com/docs/engines/deep-fryer-v1"

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

    "/api/v1/engines/deep-fryer-v1/process": {

      "post": {

        "operationId": "deep-fryer-v1",

        "summary": "Deep Fryer",

        "description": "Deep Fryer: a quantum kernel that gives images that blown-out, deep-fried meme look.",

        "x-error-codes": [

          {

            "type": "invalid_image",

            "description": "The image or mask file could not be decoded."

          },

          {

            "type": "no_mask_region",

            "description": "The provided mask has no non-zero regions after quantisation — nothing to process."

          },

          {

            "type": "invalid_params",

            "description": "One or more params fields failed Pydantic validation."

          },

          {

            "type": "tile_too_large",

            "description": "tile_size ** 2 exceeds the MAX_QUBITS simulation budget."

          },

          {

            "type": "unsupported_gate",

            "description": "A gate name in `gates` is not in the supported gate registry."

          },

          {

            "type": "kernel_failed",

            "description": "The quantum color kernel failed on a tile."

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

              "image/bmp",

              "image/tiff"

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

                      "gates": {

                        "default": [

                          [

                            "rx",

                            0.5

                          ]

                        ],

                        "description": "Sequence of (gate_name, intensity) pairs applied to each tile's qubit lattice, in order.",

                        "items": {

                          "maxItems": 2,

                          "minItems": 2,

                          "prefixItems": [

                            {

                              "type": "string"

                            },

                            {

                              "type": "number"

                            }

                          ],

                          "type": "array"

                        },

                        "title": "Gates",

                        "type": "array"

                      },

                      "mask_bin_size": {

                        "default": 4,

                        "description": "Mask quantisation step as a percentage of 255 (0-100). Pixel values below this threshold are treated as background, preventing near-zero JPEG/WebP compression artifacts from being detected as separate mask regions. Default 4 (~10/255).",

                        "maximum": 100,

                        "minimum": 0,

                        "title": "Mask Bin Size",

                        "type": "number"

                      },

                      "mask_min_region": {

                        "default": 16,

                        "description": "Minimum mask region size in pixels. Connected components smaller than this are discarded after quantisation, removing residual compression artifacts that survive the binning step. Default 16.",

                        "minimum": 1,

                        "title": "Mask Min Region",

                        "type": "integer"

                      },

                      "tile_size": {

                        "default": 4,

                        "description": "Side length of the square qubit lattice used as the per-tile processing kernel.",

                        "maximum": 4,

                        "minimum": 2,

                        "title": "Tile Size",

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

                        "description": "Accepts: image/png, image/jpeg, image/webp, image/bmp, image/tiff."

                      },

                      "mask": {

                        "type": "string",

                        "format": "uuid",

                        "description": "Optional mask controlling where the effect is applied, on a per-pixel basis. Resized (Lanczos) to match `image` if it isn't already the same size. Brighter mask pixels take more of the quantum-processed color, darker pixels keep more of the original. The mask is split into disjoint connected regions and each is processed independently, scoped to its own bounding box. If omitted, the alpha channel of `image` is used instead (transparent pixels stay original, opaque pixels are processed); for RGB input with no alpha channel, the whole image is processed. Accepts: image/png, image/jpeg, image/webp, image/bmp, image/tiff."

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

            "source": "# Upload first (see the Assets guide) and put the returned asset_id in input_files.\ncurl -s -X POST https://api.mothquantum.com/api/v1/engines/deep-fryer-v1/process \\\n  -H \"Authorization: Bearer $MOTH_API_KEY\" -H \"Content-Type: application/json\" \\\n  -d '{\n  \"params\": {\n    \"gates\": [\n      [\n        \"rx\",\n        0.5\n      ]\n    ],\n    \"mask_bin_size\": 4,\n    \"mask_min_region\": 16,\n    \"tile_size\": 4\n  },\n  \"input_files\": {\n    \"image\": \"$ASSET_ID\"\n  }\n}'\n# → 202 {\"job_id\": \"...\", \"status\": \"queued\"}\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/status -H \"Authorization: Bearer $MOTH_API_KEY\"\ncurl -s https://api.mothquantum.com/api/v1/jobs/$JOB_ID/result -H \"Authorization: Bearer $MOTH_API_KEY\""

          },

          {

            "lang": "python",

            "label": "Python",

            "source": "import os, time, requests\nfrom pathlib import Path\n\nAPI = \"https://api.mothquantum.com/api/v1\"\nH = {\"Authorization\": f\"Bearer {os.environ['MOTH_API_KEY']}\"}\n\n# 1. Upload the input as an asset (slot \"image\": image/png, image/jpeg, image/webp, image/bmp, image/tiff)\n#    Optional slots not shown: mask\npath = Path(\"input.png\"); data = path.read_bytes()\nasset = requests.post(f\"{API}/assets\", headers=H,\n    json={\"filename\": path.name, \"content_type\": \"image/png\", \"size_bytes\": len(data)}).json()\nrequests.put(asset[\"upload\"][\"url\"], data=data, headers=asset[\"upload\"][\"headers\"]).raise_for_status()\nrequests.post(f\"{API}/assets/{asset['asset_id']}/complete\", headers=H).raise_for_status()\nasset_id = asset[\"asset_id\"]\n\n# 2. Submit to deep-fryer-v1\njob = requests.post(f\"{API}/engines/deep-fryer-v1/process\", headers=H,\n    json={\n        \"params\": {\n            \"gates\": [\n                [\n                    \"rx\",\n                    0.5\n                ]\n            ],\n            \"mask_bin_size\": 4,\n            \"mask_min_region\": 16,\n            \"tile_size\": 4\n        },\n        \"input_files\": {\n            \"image\": asset_id\n        }\n    }).json()\n\n# 3. Poll until terminal\nwhile True:\n    st = requests.get(f\"{API}/jobs/{job['job_id']}/status\", headers=H).json()\n    if st[\"status\"] in (\"completed\", \"failed\", \"cancelled\"):\n        break\n    time.sleep(2)\nif st[\"status\"] != \"completed\":\n    raise RuntimeError(f\"job {st['status']}: {st['error']}\")\n\n# 4. Fetch the result — output slots: result\nres = requests.get(f\"{API}/jobs/{job['job_id']}/result\", headers=H).json()\nfor out in res[\"outputs\"]:\n    Path(out[\"slot\"]).write_bytes(requests.get(out[\"url\"]).content)"

          },

          {

            "lang": "javascript",

            "label": "JavaScript",

            "source": "import fs from \"node:fs/promises\";\n\nconst API = \"https://api.mothquantum.com/api/v1\";\nconst H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };\nconst json = { ...H, \"Content-Type\": \"application/json\" };\n\n// Upload the input as an asset (slot \"image\")\nconst data = await fs.readFile(\"input.png\");\nconst asset = await (await fetch(`${API}/assets`, { method: \"POST\", headers: json,\n  body: JSON.stringify({ filename: \"input.png\", content_type: \"image/png\", size_bytes: data.byteLength }) })).json();\nawait fetch(asset.upload.url, { method: \"PUT\", headers: asset.upload.headers, body: data });\nawait fetch(`${API}/assets/${asset.asset_id}/complete`, { method: \"POST\", headers: H });\nconst assetId = asset.asset_id;\n\n// Submit\nconst job = await (await fetch(`${API}/engines/deep-fryer-v1/process`, { method: \"POST\", headers: json,\n  body: JSON.stringify({\n    \"params\": {\n      \"gates\": [\n        [\n          \"rx\",\n          0.5\n        ]\n      ],\n      \"mask_bin_size\": 4,\n      \"mask_min_region\": 16,\n      \"tile_size\": 4\n    },\n    \"input_files\": {\n      \"image\": assetId\n    }\n  }) })).json();\n\n// Poll until terminal\nlet st;\ndo {\n  await new Promise(r => setTimeout(r, 2000));\n  st = await (await fetch(`${API}/jobs/${job.job_id}/status`, { headers: H })).json();\n} while (![\"completed\", \"failed\", \"cancelled\"].includes(st.status));\nif (st.status !== \"completed\") throw new Error(JSON.stringify(st.error));\n\n// Fetch the result — output slots: result\nconst res = await (await fetch(`${API}/jobs/${job.job_id}/result`, { headers: H })).json();\nfor (const out of res.outputs) {\n  await fs.writeFile(out.slot, Buffer.from(await (await fetch(out.url)).arrayBuffer()));\n}"

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

Tessa Image — tessa-image-v1, Image → Image

Blur Jazz — blur-midi-v1, Audio → Audio

