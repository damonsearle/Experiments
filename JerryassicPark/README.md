# Jerryassic Park: Data Breach

A playable 2.5D browser platformer starring the shared Revision 6 Jerry model. Recover five data cores from the overgrown research facility, then outrun the T. rex to the recovery uplink.

## Play locally

```sh
cd JerryassicPark
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm test` checks the simulation; `npm run build` creates a standalone `dist/` folder; `npm run preview` serves that build. The repository's Pages workflow builds this game under `/jerryassic/` on a subsequent deployment. Nothing needs a backend or account.

## Controls

| Action | Keyboard | Standard controller | Touch |
| --- | --- | --- | --- |
| Move | A/D or left/right arrows | Left stick or D-pad | Arrow buttons |
| Jump / stomp | Space, W, or up arrow | A / bottom face button | Up button |
| Rewind | Hold R | Hold left trigger | Hold rewind button |
| Pause | Esc or P | Start | Pause button |

Land on raptors to defeat them. Rewind restores up to three seconds of Jerry's position, health, enemies, pickups, checkpoints and the T. rex. Available rewind time builds as you play and recharges after use. A fall has a brief rewind rescue window. Checkpoints after cores two and four restore health; retrying preserves recovered data. After collecting the fifth core, landing beyond the final platform starts a five-second encounter: Jerry faces the T. rex, ducks through its legs, and the rex turns before the chase begins. The scene pauses and rewinds with the game. The title screen’s Preview T. Rex Encounter button jumps straight to this sequence and then hands over control for the escape. All five cores are required to exit. Progress lasts for the current run, not across page reloads.

## Assets and structure

- `src/game.js`: deterministic 60 Hz simulation and rewind snapshots, independent of Three.js.
- `src/world.js`: procedural jungle, platforms, facility, lighting accents and collectibles. Static scenery is batched by material.
- `src/main.js`: rendering, Jerry animation, keyboard/controller/touch input, game screens and audio events.
- `src/audio.js`: synthesized sound effects; no external audio requests.
- `test/game.test.js`: physics, rewind, checkpoints, hazards and complete-route coverage.
- Jerry is imported from `../shared/jerry/jerry.js` and its existing rigged GLB. Source Blender files are unchanged.
- The raptor-like compy is reused from Data Swamp. The T. rex is an original rigged Blender model in `art/blender/Tyrannosaurus_Rex.blend`, exported to `public/models/tyrannosaurus-rex.glb` (4 MB).
- Open `/rex.html` for an interactive creature viewer with walking, jaw and camera controls. `src/rex.js` is shared by the viewer and game. Reference notes are in `art/rex/README.md`.
- `public/art/jerry-portrait.png` comes from the supplied Jerry reference; `art/gameplay-concept.png` is the approved image-generated visual reference.

This is a first playable prototype with procedural scenery, not a pixel-perfect recreation of the illustrated mockup. The existing full-detail Jerry asset is about 29 MB, so the initial load is larger than an optimized production game. A modern WebGL2 browser is required. Keyboard/browser behavior is smoke-tested; physical controller and touch-device feel need device testing.
