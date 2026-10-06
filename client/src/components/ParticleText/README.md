# React Bits ParticleText

`ParticleText.jsx` is based on the JavaScript + Tailwind registry component:

- Documentation: https://reactbits.dev/text-animations/particle-text
- Registry: https://reactbits.dev/r/ParticleText-JS-TW.json
- Retrieved: 2026-09-28
- Original registry SHA-256: `26f3e1fa889ef83c452f313637a8d3378ea9161a4f18126996603de474ba8564`

The registry declares no dependencies or registry dependencies. The original
implementation was installed directly, then extended with optional props:
`initialSpread="viewport"` distributes those same text particles across the
whole canvas, `gatherDelay` holds them there before the standard gather
animation begins, `fieldDrift` moves them gently during the hold, and
`pauseAfterGather` stops idle canvas frames until the pointer returns.
`ambientStars` keeps a separate, restrained layer of stars in the sky after
the text forms, without taking particles away from the letters.
`starVariation` gives the text particles varied brightness. All additions
default to the registry behavior when omitted.

Rendering keeps the same particle targets, colors, sizes, glow, star counts,
and animation sequence. Each distinct glowing dot is rasterized once into a
sprite atlas, then reused instead of applying a shadow filter to every dot on
every frame. Drift directions are precomputed, follow motion uses elapsed time,
unchanged resize notifications do not resample the text, and animation frames
pause while the window is hidden. Authentication still prepares during startup;
the dashboard mounts at the exit so its effects do not compete with gathering.
The sprite atlas is drawn in one WebGL batch when available, with a cached
Canvas 2D fallback. GPU resources are released on unmount and rebuilt after a
restored graphics context.

Startup sequencing, local font preparation, responsive two-line composition,
and the static reduced-motion fallback live in `../DPCLoadingScreen.tsx`.
The wrapper allows roughly two seconds of scattered particles, then includes
gather duration, maximum stagger, and a 120ms settling allowance. After the
title forms, a warm guiding-light streak introduces the existing DPC logo; the composition
holds for 650ms before the 600ms exit. A resize restarts the sequence because
the component resamples the text. Slow fonts use a static title after two
seconds; a stalled auth request reveals the existing recovery UI after ten
seconds.

The many warm stars symbolize God's promise to Abraham (Genesis 15:5 and
22:17): many people gathering into one church community. The passages remain
an inspiration for the visual rather than on-screen copy.
