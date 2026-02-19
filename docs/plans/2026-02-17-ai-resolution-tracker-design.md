# AI Resolution Tracker — Design Document

**Date:** 2026-02-17
**Status:** Approved

---

## Overview

A personal resolution tracker web app with AI-powered progress logging, sentiment analysis, and intelligent feedback. Multi-user with auth. Users set resolutions, log structured updates in natural language, and receive AI enrichment and periodic check-in nudges.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database + Auth | Supabase (PostgreSQL + email/magic link auth) |
| AI | Google Gemini API (`gemini-3-flash-preview`) via server actions |
| Email | Resend |
| UI | Tailwind CSS + shadcn/ui |
| Hosting + Cron | Vercel |

---

## Database Schema

### `profiles`
User settings and preferences.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | FK to auth.users |
| name | text | |
| check_in_frequency | enum | daily / every_3_days / weekly |
| email_checkins_enabled | boolean | |
| email_summary_enabled | boolean | |
| created_at | timestamptz | |

### `resolutions`
User-defined goals.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK to profiles |
| title | text | |
| description | text | |
| category | enum | Health, Finance, Learning, Relationships, Career, Personal |
| target_date | date | optional |
| status | enum | active / paused / completed / archived |
| created_at | timestamptz | |

### `progress_logs`
Each logged update on a resolution, enriched by AI.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| resolution_id | uuid | FK to resolutions |
| user_id | uuid | FK to profiles |
| note | text | raw user input |
| ai_sentiment | enum | positive / neutral / negative |
| ai_progress_estimate | integer | 0–100 |
| ai_feedback | text | 1–2 sentence coaching response |
| created_at | timestamptz | |

### `check_in_records`
Tracks last nudge sent per resolution to avoid over-notifying.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| resolution_id | uuid | FK to resolutions |
| user_id | uuid | FK to profiles |
| last_prompted_at | timestamptz | |

---

## Page Structure

```
/                    Landing page / login (unauthenticated)
/dashboard           Overview: all resolutions, streaks, in-app reminders
/resolutions/new     Create a resolution (AI suggests category on blur)
/resolutions/[id]    Resolution detail: log history, log new update form
/settings            Check-in frequency, email preferences
```

---

## AI Features

All Gemini API calls are made from Next.js server actions. No AI calls from the client.

### 1. Category Suggestion (resolution creation)
When the user finishes typing a title/description, a server action calls Gemini to suggest:
- A category from the enum
- A short "why this matters" framing sentence

User can accept or override both.

### 2. Progress Log Enrichment (core AI loop)
On progress log submit, Gemini receives:
- The resolution title + description
- The last 5 progress logs (for context)
- The new note

Gemini returns:
- `sentiment`: positive / neutral / negative
- `progress_estimate`: 0–100 integer
- `feedback`: 1–2 sentences of specific, encouraging coaching

Stored in `progress_logs` alongside the raw note.

### 3. Weekly AI Summary (cron)
Every Sunday, a Vercel cron job fetches each user's week of logs and calls Gemini to produce a short paragraph covering:
- What went well
- What stalled
- One concrete suggestion for next week

Displayed as a card on the dashboard and optionally emailed.

**Boundaries:**
- AI does not auto-create resolutions or logs — user always initiates
- Each Gemini call receives relevant logs as context (no persistent memory)

---

## Check-in & Notification System

### In-app reminders
On `/dashboard` load, query each resolution's most recent `progress_log`. If older than the user's configured frequency, show a dismissible banner:

> You haven't logged progress on "Run a 5K" in 8 days. Log now →

Banners reappear after 24 hours if dismissed.

### Email notifications (Resend + Vercel cron)

| Job | Schedule | Content |
|-----|----------|---------|
| Check-in nudge | Mon & Thu 9am UTC | Resolutions with no recent log |
| Weekly summary | Sun 8pm UTC | AI-generated week-in-review |

Both jobs are opt-in independently via `/settings`. Emails are plain-text with direct links back to the relevant resolution.

### Frequency settings
Per-user configurable: daily / every 3 days / weekly. Cron job reads this before deciding whether to email each user.

---

## What's Explicitly Out of Scope

- Mobile app
- Social/sharing features
- Rich HTML email templates
- AI with persistent memory across sessions
- Third-party calendar integration
