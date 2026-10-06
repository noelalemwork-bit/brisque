AuthenticationOn this page
Authentication

Every request carries a bearer token:

```
Authorization: Bearer moth_…

```

API keys​

Programmatic access uses an API key, a token starting with moth_. Create, disable, and revoke keys in the dashboard. The plaintext is shown exactly once at creation and is never stored by the platform. If you lose it, revoke it and create another.

Keys are scoped to your account: they see your private engines, your jobs, and your assets, and nothing of anyone else's. Rate limit: 300 requests per minute per key. Exceeding it returns 429.

Keys cannot manage other keys. The key endpoints under /api/v1/keys accept only a dashboard session, so a leaked key cannot mint or revoke keys.

Dashboard sessions​

The web dashboard signs in with Supabase and calls the same API with a short-lived session token. You never need one for your own code. Use a key.

Check who you are​

curlPythonJavaScript
```
curl -s https://api.mothquantum.com/api/v1/me -H "Authorization: Bearer $MOTH_API_KEY"

```

```
import os, requests

r = requests.get("https://api.mothquantum.com/api/v1/me",

                 headers={"Authorization": f"Bearer {os.environ['MOTH_API_KEY']}"})

print(r.status_code, r.json())

```

```
const r = await fetch("https://api.mothquantum.com/api/v1/me",

  { headers: { Authorization: `Bearer ${process.env.MOTH_API_KEY}` } });

console.log(r.status, await r.json());

```

Returns your user id. A 401 here means the key is invalid, disabled, or revoked.

Ownership and 404​

Resources you do not own return 404 Not Found, never 403. Another user's private engine, job, asset, or key looks exactly like one that does not exist. Design retries and error handling around that: a 404 on something you created means the id is wrong, and a 404 on something you did not create is expected.

Keep keys out of code​

Read the key from the environment or a secret store. Never commit it. If a key appears in a repository, revoke it immediately in the dashboard; there is no way to make a leaked key safe again.
