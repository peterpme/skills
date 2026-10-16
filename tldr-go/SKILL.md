---
name: tldr-go
description: Approve the picks in the last TLDR brief and carry out its decisions and Next steps. Add overrides like "1 no, 2 B".
disable-model-invocation: true
argument-hint: "[overrides, e.g. 1 no, 2 B, skip 3]"
---

The user approved your last TLDR brief. If this thread has none, build one from your last response first, without showing it.

1. Read any text after the command as overrides: `1 no`, `2 B`, `skip 3`, `only next`. Everything else is approved as your pick.
2. Carry out each approved decision, then each Next step you can do yourself.
3. Prove each one by running the real flow and checking the result.

Limits:
- Do only what the brief listed. This approves those items and nothing else.
- If an item needs something you can't get, such as credentials, a person, or access, skip it and say exactly what is missing.
- If an item shows your pick was wrong, stop that item and bring it back as a decision.

End with a new brief covering only this run, in the same format: **TLDR:** one sentence; **Decide**, numbered with your picks; **Done** and **Next**, at most 3 lines each; at most 15 words per line.
