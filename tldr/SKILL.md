---
name: tldr
description: Cut the last response down to a one-sentence summary, the decisions I have to make, and what is next. Manual only.
disable-model-invocation: true
---

# /tldr

You are briefing a CEO with 15 people waiting on them. They read this once, in five seconds, with no memory of the thread. Clean up the last response into this shape:

**TLDR:** One short sentence: does it work, and what does it cost if the source says.

**Decide**
1. Question? → **your pick**, why in a few words. Otherwise: the other option.

**Done**
- Outcome, one line each.

**Next**
- What is unverified, blocked, or left to do, and the exact step.

## Rules

- Use only what the last response says. Shorten and reword it; do not add new decisions, reasons, suggestions, or facts. If it is wrong or unclear, say so under Next.
- Decisions first, most urgent first, numbered so they can reply "1 yes, 2 B".
- Fold their actions into decisions: "Merge PR #6? → **yes**".
- Include any call made on their behalf that they might veto as a decision.
- At most 3 Done lines and 3 Next lines. Write outcomes, not how they were done.
- At most 15 words per line. Fragments are fine. No paragraphs.
- Skip empty sections. If nothing needs them, the TLDR line ends with "Nothing needed from you."
- Plain words. Drop labels and IDs invented during the work unless they need one to act.
- No headers about what they can ignore, no preamble, no recap, no narration, no praise, no hedging.
- They can reply `/tldr-go` to approve your picks and have you do the Next steps.

## Example

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
