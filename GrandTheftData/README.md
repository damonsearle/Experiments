# Data Dash

A Three.js infinite runner where a tiny dinosaur jumps over common data types before the queue overwhelms the system.

Play it at [damonsearle.github.io/Experiments](https://damonsearle.github.io/Experiments/).

## Run locally

```bash
npm install
npm run dev
```

Use Space, W, or Arrow Up to jump. Press P to pause. Touch and pointer controls are supported.

## Wetland scenery

The runner passes through layered forest, mossy shorelines, water channels,
lily pads, fallen timber, mushrooms, and overgrown server gateways. Near banks
scroll with the files; distant forest and hills move more slowly for depth.
Fireflies and water rings animate while the game is active.

`src/scenery.js` reuses Data Swamp's geometry helpers, textured stone platforms,
and timber decking. Decorative terrain remains outside the jumping lane and
is batched by material. Touch devices receive fewer plants and particles.
