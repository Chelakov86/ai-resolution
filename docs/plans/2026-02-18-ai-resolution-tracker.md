# AI Resolution Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-user web app where people set yearly resolutions, log natural-language progress updates enriched by Google Gemini AI, and receive intelligent feedback and check-in nudges.

**Architecture:** Full-stack Next.js 15 App Router monolith — UI, server actions, and API routes all in one codebase. Supabase handles auth and PostgreSQL storage. Google Gemini API is called exclusively from server-side code (server actions / API routes). Vercel cron jobs drive email notifications via Resend.

**Tech Stack:** Next.js 15, TypeScript, Supabase (`@supabase/ssr`), Google Gemini API (`@google/genai`, model `gemini-3-flash-preview`), Resend, Tailwind CSS, shadcn/ui, Vitest, Vercel

---

## Environment Variables

Create `.env.local` with these keys before starting. Get values from each service's dashboard.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
CRON_SECRET=                    # any random string, e.g. openssl rand -hex 32
```

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `vitest.config.ts`, `src/test/setup.ts`

**Step 1: Create the Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git
```

When prompted: use App Router (yes), Turbopack (yes), ESLint (yes).

**Step 2: Install runtime dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @google/genai resend \
  @hookform/resolvers react-hook-form zod \
  date-fns
```

**Step 3: Install dev/test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom
```

**Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted: Default style, neutral color, CSS variables (yes).

**Step 5: Add shadcn components**

```bash
npx shadcn@latest add button card input label textarea select badge \
  sonner form separator skeleton
```

**Step 6: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 7: Create `src/test/setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

**Step 8: Add test script to `package.json`**

In `package.json`, add to the `"scripts"` object:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 9: Verify vitest works**

```bash
npm test
```

Expected: "No test files found" — that's fine, no error.

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Vitest and shadcn/ui"
```

---

## Task 2: Supabase Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

**Step 2: Create `supabase/migrations/001_initial_schema.sql`**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles (one per auth user)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  check_in_frequency TEXT NOT NULL DEFAULT 'every_3_days'
    CHECK (check_in_frequency IN ('daily', 'every_3_days', 'weekly')),
  email_checkins_enabled BOOLEAN NOT NULL DEFAULT true,
  email_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resolutions
CREATE TABLE resolutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('Health','Finance','Learning','Relationships','Career','Personal')),
  ai_framing TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Progress logs
CREATE TABLE progress_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resolution_id UUID REFERENCES resolutions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
  ai_progress_estimate INTEGER CHECK (ai_progress_estimate BETWEEN 0 AND 100),
  ai_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Check-in records (tracks last nudge per resolution)
CREATE TABLE check_in_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resolution_id UUID REFERENCES resolutions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  last_prompted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resolution_id)
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_records ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own
CREATE POLICY "profiles_self" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Resolutions: users can only access their own
CREATE POLICY "resolutions_self" ON resolutions
  FOR ALL USING (auth.uid() = user_id);

-- Progress logs: users can only access their own
CREATE POLICY "progress_logs_self" ON progress_logs
  FOR ALL USING (auth.uid() = user_id);

-- Check-in records: users can only access their own
CREATE POLICY "check_in_records_self" ON check_in_records
  FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Step 3: Apply schema in Supabase**

1. Go to your Supabase project → SQL Editor
2. Paste the entire contents of `001_initial_schema.sql`
3. Click "Run"
4. Verify in Table Editor: you should see `profiles`, `resolutions`, `progress_logs`, `check_in_records`

**Step 4: Copy `.env.local` values**

Go to Supabase → Project Settings → API. Copy:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

**Step 5: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase schema with RLS policies"
```

---

## Task 3: Supabase Client Utilities + Middleware

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`

**Step 1: Create `src/lib/supabase/client.ts`**

For use in Client Components only.

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 2: Create `src/lib/supabase/server.ts`**

For use in Server Components, Server Actions, and Route Handlers.

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — middleware handles refresh
          }
        },
      },
    }
  )
}
```

**Step 3: Create `src/middleware.ts`**

This refreshes auth tokens on every request.

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/resolutions') ||
    request.nextUrl.pathname.startsWith('/settings')

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron).*)'],
}
```

**Step 4: Verify the app still builds**

```bash
npm run build
```

Expected: Build succeeds (or only pre-existing type errors).

**Step 5: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: add Supabase client utilities and auth middleware"
```

---

## Task 4: Auth Pages

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/actions/auth.ts`
- Modify: `src/app/page.tsx`

**Step 1: Create `src/actions/auth.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: { name: formData.get('name') as string },
    },
  })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
```

**Step 2: Create `src/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  )
}
```

