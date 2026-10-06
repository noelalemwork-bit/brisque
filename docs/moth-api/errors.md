Errors & rate limitsOn this page
Errors and rate limits

Every error is application/problem+json (RFC 7807):

```
{

  "title": "Unprocessable Entity",

  "status": 422,

  "detail": "validation failed",

  "errors": [

    {"location": "body.params.shots", "message": "expected integer >= 1", "value": 0}

  ]

}

```

errors[] is present when there is more than one thing to say, each with a location in the request, a message, and the offending value.

Status codes​

StatusWhenWhat to do401Missing, invalid, disabled, or revoked keyCheck the Authorization header and the key in the dashboard.404The resource does not exist, or is not yoursNever a 403. See Authentication.409Wrong state: result not ready, upload already completedPoll status, or stop retrying the completed action.410Result no longer retrievableUse the output assets if the engine produced files.415Engine needs files the request did not provideUpload assets and pass them in input_files.422Validation failedRead errors[]; fix every entry. For jobs, engine-specific codes appear in errors[].message.429Rate limitWait and retry with backoff.502Upstream storage or key service failedRetry.503Job runtime unavailableRetry with backoff; the job was not recorded.500UnexpectedRetry once; report if it persists.
Engine errors on a job​

A job that fails during processing shows status: failed and an error object on /status:

```
{"status": "failed", "error": {"type": "processing_failed", "message": "…", "retryable": false}}

```

Each engine's catalog page lists its error_codes. retryable: true means the same submission may succeed if repeated.

Rate limits​

300 requests per minute per API key. A 429 carries no reset header today, so back off for a few seconds and retry. Polling every two to five seconds stays well inside the limit.

Reporting a problem​

Include the job_id or asset_id, the timestamp, and the full error body. Never include your API key.
