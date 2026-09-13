/** Colour→CSS-filter map for the contestant character system (ticket 102).
 *
 * Colour model: the character art (hair/face layers) is drawn once in
 * greyscale and recoloured at render time via a CSS `filter`, rather than
 * shipping 9 pre-coloured copies of every layer. `hairColour`/`faceColour`/
 * `shirtColour` (see `character.ts`) all index into this SAME 9-entry array —
 * one shared palette across all three channels.
 * ⚠ Judgment call (ticket 102 flagged this as "confirm at implementation",
 * no one to confirm with overnight): a single shared palette was assumed
 * rather than separate palettes per channel. Revisit if hair/skin/shirt end
 * up wanting different hue ranges.
 *
 * Each entry pairs a solid colour (for the CSS custom properties in
 * style.css, e.g. picker swatches and the flat-shape shoulders/torso
 * placeholder) with an approximate CSS `filter` recipe that pushes a
 * greyscale image toward that same hue. `hue-rotate` alone cannot recolour a
 * fully desaturated image (there's no hue to rotate), so the standard trick
 * is `sepia(1)` first — which injects a fixed sepia hue/chroma — then
 * `hue-rotate` shifts THAT hue toward the target, with `saturate`/
 * `brightness` trimming intensity and depth. These are hand-tuned
 * approximations against today's colour PLACEHOLDER art (see HUMAN_TASKS.md
 * — real greyscale art is still `todo`), not an exact colour conversion;
 * expect to retune the recipes once the real greyscale layers land. */

export const CHARACTER_COLOUR_COUNT = 9;

/** Index-matched to the `--character-colour-N` custom properties in
 * style.css — keep both lists in the same order. */
export const CHARACTER_COLOUR_FILTERS: readonly string[] = [
    "grayscale(1) brightness(0.4) contrast(1.15)", // 0 charcoal / near-black
    "grayscale(1) sepia(1) hue-rotate(-45deg) saturate(2.4) brightness(0.6)", // 1 brown
    "grayscale(1) sepia(1) hue-rotate(-20deg) saturate(1.8) brightness(1.05)", // 2 tan
    "grayscale(1) sepia(1) hue-rotate(0deg) saturate(3.2) brightness(1.15)", // 3 blonde / gold
    "grayscale(1) sepia(1) hue-rotate(-50deg) saturate(6) brightness(0.9)", // 4 red
    "grayscale(1) brightness(0.85) contrast(0.85)", // 5 grey
    "grayscale(1) sepia(1) hue-rotate(170deg) saturate(3.5) brightness(0.85)", // 6 blue
    "grayscale(1) sepia(1) hue-rotate(60deg) saturate(2.6) brightness(0.75)", // 7 green
    "grayscale(1) sepia(1) hue-rotate(220deg) saturate(3.5) brightness(0.8)" // 8 purple
];

export function characterColourFilter(colourIndex: number): string {
    return CHARACTER_COLOUR_FILTERS[colourIndex] ?? CHARACTER_COLOUR_FILTERS[0];
}

/** CSS `var(...)` reference for the same index — for solid-colour shapes
 * (e.g. the shoulders/torso placeholder) that don't need image filtering. */
export function characterColourVar(colourIndex: number): string {
    const clamped = colourIndex >= 0 && colourIndex < CHARACTER_COLOUR_COUNT ? colourIndex : 0;
    return `var(--character-colour-${clamped})`;
}
