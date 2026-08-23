# mnemosyne-mcp — agent brief

**Read [CLAUDE.md](CLAUDE.md).** It is the single brief for this repo:
project shape, stack, layout, architecture decisions, commands, and
conventions. Everything an agent needs is there, and it applies to you
whichever agent you are — the filename is a convention, not an audience.

Current project state lives in [STATUS.md](STATUS.md), which CLAUDE.md
points at and nothing else duplicates.

## Why this file is a pointer and not a copy

It used to be a copy, and the copy rotted. By 2026-08-23 it had drifted
40 lines behind CLAUDE.md — still claiming four generator providers when
there were seven, and still calling `maxTurns` "not yet configurable"
after it became configurable. It had also been mechanically find-and-
replaced at some point, inventing a "Codex Desktop" that does not exist
in a passage specifically about Claude Desktop's content-policy behavior
sitting in the response path. Every single difference between the two
files was either staleness or that substitution; none of it was content
worth keeping.

A symlink would have been the tidy fix, but this repo is developed on
Windows without Developer Mode, where `core.symlinks` is `false` and a
git-recorded symlink checks out as a text file containing the literal
string `CLAUDE.md` — actively worse than a stale copy for the agent
trying to read it. A pointer works on every OS and every clone.

**So: don't re-expand this into a copy.** If something here needs to
change, change [CLAUDE.md](CLAUDE.md).
