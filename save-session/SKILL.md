---
name: save-session
description: Save a summary of this conversation to the session logs in ~/Documents/Claude/session-logs, with one line linking its ledger ticket.
disable-model-invocation: true
---

Save a summary of this conversation to the session logs.

1. Read `~/Documents/Claude/session-logs/categories.json` to see existing categories
2. Determine the best category for this conversation (or create a new one if none fit — add it to categories.json with keywords and description)
3. Create the category folder if it doesn't exist: `~/Documents/Claude/session-logs/{category}/`
4. Find the ticket this conversation worked on: under `~/Projects/backpack` the Linear issue, elsewhere the `peterpme/home` issue. Use the issue URL. If the conversation named none, search the ledger for one matching the work (`gh issue list -R peterpme/home --search "<keywords>" --state all`); write `none` only when nothing matches.
5. Write a session log file named `{YYYY-MM-DD}-{short-slug}.md` with this format:

```
# {Short descriptive title}

**Date:** {YYYY-MM-DD HH:MM}
**Category:** {category}
**Topics:** {comma-separated topic tags}
**Ticket:** {issue URL, or none}

## Summary

{2-4 sentence summary of what was discussed, decided, and accomplished}

## Key Outcomes

- {concrete outcomes: files changed, decisions made, problems solved}

## Open Threads

- {things left unfinished or to follow up on}
```

6. Confirm the file was saved and its path.
