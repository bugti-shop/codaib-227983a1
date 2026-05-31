

## Goal
Let users point their camera at a handwritten paper / sticky-note board, and have AI extract individual tasks from it (title + optional date/priority/folder), then add them to their task list.

## Recommended approach

**Capture** → `@capacitor/camera` (already installed) on mobile, file input fallback on web. Compress to ~1024px JPEG ~80% quality before upload (keeps cost/latency low).

**Extract** → Single edge function `ai-extract-tasks-from-image` that sends the image to **Lovable AI Gateway** with `google/gemini-3-flash-preview` (vision-capable, fast, cheap). Use tool-calling to return a structured array of tasks — same shape as `ai-parse-task` but plural.

**Review UI** → New `ImageTaskExtractorSheet` shows the captured image + extracted tasks as editable checklist. User unchecks anything wrong, taps "Add N tasks". Tasks flow through existing add-task pipeline.

**Gating** → Pro-only, same `requireFeature('ai_dictation')` pattern (or a new `ai_vision` flag). Free users see the entry point but tap → soft paywall.

**Entry point** → New camera/scan icon in the FAB area on Today/Upcoming pages, plus inside `TaskInputSheet` next to the existing AI mic.

## Cost & technology comparison

| Option | Quality | Cost per scan | Speed | Notes |
|---|---|---|---|---|
| **Gemini 3 Flash (recommended)** | Excellent OCR + reasoning (sticky notes, handwriting, layout) | Very low — ~$0.0003-0.001 per image via Lovable AI | 1-3s | One-shot: OCR + parse + structure. No extra setup. |
| Gemini 2.5 Flash Lite | Good for printed text, weaker on messy handwriting | Cheapest | <1s | Risky for sticky-note handwriting |
| GPT-5 Mini vision | Excellent, slightly better on cursive | Higher cost | 2-4s | Same Lovable AI gateway |
| Tesseract.js (on-device OCR) | Poor on handwriting, no semantic parsing | Free | Slow on mobile | Would need a 2nd AI call to structure → no win |
| Google Cloud Vision API | Great OCR but raw text only | Requires separate API key + billing | Fast | Still need 2nd AI call to extract tasks |

**Verdict**: Gemini 3 Flash via Lovable AI is the clear winner — single call does OCR + task extraction + structuring, no extra API keys, leverages existing `LOVABLE_API_KEY`.

## Cost protection
- Compress image client-side before upload (cuts tokens ~5x)
- Pro-only gating prevents abuse
- Optional: soft cap of 30 scans/day per user (stored in localStorage), bypassable for power users
- Surface 429/402 errors as friendly toasts (same pattern as `ai-parse-task`)

## Files to add / change

**New**
- `supabase/functions/ai-extract-tasks-from-image/index.ts` — vision edge function with `extract_tasks` tool returning `{ tasks: [{title, dueDateIso?, deadlineIso?, priority, folderId?, sectionId?, repeatType}] }`
- `src/components/ImageTaskExtractorSheet.tsx` — capture UI, preview, editable extracted task list, "Add all" button
- `src/utils/imageCaptureForAI.ts` — wraps `@capacitor/camera` + web fallback, returns compressed base64

**Edit**
- `src/components/TaskInputSheet.tsx` — add 📷 button next to the AI mic that opens the new sheet
- `src/contexts/SubscriptionContext.tsx` — add `ai_vision` feature flag (or reuse `ai_dictation`)
- `src/pages/todo/Today.tsx` & `Upcoming.tsx` — optional: add a small "Scan paper" entry in the FAB long-press menu

## UX flow
1. User taps 📷 in TaskInputSheet → camera opens
2. User snaps the paper / sticky-note board
3. Sheet shows preview + spinner "Reading your tasks…"
4. ~2s later: list of extracted tasks as checkboxes (all checked by default), each with inferred date/priority chip
5. User unchecks junk, edits any title inline, taps "Add 5 tasks"
6. All tasks created in current folder/section (or the AI-detected one if user spoke a folder name on the paper)

<lov-actions>
<lov-suggestion message="Looks good — implement it as planned with Gemini 3 Flash, Pro-gated, with the 📷 button inside TaskInputSheet and a review sheet before adding.">Build it as planned</lov-suggestion>
<lov-suggestion message="Build it but skip the review sheet — auto-add all detected tasks immediately for a faster flow, and show a single 'Added 5 tasks · Undo' toast.">Auto-add without review</lov-suggestion>
<lov-suggestion message="Build it as planned but also add a daily scan limit (e.g. 5/day for free users with paywall after, unlimited for Pro) instead of fully Pro-gating it.">Free with daily limit</lov-suggestion>
<lov-suggestion message="Also support extracting tasks from an existing photo in the gallery (not just live camera) so users can scan whiteboard photos they already took.">Add gallery import too</lov-suggestion>
</lov-actions>
