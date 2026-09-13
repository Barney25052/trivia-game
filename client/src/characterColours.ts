/** Colour→CSS map for the contestant character system (ticket 102; tint
 * technique replaced in ticket 108 — see below).
 *
 * Colour model: the character art (hair/face layers) is drawn once in
 * greyscale and recoloured at render time, rather than shipping 9
 * pre-coloured copies of every layer. `hairColour`/`faceColour`/
 * `shirtColour` (see `character.ts`) all index into this SAME 9-entry array —
 * one shared palette across all three channels.
 * ⚠ Judgment call (ticket 102 flagged this as "confirm at implementation",
 * no one to confirm with overnight): a single shared palette was assumed
 * rather than separate palettes per channel. Revisit if hair/skin/shirt end
 * up wanting different hue ranges.
 *
 * Tint technique (ticket 108): ticket 102's original approach ran a CSS
 * `filter` recipe (grayscale → sepia → hue-rotate → saturate/brightness) over
 * each `<img>` layer. `sepia(1)` injects a fixed, fairly desaturated sepia
 * hue as the base for `hue-rotate` to shift — even at high `saturate()`
 * multipliers that base clamps how vivid the result can read, so the tint
 * came through as a faint wash rather than a clear, identifiable colour
 * (user report, see ticket 108). `CharacterFace.vue` now recolours hair/face
 * with a colour overlay instead: each layer's `<img>` becomes a `<div>` with
 * a `background-color` (the target colour) blended against a
 * `background-image` (the actual artwork) via `background-blend-mode:
 * multiply`. `mask-image` (set to the same artwork URL, which defaults to
 * using its alpha channel as the mask) clips the div back down to the art's
 * silhouette, since the flat background-color would otherwise paint the
 * whole rectangular box.
 *
 * `multiply` (over the alternative `color`, tried first) was picked after
 * sampling today's placeholder art directly: every visible pixel in
 * face-*.png/hair-*.png is either fully white or fully transparent — a flat
 * silhouette with no shading at all. `background-blend-mode: color` keeps
 * the backdrop's *luminance* and replaces only hue/saturation, but at 100%
 * white luminance there is no headroom left to express any saturation, so
 * every colour blended straight back to white (the exact "faint wash" bug
 * this ticket is fixing, just relocated). `multiply` instead darkens
 * proportionally to the art's own value: white * colour = colour exactly, so
 * today's flat-white art reads as the full, undiluted target colour. It also
 * still does the sensible thing once real *shaded* greyscale art lands —
 * white stays full colour, greys darken proportionally into a natural
 * shadow in the same hue, black stays black — rather than flattening the
 * layer to one flat solid colour the way a silhouette-fill recolour trick
 * would (which would look wrong as soon as the art has real shading). The
 * plain `characterColourVar` below supplies the flat colour for both that
 * overlay and the flat-shape shoulders/torso placeholder. */

export const CHARACTER_COLOUR_COUNT = 9;

/** CSS `var(...)` reference for a palette index — used both for the
 * hair/face colour-overlay tint and for flat-colour shapes (e.g. the
 * shoulders/torso placeholder) that don't need image recolouring. Index-
 * matched to the `--character-colour-N` custom properties in style.css —
 * keep both in the same order. */
export function characterColourVar(colourIndex: number): string {
    const clamped = colourIndex >= 0 && colourIndex < CHARACTER_COLOUR_COUNT ? colourIndex : 0;
    return `var(--character-colour-${clamped})`;
}
