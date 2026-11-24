---
name: grilling
description: "Use only when Peter says grill me, ask me first or interview me: an interview that settles a plan or design before anything is built. Never start it yourself."
disable-model-invocation: true
---

# Grilling

Interview Peter until no answer would change the build. Facts are yours to find; decisions are his. After Matt Pocock's `grilling`, without a cap on questions.

1. **Look first.** Reread the request, then the repo's agents file and docs, the code it touches, earlier threads and PRs, and the ticket. A question any of them answers, or that a lookup or a quick test settles, is not a question: record the answer as a decision with its source.
2. **Ask in rounds.** A round is every open decision whose prerequisites are settled, numbered, each with your pick, worded so "yes" takes it. A question that depends on another still open waits for a later round.
3. **Wait for his answers.** If he answers part, or moves on, say in one line that you are taking your picks for the rest, and go. Never post a question again.
4. **Stop when no answer would change the build.** His answers become the decisions on the ticket; unanswered questions go there with your picks.
