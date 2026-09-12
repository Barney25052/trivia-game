import { CHARACTER } from "./gameConfig.js";

/** Contestant avatar codec (ticket 101): a 5-digit string
 * `[hairStyle][hairColour][faceStyle][faceColour][shirtColour]`, each digit a
 * 0-based index into its own range. `"10234"` = hair style 1, hair colour 0,
 * face style 2, face colour 3, shirt colour 4. */
export interface Character {
    hairStyle: number;
    hairColour: number;
    faceStyle: number;
    faceColour: number;
    shirtColour: number;
}

export function encodeCharacter(character: Character): string {
    return (
        `${character.hairStyle}${character.hairColour}` +
        `${character.faceStyle}${character.faceColour}${character.shirtColour}`
    );
}

export function decodeCharacter(code: string): Character | null {
    if (!isValidCharacter(code)) {
        return null;
    }
    return {
        hairStyle: Number(code[0]),
        hairColour: Number(code[1]),
        faceStyle: Number(code[2]),
        faceColour: Number(code[3]),
        shirtColour: Number(code[4])
    };
}

export function isValidCharacter(code: unknown): code is string {
    if (typeof code !== "string" || !/^\d{5}$/.test(code)) {
        return false;
    }
    const hairStyle = Number(code[0]);
    const hairColour = Number(code[1]);
    const faceStyle = Number(code[2]);
    const faceColour = Number(code[3]);
    const shirtColour = Number(code[4]);
    return (
        hairStyle < CHARACTER.hairStyles &&
        hairColour < CHARACTER.colours &&
        faceStyle < CHARACTER.faceStyles &&
        faceColour < CHARACTER.colours &&
        shirtColour < CHARACTER.colours
    );
}

export function randomCharacter(): string {
    return encodeCharacter({
        hairStyle: Math.floor(Math.random() * CHARACTER.hairStyles),
        hairColour: Math.floor(Math.random() * CHARACTER.colours),
        faceStyle: Math.floor(Math.random() * CHARACTER.faceStyles),
        faceColour: Math.floor(Math.random() * CHARACTER.colours),
        shirtColour: Math.floor(Math.random() * CHARACTER.colours)
    });
}
