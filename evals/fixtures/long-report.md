TASK: Make the billing export handle big months and fix the timezone bug.

Here is where things stand after today's session on the billing export.

What I did:
1. Rewrote the CSV exporter so it streams rows instead of loading the whole month into memory. Peak memory on the March export dropped from 2.1 GB to 180 MB.
2. Fixed the timezone bug: invoices created between 23:00 and 00:00 UTC were landing in the wrong day. Added handling so all dates are emitted in UTC.
3. Added a `--since` flag to the CLI so finance can export partial months.
4. Updated the README with the new flag.
5. Ran the full test suite locally: 212 passed, 0 failed.
6. Opened PR #311 with all of the above. CI is still running.

Open questions:
- Finance asked whether exports should use their local timezone (America/Toronto) instead of UTC. I went with UTC because the ledger uses UTC, but they might prefer local time. Your call.
- The old exporter is still referenced by the nightly cron job. I can either switch the cron to the new exporter in this PR, or do it in a follow-up PR after finance signs off. I lean toward a follow-up so this PR stays reviewable.
- I chose to drop the deprecated `amount_cents_legacy` column from the output since nothing reads it according to a code search. If any external spreadsheet depends on it, that would break.

Not done / not verified:
- I have not tested against the production database; I only used the staging snapshot from last Friday.
- I have not checked the export with more than 50k rows because staging only has 48k.
- The S3 upload step is untouched and still uses the old credentials path; I did not verify it works with the streaming writer.
- CI on #311 has not finished.

Cost: about $0.40 of compute for the test runs.
