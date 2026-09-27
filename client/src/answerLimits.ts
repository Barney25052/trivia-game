// Mirrors server/src/gameConfig.ts ANSWER_CHECK.maxTypedLength (ticket 165)
// — duplicated client-side the same way GamePhase is (see AGENTS.md
// gotchas). The server refuses longer typed answers, so every answer box
// stops there.
export const MAX_TYPED_ANSWER_LENGTH = 200;
