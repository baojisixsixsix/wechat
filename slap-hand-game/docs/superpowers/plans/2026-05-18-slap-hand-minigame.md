# Slap Hand Minigame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WeChat Mini Program where left and right direction buttons trigger matching slap animations against the cartoon face.

**Architecture:** The project uses a single Mini Program page with image assets stored under `assets/`. Page state controls which face is displayed, which hand animation runs, and the left/right hit counters.

**Tech Stack:** WeChat Mini Program WXML/WXSS/JavaScript, static PNG assets.

---

### Task 1: Mini Program Shell

**Files:**
- Create: `app.js`
- Create: `app.json`
- Create: `app.wxss`
- Create: `project.config.json`
- Create: `sitemap.json`

- [x] **Step 1: Create WeChat project configuration**

Add root app configuration, basic global styles, and a tourist app id so the project can be imported into WeChat Developer Tools.

### Task 2: Game Page

**Files:**
- Create: `pages/index/index.wxml`
- Create: `pages/index/index.wxss`
- Create: `pages/index/index.js`
- Create: `pages/index/index.json`

- [x] **Step 1: Build the play surface**

Add a center arena for the face, transient hand image, hit flash, score bar, prompt text, and two image buttons.

- [x] **Step 2: Implement slap state**

Use `playSlap()` to swap the face image, show the matching hand, increment the correct counter, and reset after a short timer.

- [x] **Step 3: Add motion feedback**

Use WXSS keyframes for left/right hand travel, face shake, and impact pulse.

### Task 3: Assets And Docs

**Files:**
- Create: `assets/face-normal.png`
- Create: `assets/face-hit-left.png`
- Create: `assets/face-hit-right.png`
- Create: `assets/hand-palm-wind.png`
- Create: `assets/hand-back-wind.png`
- Create: `assets/key-left.png`
- Create: `assets/key-right.png`
- Create: `docs/GAME_DEV_INDEX.md`

- [x] **Step 1: Copy generated assets into the project**

Copy the selected generated PNGs into stable project paths.

- [x] **Step 2: Register project documentation**

Create the game development index and record the created plan document plus completed feature progress.
