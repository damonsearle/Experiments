# Shared Jerry

Both games import `jerry.js` here through their small local adapters. `Jerry_Game_Rev6.glb` is the single runtime asset; `Jerry_Character_Rev6.blend` is the editable Revision 6 source, with packed textures. This revision refines the beak, mouth, and glasses fit. No shell or shoulder straps are included. The original `Jerry_Game.glb` and `Jerry_Character.blend` are retained as Revision 5 backups.

The GLB has 91,544 triangles, 24 bones and embedded textures (~29 MB). The Blender source is ~28 MB. The browser downloads only the GLB. This is the full-detail model; a lower-detail/mobile export remains a future optimization.

`createJerry()` returns synchronous game controls and a `ready` promise. Call `update()` after adjusting controls, before rendering. The adapter maps the existing leg, arm, jaw, head, tail and propeller controls onto rest-relative bone rotations. The exported idle clip remains in the asset but is not played over gameplay controls. Each instance gets its own skeleton. Height defaults to 3.6 game units, soles at Y=0, facing +X.

Both Vite configs deduplicate Three.js and allow the shared directory during development. Vite packages the same GLB into each standalone build with the correct base URL. No symlinks, shared server, or root dependency install are required. The Pages workflow rebuilds both games when this directory changes.

To update Jerry, edit `Jerry_Character_Rev6.blend`, then export the Jerry meshes and armature as GLB over `Jerry_Game_Rev6.glb`, retaining bone names and embedded textures. Both games will use the new export. Keep studio cameras/lights/floor and hidden superseded geometry out of the export.

Build each game from its directory with `npm ci` and `npm run build`; preview with `npm run preview`. Loading status is displayed and starting play is blocked until the model is ready. Loading errors remain visible with a reload instruction.
