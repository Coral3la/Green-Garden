# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Green Garden is a houseplant care tracker — an Angular 19 frontend talking over
HTTP to a FastAPI backend backed by MongoDB, with an optional OpenAI-powered
"botanic expert" chat.

Detailed guidance is split into `.claude/rules/`:
- `commands.md` — build, run, and test commands (loaded every session)
- `architecture.md` — big-picture data flow + the in-flight auth migration (loaded every session)
- `backend.md` — backend module map + conventions (loads when you open `backend/**`)
- `frontend.md` — frontend module map + conventions (loads when you open `frontend/**`)
