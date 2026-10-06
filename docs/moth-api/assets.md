AssetsOn this page
Assets

An asset is a file the platform stores for you: either an input you uploaded or an output a job produced. File bytes never pass through the API. Uploads go straight to object storage through a presigned URL, and downloads come back the same way.

Uploading, in three calls​

curlPythonJavaScript
```
# 1. Register the upload

ASSET=$(curl -s -X POST https://api.mothquantum.com/api/v1/assets \

  -H "Authorization: Bearer $MOTH_API_KEY" -H "Content-Type: application/json" \

  -d "{\"filename\": \"image.png\", \"content_type\": \"image/png\", \"size_bytes\": $(stat -f%z image.png)}")

ASSET_ID=$(echo "$ASSET" | jq -r .asset_id)

# 2. PUT the bytes with exactly the returned headers (Content-Type shown; copy any others from upload.headers)

curl -s -X PUT "$(echo "$ASSET" | jq -r .upload.url)" -H "Content-Type: image/png" --data-binary @image.png

# 3. Complete

curl -s -X POST https://api.mothquantum.com/api/v1/assets/$ASSET_ID/complete -H "Authorization: Bearer $MOTH_API_KEY"

```

```
import os, requests

from pathlib import Path

API = "https://api.mothquantum.com/api/v1"

H = {"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"}

path = Path("image.png"); data = path.read_bytes()

# 1. Register the upload. content_type and size_bytes are signed into the URL.

asset = requests.post(f"{API}/assets", headers=H, json={

    "filename": path.name, "content_type": "image/png", "size_bytes": len(data)}).json()

# 2. PUT the bytes to the presigned URL with exactly the headers returned.

requests.put(asset["upload"]["url"], data=data, headers=asset["upload"]["headers"]).raise_for_status()

# 3. Complete. The platform verifies size and type; the asset becomes "uploaded".

requests.post(f"{API}/assets/{asset['asset_id']}/complete", headers=H).raise_for_status()

asset["asset_id"]   # pass this in a job's input_files

```

```
import fs from "node:fs/promises";

const API = "https://api.mothquantum.com/api/v1";

const H = { Authorization: `Bearer ${process.env.MOTH_API_KEY}` };

const data = await fs.readFile("image.png");

// 1. Register the upload. content_type and size_bytes are signed into the URL.

const asset = await (await fetch(`${API}/assets`, {

  method: "POST", headers: { ...H, "Content-Type": "application/json" },

  body: JSON.stringify({ filename: "image.png", content_type: "image/png", size_bytes: data.byteLength }),

})).json();

// 2. PUT the bytes to the presigned URL with exactly the headers returned.

await fetch(asset.upload.url, { method: "PUT", headers: asset.upload.headers, body: data });

// 3. Complete. The platform verifies size and type; the asset becomes "uploaded".

await fetch(`${API}/assets/${asset.asset_id}/complete`, { method: "POST", headers: H });

asset.asset_id;   // pass this in a job's input_files

```

Rules that trip people up:

The PUT must send the exact Content-Type and Content-Length you declared. Storage rejects a mismatch.

The upload URL expires; upload.expires_at tells you when. Register again if it lapses.

Until you call complete, the asset is pending, cannot be used in a job, and still counts toward quota.

Images are checked at completion. Accepted image types are image/png and image/jpeg for uploads that get scanned; a rejected image fails complete with a 422 and a reason.

Maximum upload size is 100 MiB, lower for scanned images.

Using an asset in a job​

Put the id under the engine's input slot name:

```
{"params": {"strength": 0.5}, "input_files": {"image": "<asset_id>"}}

```

The engine's catalog page lists slot names and accepted types.

Downloading​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/assets/$ASSET_ID/download -H "Authorization: Bearer $MOTH_API_KEY"

```

```
dl = requests.get(f"{API}/assets/{asset_id}/download", headers=H).json()

Path("out.png").write_bytes(requests.get(dl["download_url"]).content)

```

```
const dl = await (await fetch(`${API}/assets/${assetId}/download`, { headers: H })).json();

await fs.writeFile("out.png", Buffer.from(await (await fetch(dl.download_url)).arrayBuffer()));

```

Returns download_url and expires_at. Fetch the bytes from that URL with no auth header. Works for uploads and for job outputs alike; a job's result response includes these URLs already.

Listing and deleting​

GET /assets?kind=upload|output lists your assets with cursor pagination. DELETE /assets/{assetID} removes the object and its record. Deleting an output does not affect the job record.

Quotas​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/me/storage -H "Authorization: Bearer $MOTH_API_KEY"

```

```
print(requests.get(f"{API}/me/storage", headers=H).json())

```

```
console.log(await (await fetch(`${API}/me/storage`, { headers: H })).json());

```

Two limits, fixed per account when first used: an upload quota and a total quota across uploads and job outputs. Create-asset is refused past the upload quota; submitting a job is refused at or past the total. Pending uploads count until completed or deleted, so clean up abandoned registrations.

Reference​

Create an asset, Complete an upload, Get a download URL, List assets, Delete an asset, Storage usage.
