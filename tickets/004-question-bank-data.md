# 004: Open-ended question bank: seed data

## Goal

Own free-text questions for the cash builder and final round (typed answers), since opentdb is multiple-choice only.

## Scope

- New `server/data/questions.json` with **at least 40 questions** across ≥3 categories (e.g. science, geography, history, general).
- Format (one shape per question):
  ```json
  { "id": 1, "category": "science", "question": "...", "answer": "..." }
  ```
- Answers must be a single unambiguous string (capitalize normally; strict matching is a later decision, don't add aliases yet).
- Keep every question brief enough to type an answer in a few seconds.

## Acceptance

- File is valid JSON: `node -e "const d=require('./server/data/questions.json'); if(d.questions.length<40) throw new Error('too few'); console.log('ok', d.questions.length)"` (works from repo root).
- ≥40 entries, ≥3 distinct categories.

## Dependencies

None.