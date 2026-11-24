---
name: research
description: "Use before building on something you have not just read: how a library's model works, how a protocol behaves, or how other products built the feature you are about to design. Also when Peter asks for a topic to be researched. Reads primary sources and saves the findings with their links."
---

# Research

Read before you build; never design from memory. After Matt Pocock's `research`.

1. Start a background agent with a fresh context to do the reading, so the main thread keeps working (`delegate`, the `investigate` row).
2. It reads primary sources: the official docs for the installed version, the library's own source, specs, first-party APIs, and working examples from the people who make the thing. For a product feature, how two or three other products do it, from their own docs and apps. Not someone's summary of them.
3. It writes one Markdown file with each claim beside its source link, and what it could not find. Save it where the repo keeps such notes; if it has none, `.verification/<task>/research.md`, and say where.
4. Build from that file and link it in the plan or the PR.
