# 161: Answer checker accepts wrong numbers and near-identical names (`bug-024`)

## Goal
The open-answer checker (ticket 047's lenient single-edit policy) accepted different real answers as typos: any single digit for a one-digit answer ("6" for `["Five", "5"]`), "24" → "20"/"23"/"25", "1989" → "1988", "Louis XV" for "Louis XIV", "Manchester City" ↔ "Manchester United", "Serie B" for "Serie A", "Baseball" for "Basketball", and numbered sequels for originals ("Shrek 2" for "Shrek"). It affected live bank rows, e.g. id 815 (Infinity Stones, `["Six", "6", "Six Stones"]`) and id 853 ("1989"). A wrong number must never pass, and swapping a whole distinguishing word must fail, while genuine typos keep passing.

## Scope
- `server/src/questions/answerChecker.ts` — rewritten to compare answers **word by word** instead of as one joined string:
  - **Tokenising**: strip accents (NFKD) and apostrophes, lowercase, drop dots between letters ("U.N.", "E.T.") and thousands separators, then split letters from digits ("CO2" → co, 2). Every other character separates words, so spacing and punctuation never decide a match.
  - **Numbers** (digits, number words, Roman numerals) become canonical values and must be equal: "5" = "five" = "V", "6" ≠ "5". Compound and ordinal words are read ("One hundred forty-seven" = 147, "nineteenth" = 19th = 19, "7 million" = 7,000,000); leading zeros stay significant ("007" ≠ "7"). A number is never a typo of anything, and a Roman numeral cut out of letters typed without spaces can't have another numeral letter glued on ("ElizabethII" is not "Elizabeth I").
  - **Words** each get their own typo budget: 0.25 edits per letter of the shorter of the two words (at least one), with doubled letters free ("Scarlet Johanson"). Words under 4 letters may only lose a letter or swap two ("Teh", "Bo Marley"), never change one ("Serie B", "Cat"/"Bat"). Filler words are optional on either side but still forgive typos.
  - **Regrouping**: the typed and accepted words are aligned in order by a small DP that also allows several typed words against one accepted word ("Spider Man" / "Spiderman") and one or more typed words cut across several accepted words ("Spiderman" / "Spider-Man", "ACDC" / "AC/DC", "Re dSea" / "Red Sea"). The typing gets each accepted word's own budget, never one per piece, and never has more words than the accepted group, so an extra word can't be passed off as a typo.
- `server/src/questions/answerNumbers.ts` (new) — number-word table (cardinals, ordinals, four common misspellings like "fourty"), Roman numeral parsing, joined number words ("twentytwo"), run parsing, exact decimal scaling.
- `server/src/gameConfig.ts` — `ANSWER_CHECK` is now `{ caseInsensitive, minTypoWordLength: 4, typoEditsPerLetter: 0.25, ignoreDoubledLetters, romanNumerals, maxRegroupWords: 6, maxTypedLength: 200 }`. Removed `allowSingleEdit` and `editDistanceRatio` (replaced), and `normaliseWhitespace` (a no-op already: the old split on `/\s+/` always collapsed whitespace, and the new tokeniser has no whitespace step to toggle). `maxTypedLength` bounds the checker's work (worst case about 7 ms at the cap); longer answers are simply wrong.
- `GOAL.md` open question #2 — decision record amended.
- Not changed: `questions.json` content, the call sites, the `checkAnswer(playerAnswer, acceptedAnswers)` contract.

## Acceptance
- `cd server && npx tsx -e "import('./src/questions/answerChecker.ts').then(m => console.log(m.checkAnswer('6', ['Five', '5']), m.checkAnswer('Manchester City', ['Manchester United'])))"` prints `false false`.
- `cd server && npm test` green, including the new "ticket 161" blocks in `test/answerChecker.test.ts` (every case in `bug-024`, the typos that must still pass, filler/short-word/spacing/accent cases, the length cap) and `test/answerNumbers.test.ts`. The original 23 answer-checker tests pass unchanged.
- `npm run build` green in `server/` and `client/`.

## Outcome
- Bank-wide check against `questions.json` (1183 rows, 2040 accepted answers): every accepted answer still matches its own question. Pairs where one question's accepted answer was accepted for a *different* question fell from 705 to 156.
- Typo leniency is intact: of 23,399 synthetic single-letter typos (drop, swap or double one letter) of the bank's answers, the old checker accepted 23,304 and the new one accepts 23,329. The only typos it now rejects are ones that change a number: a numeral ("Henry VIII" typed for "Henry VII") or a misspelled number word ("Sixh", "One Hunred Years of Solitude", "Seven Spielberg"). That's deliberate: a typed number word can't be a typo of a plain word, or "Nine" would pass for "None".
- **Known limit**: two real answers within one genuine typo of each other still pass for each other, e.g. "Manet"/"Monet", "Iran"/"Iraq", "Mouse"/"House", "Slovenia"/"Slovakia" (most of the remaining 156 pairs). No spelling rule can tell "Manet" from the typo "Thanus" → "Thanos" without knowing which words are real answers; fixing that would need per-question data (e.g. a list of rejected near-misses), which is a question-bank schema change, left for a follow-up if wanted.
- Also accepted by design: "SerieB" typed without a space for "Serie A" (the "a" is filler, and "serieb" is one letter off "serie").
- Found, not fixed here (outside the checker): every typed-answer handler relays the raw answer text to the whole room with no length cap — logged as `bug-025`.

## Dependencies
None.
