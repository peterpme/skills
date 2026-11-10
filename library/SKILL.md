---
name: library
description: Add a book, paper or post to Peter's reading library and keep it consistent - save the original, record its source, build the searchable copy, read it, write its brief, link it into the study guide. Use when Peter sends a PDF or link to add to the library or reading list, or asks where reading material goes. Not for reading a document once without keeping it.
---

The library has two parts. Written files live in `~/Projects/home/docs/library/` (read its `README.md` first; run `git -C ~/Projects/home pull --ff-only`). Originals and the generated `md/` copies live in `~/Documents/library/`, outside git.

## Adding a document

1. **Source.** Only the author's or publisher's own free copy, an open-access file, or a page saved from the official site. Otherwise stop and tell Peter. Download with `curl -fsSL`, then `file` the result: it must be a PDF, not a login page.
2. **Name and place.** Save under `~/Documents/library/<folder>/` as `NN-author-year-title.pdf`, with `NN` the next number in that folder. Folders: `engineering-reading/papers/`, `books/`, `state-machines/`, `ai-labs/<lab>/`. Take the real title and year from the file itself; the link text can be wrong.
3. **Source row.** Add the title, author, year and source URL to `docs/library/sources/engineering-reading.md` (or `llp-prior-art.md`).
4. **Searchable copy.** `uv run -q --with pymupdf4llm --with trafilatura python -I ~/Projects/home/docs/library/scripts/build-md.py`. Check that it reports the page count and 0 failed.
5. **Read it, then brief it.** Read the parts the brief will cite from the `md/` copy; skip nothing you cite. Write `docs/library/briefs/<same path as md/>` in the format in `docs/library/briefs/README.md`: own words, 600 to 1,200 words for a paper, a page number for every key idea. Say which sections you did not read.
6. **Sync.** `python3 -I ~/Projects/home/docs/library/scripts/sync-briefs.py` must report 0 missing, 0 stale, 0 bad pages.
7. **Study guide.** If the document supports or changes one of the ten ideas, add it as a section in the matching `docs/library/study/0N-*.md` using that guide's five parts, and update `00-READING-PATH.md`. The "On your desk" example is labeled as an illustration. A real event from Peter's work goes in `07-your-cases.md` with its issue number. If it fits no guide, say so and stop; do not create a guide unasked.
8. **Commit.** Only `docs/library/` changes go to git; PDFs and `md/` never do. Docs-only change in `home`: branch, PR, and merge it yourself when the sync check passed (personal repo rule). Link the PR.

## Report

Reply in the tldr shape: the document's real title and year, the pages you read and skipped, the guide section you added, and anything unverified (code in the paper you did not run, claims you did not check).

Never invent what a paper says from its abstract. Never present an illustration as something that happened to Peter.
