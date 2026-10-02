# Data Swamp enemy models

Seven Blender-authored dinosaurs replace the procedural wildlife in normal play.
`blender/DataSwamp_Enemies.blend` contains the editable collection; `previews/`
contains studio renders. Game-ready GLBs are in `public/models/enemies/`.

The start and pause menus link to the model room: View Jerry, View enemies, and
View weapons. The room uses the same assets as gameplay and provides orbit,
zoom, fixed camera views, auto rotation, creature animation, and wireframe.
Categories can also be opened directly with `?view=jerry`, `?view=enemies`, or
`?view=weapons`, including under the deployed `/swamp/` path.

## Authoring

MCP for Blender 2.1.3 was installed in the repository's ignored
`.blender-mcp-venv` environment and registered globally with Codex as `blender`.
The add-on is enabled in Blender 5.2. Telemetry is disabled. New Codex sessions
may require an app restart to discover the newly registered MCP tools.

To rebuild with Blender open and its MCP server running, from the repository root:

```sh
.blender-mcp-venv/bin/python DataSwamp/tools/blender_mcp_client.py DataSwamp/art/blender/build_enemies.py
.blender-mcp-venv/bin/python DataSwamp/tools/blender_mcp_client.py DataSwamp/art/blender/render_enemies.py
```

The build script replaces its own named scene only. It exports models before
arranging the source collection, so lineup offsets cannot enter the game assets.
The renderer saves a studio view for each species. The script root currently
points at the local DataSwamp checkout; update it if moving the project.

## Runtime contract

Models face +X with +Y up after glTF conversion. Named metadata identifies Body,
Head, Tail, and Leg0–Leg3 pivots; the head carries its local muzzle coordinates.
Pteranodon wings occupy Leg0 and Leg1 for the existing wingbeat animation.
Geometry and embedded normal textures are shared; per-instance materials allow
independent hit flashes. Materials are disposed when an enemy is removed.

All enemy assets load during the opening screen. An unavailable model uses the
original procedural version and displays a loading warning. No changes were
made to enemy health, damage, attack timing, or wave composition.

Run `npm test` and `npm run build` from DataSwamp. The tests load all seven real
GLBs and check pivots, geometry sharing, material isolation, world bounds,
muzzle attachments, and the spawn/animation/damage/death lifecycle. Browser
checks cover image decoding and the model-room controls.
