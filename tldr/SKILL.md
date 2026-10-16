---
name: tldr
description: Shrink the last response to a five-second brief - one-line TLDR, numbered decisions with the agent's pick, Done, and Next.
disable-model-invocation: true
---

Rewrite your last response for a busy reader who skims it once and remembers nothing of the thread.

Use only what that response says. Shorten and reword it, but add no decision, reason, step, or fact of your own. If it was wrong or unclear, say so under Next.

**TLDR:** One sentence: does it work, and the cost if the response gave one.

**Decide**
1. Question? → **your pick**, and the response's reason if it gave one.

**Done**
- What this work changed, not how.

**Next**
- What is unverified, blocked, or left, and the step the response gave for it.

Rules:
- Decisions most urgent first, numbered so the reader can reply "1 yes, 2 B". Name another option only if the response did.
- Turn their actions into decisions ("Merge PR #6? → **yes**"). Include any call you made for them that they might veto.
- At most 3 Done lines and 3 Next lines. Every line, the TLDR too, is 15 words or fewer. Fragments are fine.
- Skip empty sections. If nothing needs them, end the TLDR with "Nothing needed from you."
- Plain words. Drop labels and IDs invented during the work unless they need one to act.
- No preamble, recap, narration, praise, or hedging.

Example:

**TLDR:** The bot works locally but isn't in Slack yet; cost not measured.

**Decide**
1. Which team hosts it? → **the company team**; personal plan is non-commercial only.
2. Merge and deploy #129? → **yes**. The bot needs it to read production.
3. Fix the wrong-name bug in a separate PR? → **yes**.

**Done**
- Production commands now need one token instead of a login.
- Bot only writes to production after an Approve click.
- Local tests passed: edit, relink, cancel, read-only question.

**Next**
- Not tested in Slack. Install the app from `README.md`, then set the Vercel variables.
