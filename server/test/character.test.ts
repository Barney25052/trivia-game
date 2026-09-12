import assert from "assert";
import {
    decodeCharacter,
    encodeCharacter,
    isValidCharacter,
    randomCharacter
} from "../src/character.js";
import { CHARACTER } from "../src/gameConfig.js";

describe("character codec", () => {
    it("encodes a character into a 5-digit string", () => {
        assert.strictEqual(
            encodeCharacter({
                hairStyle: 1,
                hairColour: 0,
                faceStyle: 2,
                faceColour: 3,
                shirtColour: 4
            }),
            "10234"
        );
    });

    it("decodes a valid code back into its fields", () => {
        assert.deepStrictEqual(decodeCharacter("10234"), {
            hairStyle: 1,
            hairColour: 0,
            faceStyle: 2,
            faceColour: 3,
            shirtColour: 4
        });
    });

    it("rejects malformed or out-of-range codes", () => {
        const invalid = [
            "",
            "1234",
            "123456",
            "abcde",
            "1.234",
            null,
            undefined,
            12345,
            "50000", // hairStyle out of range (max index 4)
            "01300", // faceStyle out of range (max index 2)
            "00009" // shirtColour out of range (max index 8)
        ];
        for (const code of invalid) {
            assert.strictEqual(isValidCharacter(code), false, `expected ${JSON.stringify(code)} to be invalid`);
            assert.strictEqual(decodeCharacter(code as string), null);
        }
    });

    it("randomCharacter always produces a valid, in-range code", () => {
        for (let i = 0; i < 200; i += 1) {
            const code = randomCharacter();
            assert.strictEqual(isValidCharacter(code), true, `expected ${code} to be valid`);
            const decoded = decodeCharacter(code)!;
            assert.ok(decoded.hairStyle < CHARACTER.hairStyles);
            assert.ok(decoded.hairColour < CHARACTER.colours);
            assert.ok(decoded.faceStyle < CHARACTER.faceStyles);
            assert.ok(decoded.faceColour < CHARACTER.colours);
            assert.ok(decoded.shirtColour < CHARACTER.colours);
        }
    });
});
