import { ROOM_CODE } from "./gameConfig.js";

/** A short, shareable room code: ROOM_CODE.length letters from
 * ROOM_CODE.alphabet, skipping any code `isTaken` says is already live.
 * After ROOM_CODE.maxAttemptsPerLength collisions at one length it tries one
 * letter longer, so it always terminates. */
export function generateRoomCode(isTaken: (code: string) => boolean, random: () => number = Math.random): string {
    for (let length = ROOM_CODE.length; ; length += 1) {
        for (let attempt = 0; attempt < ROOM_CODE.maxAttemptsPerLength; attempt += 1) {
            let code = "";
            for (let i = 0; i < length; i += 1) {
                code += ROOM_CODE.alphabet[Math.floor(random() * ROOM_CODE.alphabet.length)];
            }
            if (!isTaken(code)) {
                return code;
            }
        }
    }
}
