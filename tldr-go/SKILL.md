---
name: tldr-go
description: Approve the picks from the last /tldr and do its Next steps. Manual only.
disable-model-invocation: true
argument-hint: "[overrides, e.g. 1 no, 2 B, skip next]"
---

# /tldr-go

The user read your last `/tldr` and wants you to handle it. If there is no `/tldr` in this thread, build one from the last response first, silently.

## What to do

1. Read any arguments as overrides: `1 no`, `2 B`, `skip 3`, `only next`. Anything not overridden is approved as your pick.
2. Carry out each approved decision.
3. Do each Next step you can do yourself: check what was unverified, fix what was broken, run what was left.
4. Prove each one by running the real flow and looking at the result, as you would for any task.

## Limits

- Do only what the `/tldr` listed. Running this approves those items and nothing else.
- If an item needs something you cannot get, such as credentials, a person, or access, skip it and say exactly what is missing.
- If doing an item shows your pick was wrong, stop that item and bring it back as a decision.

## Report

End with a new `/tldr` covering only this run: what got done, what is still on them, and what is next.