**Step 3: Create `src/app/(auth)/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your resolution tracker</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          No account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 4: Create `src/app/(auth)/signup/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await signup(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Start tracking your resolutions</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 5: Update `src/app/page.tsx` to redirect**

Replace the entire file contents with:

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

**Step 6: Build to check for type errors**

```bash
npm run build
```

Expected: Build succeeds.

**Step 7: Manual smoke test**

```bash
npm run dev
```

Navigate to `http://localhost:3000` — should redirect to `/login`. Try creating an account. Should redirect to `/dashboard` (which doesn't exist yet — a 404 is fine at this point).

**Step 8: Commit**

```bash
git add src/app/(auth)/ src/actions/auth.ts src/app/page.tsx
git commit -m "feat: add auth pages and login/signup server actions"
```

---

## Task 5: TypeScript Types

**Files:**
- Create: `src/types/database.ts`

**Step 1: Create `src/types/database.ts`**

These mirror the Supabase schema exactly. No generation tool needed.

```typescript
export type CheckInFrequency = 'daily' | 'every_3_days' | 'weekly'
export type ResolutionCategory = 'Health' | 'Finance' | 'Learning' | 'Relationships' | 'Career' | 'Personal'
export type ResolutionStatus = 'active' | 'paused' | 'completed' | 'archived'
export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface Profile {
  id: string
  name: string | null
  check_in_frequency: CheckInFrequency
  email_checkins_enabled: boolean
  email_summary_enabled: boolean
  created_at: string
}

export interface Resolution {
  id: string
  user_id: string
  title: string
  description: string | null
  category: ResolutionCategory | null
  ai_framing: string | null
  target_date: string | null
  status: ResolutionStatus
  created_at: string
}

export interface ProgressLog {
  id: string
  resolution_id: string
  user_id: string
  note: string
  ai_sentiment: Sentiment | null
  ai_progress_estimate: number | null
  ai_feedback: string | null
  created_at: string
}

export interface CheckInRecord {
  id: string
  resolution_id: string
  user_id: string
  last_prompted_at: string
}
```

**Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add TypeScript database types"
```

---

## Task 6: Gemini AI Utilities

**Files:**
- Create: `src/lib/ai.ts`
- Create: `src/lib/__tests__/ai.test.ts`

**Step 1: Write failing tests for `src/lib/__tests__/ai.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parseEnrichmentResponse, parseCategoryResponse } from '@/lib/ai'

describe('parseEnrichmentResponse', () => {
  it('parses a valid positive response', () => {
    const json = JSON.stringify({
      sentiment: 'positive',
      progress_estimate: 75,
      feedback: 'Great consistency this week! Keep building that momentum.',
    })
    const result = parseEnrichmentResponse(json)
    expect(result.sentiment).toBe('positive')
    expect(result.progress_estimate).toBe(75)
    expect(result.feedback).toBe('Great consistency this week! Keep building that momentum.')
  })

  it('clamps progress_estimate to 0-100 range', () => {
    const json = JSON.stringify({ sentiment: 'neutral', progress_estimate: 150, feedback: 'ok' })
    const result = parseEnrichmentResponse(json)
    expect(result.progress_estimate).toBe(100)
  })

  it('defaults to neutral on invalid sentiment', () => {
    const json = JSON.stringify({ sentiment: 'amazing', progress_estimate: 50, feedback: 'ok' })
    const result = parseEnrichmentResponse(json)
    expect(result.sentiment).toBe('neutral')
  })

  it('throws on malformed JSON', () => {
    expect(() => parseEnrichmentResponse('not json')).toThrow()
  })
})

describe('parseCategoryResponse', () => {
  it('parses a valid category response', () => {
    const json = JSON.stringify({
      category: 'Health',
      framing: 'Your body is your longest investment.',
    })
    const result = parseCategoryResponse(json)
    expect(result.category).toBe('Health')
    expect(result.framing).toBe('Your body is your longest investment.')
  })

  it('returns null category if not in allowed list', () => {
    const json = JSON.stringify({ category: 'Hobbies', framing: 'Fun stuff.' })
    const result = parseCategoryResponse(json)
    expect(result.category).toBeNull()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '@/lib/ai'"

**Step 3: Create `src/lib/ai.ts`**

```typescript
import { GoogleGenAI } from '@google/genai'
import type { Sentiment, ResolutionCategory } from '@/types/database'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const MODEL = 'gemini-3-flash-preview'

const VALID_SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative']
const VALID_CATEGORIES: ResolutionCategory[] = [
  'Health', 'Finance', 'Learning', 'Relationships', 'Career', 'Personal',
]

export interface EnrichmentResult {
  sentiment: Sentiment
  progress_estimate: number
  feedback: string
}

export interface CategoryResult {
  category: ResolutionCategory | null
  framing: string
}

export function parseEnrichmentResponse(text: string): EnrichmentResult {
  const data = JSON.parse(text)
  const sentiment = VALID_SENTIMENTS.includes(data.sentiment) ? data.sentiment : 'neutral'
  const progress_estimate = Math.min(100, Math.max(0, Number(data.progress_estimate) || 0))
  return { sentiment, progress_estimate, feedback: String(data.feedback || '') }
}

export function parseCategoryResponse(text: string): CategoryResult {
  const data = JSON.parse(text)
  const category = VALID_CATEGORIES.includes(data.category) ? data.category : null
  return { category, framing: String(data.framing || '') }
}

export async function enrichProgressLog(params: {
  resolutionTitle: string
  resolutionDescription: string | null
  recentLogs: Array<{ note: string; created_at: string }>
  newNote: string
}): Promise<EnrichmentResult> {
  const context = params.recentLogs
    .slice(-5)
    .map((l) => `- ${l.note} (${l.created_at.slice(0, 10)})`)
    .join('\n') || 'No previous logs.'

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `You are analyzing a progress update for a personal resolution. Respond with valid JSON only — no markdown, no explanation.

Resolution: ${params.resolutionTitle}
${params.resolutionDescription ? `Description: ${params.resolutionDescription}` : ''}

Recent progress logs:
${context}

New update: ${params.newNote}

Respond with this exact JSON structure:
{"sentiment":"positive|neutral|negative","progress_estimate":0-100,"feedback":"1-2 sentences of specific encouraging coaching"}`,
  })

  return parseEnrichmentResponse(response.text ?? '{}')
}

export async function suggestCategory(params: {
  title: string
  description: string
}): Promise<CategoryResult> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Suggest a category and motivational framing for this resolution. Respond with valid JSON only.

Resolution title: ${params.title}
Description: ${params.description}

Categories (choose exactly one): Health, Finance, Learning, Relationships, Career, Personal

Respond with this exact JSON structure:
{"category":"one of the above","framing":"one sentence about why this matters"}`,
  })

  return parseCategoryResponse(response.text ?? '{}')
}

export async function generateWeeklySummary(params: {
  userName: string | null
  logs: Array<{ resolution_title: string; note: string; ai_sentiment: string | null; created_at: string }>
}): Promise<string> {
  if (params.logs.length === 0) return ''

  const logText = params.logs
    .map((l) => `[${l.resolution_title}] ${l.note} (${l.ai_sentiment ?? 'no sentiment'})`)
    .join('\n')

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Write a brief weekly summary for ${params.userName ?? 'this person'}'s resolution progress. Be warm, specific, and end with one concrete suggestion.

This week's logs:
${logText}

Write 2-3 short paragraphs. No bullet points. No markdown.`,
  })

  return response.text ?? ''
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/ai.ts src/lib/__tests__/ai.test.ts
git commit -m "feat: add Gemini AI utilities with unit tests"
```

---

## Task 7: Resolution Actions

**Files:**
- Create: `src/actions/resolutions.ts`
- Create: `src/lib/__tests__/reminders.test.ts`
- Create: `src/lib/reminders.ts`

**Step 1: Write failing test for reminder logic**

Create `src/lib/__tests__/reminders.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { needsReminder } from '@/lib/reminders'

describe('needsReminder', () => {
  const now = new Date('2026-02-18T10:00:00Z')

  it('returns true when no log ever', () => {
    expect(needsReminder(null, 'daily', now)).toBe(true)
  })

  it('returns true for daily when last log was 2 days ago', () => {
    const lastLog = new Date('2026-02-16T10:00:00Z')
    expect(needsReminder(lastLog, 'daily', now)).toBe(true)
  })

  it('returns false for daily when last log was 12 hours ago', () => {
    const lastLog = new Date('2026-02-17T22:00:00Z')
    expect(needsReminder(lastLog, 'daily', now)).toBe(false)
  })

  it('returns true for every_3_days when last log was 4 days ago', () => {
    const lastLog = new Date('2026-02-14T10:00:00Z')
    expect(needsReminder(lastLog, 'every_3_days', now)).toBe(true)
  })

  it('returns false for every_3_days when last log was 2 days ago', () => {
    const lastLog = new Date('2026-02-16T10:00:00Z')
    expect(needsReminder(lastLog, 'every_3_days', now)).toBe(false)
  })

  it('returns true for weekly when last log was 8 days ago', () => {
    const lastLog = new Date('2026-02-10T10:00:00Z')
    expect(needsReminder(lastLog, 'weekly', now)).toBe(true)
  })

  it('returns false for weekly when last log was 5 days ago', () => {
    const lastLog = new Date('2026-02-13T10:00:00Z')
    expect(needsReminder(lastLog, 'weekly', now)).toBe(false)
  })
})
```

**Step 2: Run to verify it fails**

```bash
npm test
```

Expected: FAIL — "Cannot find module '@/lib/reminders'"

**Step 3: Create `src/lib/reminders.ts`**

```typescript
import type { CheckInFrequency } from '@/types/database'

const THRESHOLD_HOURS: Record<CheckInFrequency, number> = {
  daily: 24,
  every_3_days: 72,
  weekly: 168,
}

export function needsReminder(
  lastLogDate: Date | null,
  frequency: CheckInFrequency,
  now: Date = new Date()
): boolean {
  if (!lastLogDate) return true
  const hoursSince = (now.getTime() - lastLogDate.getTime()) / (1000 * 60 * 60)
  return hoursSince >= THRESHOLD_HOURS[frequency]
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS.

**Step 5: Create `src/actions/resolutions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { suggestCategory } from '@/lib/ai'
import type { ResolutionCategory, ResolutionStatus } from '@/types/database'

export async function createResolution(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const target_date = formData.get('target_date') as string | null

  // Get AI category suggestion
  let category: ResolutionCategory | null = null
  let ai_framing: string | null = null
  try {
    const suggestion = await suggestCategory({ title, description: description || title })
    category = suggestion.category
    ai_framing = suggestion.framing || null
  } catch {
    // AI enrichment is best-effort
  }

  const { data, error } = await supabase
    .from('resolutions')
    .insert({
      user_id: user.id,
      title,
      description: description || null,
      category,
      ai_framing,
      target_date: target_date || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect(`/resolutions/${data.id}`)
}

export async function updateResolutionStatus(id: string, status: ResolutionStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('resolutions')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath(`/resolutions/${id}`)
}
```

**Step 6: Commit**

```bash
git add src/actions/resolutions.ts src/lib/reminders.ts src/lib/__tests__/reminders.test.ts
git commit -m "feat: add resolution server actions and reminder logic with tests"
```

---

## Task 8: Progress Log Actions

**Files:**
- Create: `src/actions/progress-logs.ts`

**Step 1: Create `src/actions/progress-logs.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { enrichProgressLog } from '@/lib/ai'

export async function createProgressLog(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const resolution_id = formData.get('resolution_id') as string
  const note = formData.get('note') as string

  // Fetch resolution for context
  const { data: resolution } = await supabase
    .from('resolutions')
    .select('title, description')
    .eq('id', resolution_id)
    .single()

  // Fetch recent logs for context
  const { data: recentLogs } = await supabase
    .from('progress_logs')
    .select('note, created_at')
    .eq('resolution_id', resolution_id)
    .order('created_at', { ascending: false })
    .limit(5)

  // AI enrichment (best-effort)
  let enrichment = { sentiment: null, progress_estimate: null, feedback: null } as {
    sentiment: 'positive' | 'neutral' | 'negative' | null
    progress_estimate: number | null
    feedback: string | null
  }

  if (resolution) {
    try {
      const result = await enrichProgressLog({
        resolutionTitle: resolution.title,
        resolutionDescription: resolution.description,
        recentLogs: recentLogs ?? [],
        newNote: note,
      })
      enrichment = result
    } catch {
      // AI enrichment is best-effort
    }
  }

  const { error } = await supabase.from('progress_logs').insert({
    resolution_id,
    user_id: user.id,
    note,
    ai_sentiment: enrichment.sentiment,
    ai_progress_estimate: enrichment.progress_estimate,
    ai_feedback: enrichment.feedback,
  })

  if (error) return { error: error.message }
  revalidatePath(`/resolutions/${resolution_id}`)
  revalidatePath('/dashboard')
}
```

**Step 2: Commit**

```bash
git add src/actions/progress-logs.ts
git commit -m "feat: add progress log server action with AI enrichment"
```

---

## Task 9: App Layout and Navigation

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/nav.tsx`

**Step 1: Create `src/components/nav.tsx`**

```typescript
import Link from 'next/link'
import { logout } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export function Nav() {
  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold text-gray-900">
          Resolutions
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/resolutions/new" className="text-sm text-gray-600 hover:text-gray-900">
            + New
          </Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">Sign out</Button>
          </form>
        </div>
      </div>
    </nav>
  )
}
```

**Step 2: Create `src/app/(app)/layout.tsx`**

```typescript
import { Nav } from '@/components/nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/(app)/layout.tsx src/components/nav.tsx
git commit -m "feat: add app layout with navigation"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/components/resolution-card.tsx`
- Create: `src/components/reminder-banner.tsx`

**Step 1: Create `src/components/reminder-banner.tsx`**

```typescript
import Link from 'next/link'
import { needsReminder } from '@/lib/reminders'
import type { Resolution, CheckInFrequency } from '@/types/database'

interface Props {
  resolutions: Array<Resolution & { last_log_at: string | null }>
  frequency: CheckInFrequency
}

export function ReminderBanners({ resolutions, frequency }: Props) {
  const overdue = resolutions.filter(
    (r) =>
      r.status === 'active' &&
      needsReminder(r.last_log_at ? new Date(r.last_log_at) : null, frequency)
  )

  if (overdue.length === 0) return null

  return (
    <div className="space-y-2 mb-6">
      {overdue.map((r) => (
        <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            No recent update for <strong>{r.title}</strong>
            {r.last_log_at
              ? ` — last logged ${Math.floor((Date.now() - new Date(r.last_log_at).getTime()) / 86400000)} days ago`
              : ' — never logged'}
          </p>
          <Link
            href={`/resolutions/${r.id}`}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap ml-4"
          >
            Log now →
          </Link>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Create `src/components/resolution-card.tsx`**

```typescript
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Resolution } from '@/types/database'

const CATEGORY_COLORS: Record<string, string> = {
  Health: 'bg-green-100 text-green-800',
  Finance: 'bg-blue-100 text-blue-800',
  Learning: 'bg-purple-100 text-purple-800',
  Relationships: 'bg-pink-100 text-pink-800',
  Career: 'bg-orange-100 text-orange-800',
  Personal: 'bg-gray-100 text-gray-800',
}

interface Props {
  resolution: Resolution & { last_log_at: string | null; log_count: number }
}

export function ResolutionCard({ resolution: r }: Props) {
  return (
    <Link href={`/resolutions/${r.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{r.title}</CardTitle>
            {r.category && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${CATEGORY_COLORS[r.category] ?? ''}`}>
                {r.category}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {r.ai_framing && (
            <p className="text-sm text-gray-500 mb-2">{r.ai_framing}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{r.log_count} {r.log_count === 1 ? 'update' : 'updates'}</span>
            {r.last_log_at && (
              <span>Last update {new Date(r.last_log_at).toLocaleDateString()}</span>
            )}
            <Badge variant={r.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {r.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

**Step 3: Create `src/app/(app)/dashboard/page.tsx`**

```typescript
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResolutionCard } from '@/components/resolution-card'
import { ReminderBanners } from '@/components/reminder-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile + resolutions with log metadata in one query
  const [{ data: profile }, { data: resolutions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.rpc('get_resolutions_with_log_meta', { p_user_id: user.id }),
  ])

  // Fetch weekly summary if exists
  const { data: weeklySummary } = await supabase
    .from('weekly_summaries')
    .select('summary, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const active = (resolutions ?? []).filter((r: any) => r.status === 'active')
  const archived = (resolutions ?? []).filter((r: any) => r.status !== 'active')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Resolutions</h1>
        <Button asChild>
          <Link href="/resolutions/new">+ Add Resolution</Link>
        </Button>
      </div>

      {profile && (
        <ReminderBanners
          resolutions={active}
          frequency={profile.check_in_frequency}
        />
      )}

      {weeklySummary && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700">
              Weekly Summary — {new Date(weeklySummary.created_at).toLocaleDateString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 whitespace-pre-line">{weeklySummary.summary}</p>
          </CardContent>
        </Card>
      )}

      {active.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-4">No active resolutions yet.</p>
          <Button asChild variant="outline">
            <Link href="/resolutions/new">Create your first resolution</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((r: any) => <ResolutionCard key={r.id} resolution={r} />)}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Archived</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {archived.map((r: any) => <ResolutionCard key={r.id} resolution={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Add the Supabase RPC function**

In Supabase SQL Editor, run:

```sql
-- Add weekly_summaries table (needed for dashboard)
CREATE TABLE weekly_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_summaries_self" ON weekly_summaries
  FOR ALL USING (auth.uid() = user_id);

-- RPC: resolutions with last log date and count
CREATE OR REPLACE FUNCTION get_resolutions_with_log_meta(p_user_id UUID)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, description TEXT, category TEXT,
  ai_framing TEXT, target_date DATE, status TEXT, created_at TIMESTAMPTZ,
  last_log_at TIMESTAMPTZ, log_count BIGINT
) AS $$
  SELECT
    r.*,
    MAX(pl.created_at) AS last_log_at,
    COUNT(pl.id) AS log_count
  FROM resolutions r
  LEFT JOIN progress_logs pl ON pl.resolution_id = r.id
  WHERE r.user_id = p_user_id
  GROUP BY r.id
  ORDER BY r.created_at DESC
$$ LANGUAGE sql SECURITY DEFINER;
```

Also add `weekly_summaries.sql` to migrations:

```bash
cat > supabase/migrations/002_weekly_summaries.sql << 'EOF'
-- (paste the SQL above)
EOF
```

**Step 5: Build check**

```bash
npm run build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/app/(app)/dashboard/ src/components/reminder-banner.tsx \
  src/components/resolution-card.tsx supabase/migrations/002_weekly_summaries.sql
git commit -m "feat: add dashboard with reminder banners and resolution cards"
```

---

## Task 11: Resolution Creation Page

**Files:**
- Create: `src/app/(app)/resolutions/new/page.tsx`

**Step 1: Create `src/app/(app)/resolutions/new/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { createResolution } from '@/actions/resolutions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewResolutionPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createResolution(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Resolution</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-500 font-normal">
            AI will suggest a category and motivational framing automatically.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Resolution</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Run a 5K by summer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Why does this matter to you? <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                placeholder="More context helps AI give better feedback..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">
                Target date <span className="text-gray-400">(optional)</span>
              </Label>
              <Input id="target_date" name="target_date" type="date" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Resolution'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(app)/resolutions/new/page.tsx
git commit -m "feat: add resolution creation page"
```

---

## Task 12: Resolution Detail Page

**Files:**
- Create: `src/app/(app)/resolutions/[id]/page.tsx`
- Create: `src/components/log-form.tsx`
- Create: `src/components/log-entry.tsx`

**Step 1: Create `src/components/log-form.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { createProgressLog } from '@/actions/progress-logs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Props {
  resolutionId: string
}

export function LogForm({ resolutionId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createProgressLog(formData)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="resolution_id" value={resolutionId} />
      <div className="space-y-2">
        <Label htmlFor="note">Log an update</Label>
        <Textarea
          id="note"
          name="note"
          placeholder="What happened? How did it go?"
          rows={3}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving & analyzing...' : 'Save update'}
      </Button>
    </form>
  )
}
```

**Step 2: Create `src/components/log-entry.tsx`**

```typescript
import type { ProgressLog } from '@/types/database'

const SENTIMENT_STYLES = {
  positive: 'text-green-700 bg-green-50 border-green-200',
  neutral: 'text-gray-700 bg-gray-50 border-gray-200',
  negative: 'text-red-700 bg-red-50 border-red-200',
}

const SENTIMENT_ICONS = { positive: '↑', neutral: '→', negative: '↓' }

interface Props {
  log: ProgressLog
}

export function LogEntry({ log }: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{new Date(log.created_at).toLocaleDateString()}</p>
        {log.ai_sentiment && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SENTIMENT_STYLES[log.ai_sentiment]}`}>
            {SENTIMENT_ICONS[log.ai_sentiment]} {log.ai_sentiment}
            {log.ai_progress_estimate !== null && ` · ${log.ai_progress_estimate}%`}
          </span>
        )}
      </div>
      <p className="text-sm">{log.note}</p>
      {log.ai_feedback && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
          {log.ai_feedback}
        </p>
      )}
    </div>
  )
}
```

**Step 3: Create `src/app/(app)/resolutions/[id]/page.tsx`**

```typescript
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogForm } from '@/components/log-form'
import { LogEntry } from '@/components/log-entry'
import { updateResolutionStatus } from '@/actions/resolutions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResolutionPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: resolution }, { data: logs }] = await Promise.all([
    supabase.from('resolutions').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('progress_logs').select('*').eq('resolution_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!resolution) notFound()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold">{resolution.title}</h1>
          <Badge variant={resolution.status === 'active' ? 'default' : 'secondary'}>
            {resolution.status}
          </Badge>
        </div>
        {resolution.ai_framing && (
          <p className="text-gray-500 text-sm mb-2">{resolution.ai_framing}</p>
        )}
        {resolution.description && (
          <p className="text-gray-700 text-sm">{resolution.description}</p>
        )}
        <div className="flex gap-2 mt-3">
          {resolution.status === 'active' ? (
            <form action={async () => { 'use server'; await updateResolutionStatus(id, 'archived') }}>
              <Button variant="outline" size="sm" type="submit">Archive</Button>
            </form>
          ) : (
            <form action={async () => { 'use server'; await updateResolutionStatus(id, 'active') }}>
              <Button variant="outline" size="sm" type="submit">Restore</Button>
            </form>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      {resolution.status === 'active' && (
        <div className="mb-8">
          <LogForm resolutionId={id} />
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-gray-500">
          {logs?.length ?? 0} {logs?.length === 1 ? 'update' : 'updates'}
        </h2>
        {(logs ?? []).map((log) => <LogEntry key={log.id} log={log} />)}
      </div>
    </div>
  )
}
```

**Step 4: Build check**

```bash
npm run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/(app)/resolutions/ src/components/log-form.tsx src/components/log-entry.tsx
git commit -m "feat: add resolution detail page with progress log form and history"
```

---

## Task 13: Settings Page

**Files:**
- Create: `src/actions/settings.ts`
- Create: `src/app/(app)/settings/page.tsx`

**Step 1: Create `src/actions/settings.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('profiles').update({
    check_in_frequency: formData.get('check_in_frequency') as string,
    email_checkins_enabled: formData.get('email_checkins_enabled') === 'on',
    email_summary_enabled: formData.get('email_summary_enabled') === 'on',
  }).eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
}
```

**Step 2: Create `src/app/(app)/settings/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateSettings } from '@/actions/settings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Check-in Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="check_in_frequency">Reminder frequency</Label>
              <select
                name="check_in_frequency"
                defaultValue={profile.check_in_frequency}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="daily">Daily</option>
                <option value="every_3_days">Every 3 days</option>
                <option value="weekly">Weekly</option>
              </select>
              <p className="text-xs text-gray-500">
                How often to show in-app reminders for unlogged resolutions
              </p>
            </div>

            <div className="space-y-3">
              <Label>Email notifications</Label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="email_checkins_enabled"
                  defaultChecked={profile.email_checkins_enabled}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Check-in nudges</p>
                  <p className="text-xs text-gray-500">Mon & Thu emails for unlogged resolutions</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="email_summary_enabled"
                  defaultChecked={profile.email_summary_enabled}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Weekly summary</p>
                  <p className="text-xs text-gray-500">Sunday evening AI-generated week in review</p>
                </div>
              </label>
            </div>

            <Button type="submit" className="w-full">Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/actions/settings.ts src/app/(app)/settings/page.tsx
git commit -m "feat: add settings page for check-in frequency and email preferences"
```

---

## Task 14: Resend Email Utilities

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/lib/__tests__/email.test.ts`

**Step 1: Write failing tests**

Create `src/lib/__tests__/email.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCheckinEmail, buildSummaryEmail } from '@/lib/email'

describe('buildCheckinEmail', () => {
  it('includes all overdue resolution titles', () => {
    const result = buildCheckinEmail({
      userName: 'Alice',
      overdueResolutions: [
        { id: 'abc', title: 'Run a 5K', daysSinceLog: 5 },
        { id: 'def', title: 'Read 12 books', daysSinceLog: 10 },
      ],
      appUrl: 'https://example.com',
    })
    expect(result.text).toContain('Run a 5K')
    expect(result.text).toContain('Read 12 books')
    expect(result.text).toContain('5 days')
    expect(result.subject).toContain('check in')
  })

  it('returns empty subject and text when no overdue resolutions', () => {
    const result = buildCheckinEmail({
      userName: 'Alice',
      overdueResolutions: [],
      appUrl: 'https://example.com',
    })
    expect(result.text).toBe('')
  })
})

describe('buildSummaryEmail', () => {
  it('includes the summary text and user name', () => {
    const result = buildSummaryEmail({
      userName: 'Bob',
      summary: 'Great week overall.',
      appUrl: 'https://example.com',
    })
    expect(result.text).toContain('Great week overall.')
    expect(result.subject).toBeTruthy()
  })
})
```

**Step 2: Run to verify failure**

```bash
npm test
```

Expected: FAIL — "Cannot find module '@/lib/email'"

**Step 3: Create `src/lib/email.ts`**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface CheckinEmailParams {
  userName: string | null
  overdueResolutions: Array<{ id: string; title: string; daysSinceLog: number }>
  appUrl: string
}

interface SummaryEmailParams {
  userName: string | null
  summary: string
  appUrl: string
}

export function buildCheckinEmail(params: CheckinEmailParams): { subject: string; text: string } {
  if (params.overdueResolutions.length === 0) return { subject: '', text: '' }

  const name = params.userName ?? 'there'
  const lines = params.overdueResolutions
    .map((r) => `• ${r.title} (${r.daysSinceLog} days since last log)\n  ${params.appUrl}/resolutions/${r.id}`)
    .join('\n\n')

  return {
    subject: `Time to check in on your resolutions`,
    text: `Hi ${name},\n\nYou haven't logged progress on these resolutions recently:\n\n${lines}\n\nKeep going — small consistent updates add up.\n\n${params.appUrl}/dashboard`,
  }
}

export function buildSummaryEmail(params: SummaryEmailParams): { subject: string; text: string } {
  const name = params.userName ?? 'there'
  return {
    subject: `Your weekly resolution summary`,
    text: `Hi ${name},\n\nHere's your week in review:\n\n${params.summary}\n\n${params.appUrl}/dashboard`,
  }
}

export async function sendEmail(params: {
  to: string
  subject: string
  text: string
}) {
  await resend.emails.send({
    from: 'Resolutions <noreply@yourdomain.com>',  // Update with your verified domain
    to: params.to,
    subject: params.subject,
    text: params.text,
  })
}
```

> **Note:** Update the `from` address with your Resend-verified domain before deploying.

**Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/__tests__/email.test.ts
git commit -m "feat: add email utilities with unit tests"
```

---

## Task 15: Cron API Routes

**Files:**
- Create: `src/app/api/cron/check-in/route.ts`
- Create: `src/app/api/cron/weekly-summary/route.ts`
- Create: `vercel.json`

**Step 1: Create `src/app/api/cron/check-in/route.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { needsReminder } from '@/lib/reminders'
import { buildCheckinEmail, sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.vercel.app'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Use service role for cron jobs (bypass RLS to read all users)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, check_in_frequency, email_checkins_enabled')
    .eq('email_checkins_enabled', true)

  if (!profiles) return Response.json({ sent: 0 })

  let sent = 0

  for (const profile of profiles) {
    const { data: resolutions } = await supabase
      .from('resolutions')
      .select('id, title')
      .eq('user_id', profile.id)
      .eq('status', 'active')

    if (!resolutions?.length) continue

    // Get last log date per resolution
    const overdueResolutions: Array<{ id: string; title: string; daysSinceLog: number }> = []

    for (const resolution of resolutions) {
      const { data: lastLog } = await supabase
        .from('progress_logs')
        .select('created_at')
        .eq('resolution_id', resolution.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastLogDate = lastLog ? new Date(lastLog.created_at) : null
      if (needsReminder(lastLogDate, profile.check_in_frequency)) {
        const daysSinceLog = lastLogDate
          ? Math.floor((Date.now() - lastLogDate.getTime()) / 86400000)
          : 999
        overdueResolutions.push({ id: resolution.id, title: resolution.title, daysSinceLog })
      }
    }

    if (overdueResolutions.length === 0) continue

    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
    if (!authUser.user?.email) continue

    const { subject, text } = buildCheckinEmail({
      userName: profile.name,
      overdueResolutions,
      appUrl: APP_URL,
    })

    try {
      await sendEmail({ to: authUser.user.email, subject, text })
      sent++
    } catch (e) {
      console.error(`Failed to send check-in to ${authUser.user.email}:`, e)
    }
  }

  return Response.json({ sent })
}
```

**Step 2: Create `src/app/api/cron/weekly-summary/route.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import { generateWeeklySummary } from '@/lib/ai'
import { buildSummaryEmail, sendEmail } from '@/lib/email'
import { startOfWeek } from 'date-fns'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.vercel.app'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email_summary_enabled')
    .eq('email_summary_enabled', true)

  if (!profiles) return Response.json({ processed: 0 })

  let processed = 0

  for (const profile of profiles) {
    const { data: logs } = await supabase
      .from('progress_logs')
      .select('note, ai_sentiment, created_at, resolutions(title)')
      .eq('user_id', profile.id)
      .gte('created_at', weekStart)
      .order('created_at', { ascending: true })

    if (!logs?.length) continue

    const formattedLogs = logs.map((l: any) => ({
      resolution_title: l.resolutions?.title ?? 'Unknown',
      note: l.note,
      ai_sentiment: l.ai_sentiment,
      created_at: l.created_at,
    }))

    try {
      const summary = await generateWeeklySummary({ userName: profile.name, logs: formattedLogs })
      if (!summary) continue

      // Save to DB for dashboard display
      await supabase.from('weekly_summaries').insert({ user_id: profile.id, summary })

      // Send email
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
      if (authUser.user?.email) {
        const { subject, text } = buildSummaryEmail({ userName: profile.name, summary, appUrl: APP_URL })
        await sendEmail({ to: authUser.user.email, subject, text })
      }

      processed++
    } catch (e) {
      console.error(`Failed to generate summary for ${profile.id}:`, e)
    }
  }

  return Response.json({ processed })
}
```

**Step 3: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-in",
      "schedule": "0 9 * * 1,4"
    },
    {
      "path": "/api/cron/weekly-summary",
      "schedule": "0 20 * * 0"
    }
  ]
}
```

**Step 4: Add `NEXT_PUBLIC_APP_URL` to `.env.local`**

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

(Update to your Vercel URL after deployment.)

**Step 5: Final build check**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

**Step 6: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

**Step 7: Commit**

```bash
git add src/app/api/cron/ vercel.json
git commit -m "feat: add Vercel cron jobs for check-in nudges and weekly AI summary"
```

---

## Task 16: Deployment

**Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/ai-resolution.git
git push -u origin main
```

**Step 2: Deploy to Vercel**

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select the `ai-resolution` repo
3. Add all environment variables from `.env.local` (plus `NEXT_PUBLIC_APP_URL` set to the Vercel domain)
4. Deploy

**Step 3: Verify cron authorization**

Vercel automatically sends the `Authorization: Bearer <CRON_SECRET>` header to cron routes. Verify in Vercel dashboard → Project → Cron Jobs after first trigger.

**Step 4: Test the full flow**

1. Sign up for an account
2. Create a resolution — AI should suggest a category
3. Log a progress update — AI should return sentiment + feedback within a few seconds
4. Check `/settings` — update frequency, toggle emails
5. Check `/dashboard` — weekly summary card appears after Sunday cron runs

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Next.js scaffold + Vitest |
| 2 | Supabase schema + RLS |
| 3 | Supabase client + middleware |
| 4 | Auth pages (login/signup) |
| 5 | TypeScript types |
| 6 | Gemini AI utilities + tests |
| 7 | Resolution actions + reminder logic + tests |
| 8 | Progress log action with AI enrichment |
| 9 | App layout + nav |
| 10 | Dashboard with banners |
| 11 | Resolution creation page |
| 12 | Resolution detail + log form |
| 13 | Settings page |
| 14 | Email utilities + tests |
| 15 | Cron API routes |
| 16 | Deployment |
