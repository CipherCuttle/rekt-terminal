# REKT mascot artwork

`rekt-mascot.png` is the exact original supplied by the user on 2026-09-09:
`31f2f2c6-06cd-4821-8463-f2974b041249.png`.

SHA-256: `a487ddab6f6e877b8a4663b9bf758043a6e45a22716c1241c5d385aff40453c5`.

The pixels have not been generated, edited, recolored, or cropped. The UI centers
the complete silhouette within a black recessed mount using CSS. Preserve the
violet core, white eyes, cyan/orange micro-accents and right-side appendage.

Consumer: `src/instrument-v2/RektMascot.tsx`. Public URL respects Vite's base:
`assets/rekt-mascot.png`. The seam currently accepts `state="idle"` only, with
`size="standard"` or `size="compact"`. No live state is available to this caller.
Asset failure renders neutral text; it never loads substitute creature art.

Do not restore the rejected swordfish, generate a fish-shaped successor, or invent
mascot lore. No external service is required to render this asset.
