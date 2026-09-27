// Every image the app ships, gathered by glob instead of a hand-kept list —
// the old list had drifted (Maggie's portrait and the Home logo were missing
// from it). The `?inline` query matches how every component imports these,
// so this yields the exact same data URLs the screens render.
const IMAGE_SOURCES = Object.values(
    import.meta.glob(["./assets/images/**/*.png", "../images/*.png"], {
        eager: true,
        query: "?inline",
        import: "default"
    })
);

// Decoded Image objects are kept referenced for the whole session so the
// browser keeps their decoded bitmaps around — a face or portrait mounting
// later (e.g. TeamFinalScreen's whole player row at once) then paints in the
// same frame instead of waiting on a first decode.
const retainedImages = [];

// Memoized across every caller (ticket 109): App.vue's fire-and-forget call
// at module scope and any later caller (e.g. LobbyScreen gating its live
// preview) share the same settled promise instead of each decoding the batch
// again. Resolves (never rejects) even if one image fails, so a single bad
// asset can't hang every caller awaiting the batch.
let preloadPromise = null;

// The Home screen only uses Rubik, so the display and pixel fonts would
// otherwise only start downloading when the Lobby first needs them — and
// with font-display: block (index.html) their text stays invisible until
// they arrive. Asking for them at boot has them ready by the time anyone
// has typed a name and joined.
export function preloadFonts() {
    if (!document.fonts?.load) return;
    for (const family of ['"Luckiest Guy"', "VT323"]) {
        document.fonts.load(`1em ${family}`).catch(() => {});
    }
}

export function preloadImages() {
    if (!preloadPromise) {
        preloadPromise = Promise.all(
            IMAGE_SOURCES.map((src) => {
                const img = new Image();
                img.src = src;
                retainedImages.push(img);
                return img.decode().catch(() => {});
            })
        );
    }
    return preloadPromise;
}
