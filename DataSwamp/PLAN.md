# Jerry vs the Prehistoric Data Swamp

A third-person 3D arena shooter. Jerry — backup engineer, propeller beanie, glasses — is stranded
in a prehistoric swamp where the local wildlife attacks by hurling file formats at him. He fights
back with the only weapons he trusts: storage media, from floppy disks up to the cloud.

The joke underneath the mechanics: **the older the data, the more dangerous it is to carry, and the
more modern the storage, the harder it hits.** Enemies get deadlier as their file formats get more
complicated; Jerry gets deadlier as his storage gets more modern.

---

## 1. Scope

This is a bigger game than Data Dash — that was one input (jump) on rails. This has free movement,
aiming, an inventory, enemy AI and waves. The plan is staged so there is a playable thing early and
the content scales up afterwards.

**Ships in v1 (the target):** one swamp arena, free movement + jump + aim + shoot, 4 storage weapons,
3 enemy species, ammo pickups, 6 waves, a HUD, and a game-over/restart loop.

**Stretch, once v1 plays well:** the full 7 weapons, the full 7 species, the T-Rex boss, destructible
cover, a second arena.

Deliberately **not** in scope: multiplayer, save progression, a physics engine, loaded model assets
(everything stays procedural, as in Data Dash).

---

## 2. What carries over from Data Dash

The first game left behind a genuinely reusable creature-construction kit. This is the main reason
the new game is cheaper to build than it looks.

| Asset | Where it is now | Reuse |
|---|---|---|
| `blob()` / `blobSurface()` | `GrandTheftData/src/jerry.js` | Builds **any** rounded creature from a list of ellipsoid masses. This is the enemy dinosaur factory. |
| `hideMaps()` | same | Procedural pebbled skin + matching bump map. Re-tint per species. |
| `paint()` / `bellyTone()` | same | Bakes belly-to-back shading into vertex colours. |
| `strut()` / `claw()` | same | Limbs, fingers, toes, claws, straps. |
| Jerry himself | same | Ported as the player character, unchanged. |
| Vite + three.js + Pages deploy | `GrandTheftData/` | Same toolchain, same deploy workflow, second entry. |

**Recommendation: copy the kit into the new project rather than share it across both.** Data Dash is
deployed and stable; a shared module means a swamp-driven refactor can break the live game. Copy
`blob`, `hide`, `paint`, `strut`, `claw` into `src/creature/`, and let the two games diverge. The
duplication is maybe 250 lines and it buys total independence.

---

## 3. The two ladders

The whole design hangs off two parallel escalating ladders. Everything else serves these.

### 3.1 Jerry's arsenal — storage media

Damage rises with modernity, but **ammo scarcity rises with it too**, and each tier handles
differently so the older ones keep a niche. The floppy is the infinite fallback — Jerry is never
left with nothing.

| # | Weapon | Damage | Fire rate | Handling | Ammo/pickup |
|---|---|---|---|---|---|
| 1 | **Floppy Disk** | 10 | Fast | Flat spinning square, slight arc, short range | ∞ (fallback) |
| 2 | **CD-ROM** | 18 | Fast | Spins, ricochets once to a second target | 40 |
| 3 | **Tape Drive** | 26 | Slow | Big, pierces; unspools a tape trail that slows enemies crossing it | 24 |
| 4 | **Hard Drive** | 38 | Slow | Heavy lob with an arc; platter shrapnel does small AoE on impact | 18 |
| 5 | **USB Drive** | 50 | Medium | Fast straight dart, pinpoint, no drop | 14 |
| 6 | **SSD** | 68 | Medium | Near-instant, pierces up to 2 enemies | 10 |
| 7 | **Cloud** | 90 | Slow | Homing puff that rains damage over an area | 6 |

> **Design note.** Strictly ascending damage normally makes low tiers dead weight. Three things stop
> that: scarcity (you cannot hold enough SSDs to clear a wave), handling (the tape's slow field and
> the drive's AoE solve problems raw damage does not), and the floppy being infinite so there is
> always a floor.

### 3.2 The enemies — file formats

Bigger dinosaur → more complicated format → more damage per hit.

| # | Species | Fires | Damage | HP | Behaviour |
|---|---|---|---|---|---|
| 1 | **Compsognathus** | `.TXT` | 4 | 20 | Tiny, fast, swarms. Plain text — trivial alone, lethal in numbers. |
| 2 | **Dilophosaurus** | `.CSV` | 8 | 45 | Spits a comma-separated volley of 3 in a spread. |
| 3 | **Stegosaurus** | `.XLS` | 14 | 90 | Slow, armoured plates, lobs spreadsheets in an arc over cover. |
| 4 | **Pteranodon** | `.PDF` | 18 | 70 | Flies, ignores obstacles, drops PDFs from above. |
| 5 | **Triceratops** | `.ZIP` | 26 | 160 | Charges. Its ZIP bombs split into three smaller projectiles on impact. |
| 6 | **Ankylosaurus** | `.ISO` | 34 | 240 | Heavy, rolls at Jerry, fires huge slow disc images. |
| 7 | **T-Rex** (boss) | `.SQL` | 50 | 800 | Dumps an entire database — a sustained area denial attack. |

Projectile colours reuse the Data Dash file-type palette so the two games share a visual language.

---

## 4. Core systems

### 4.1 Camera and control

**Recommended: a 3/4 follow camera**, ~50° above the horizon, tracking Jerry with positional lag.
Reasons: free movement in all directions needs to read clearly; the arena and incoming projectiles
need to be legible; and it keeps the whole of Jerry on screen, which matters given how much work
went into the model. Over-the-shoulder would hide him and make swarms unreadable.

| Input | Action |
|---|---|
| `WASD` / arrows | Move, camera-relative |
| Mouse | Aim — Jerry turns to face the ground point under the cursor |
| Left click | Shoot |
| `Space` | Jump |
| `1`–`7` / scroll / tap a chip | Switch storage tier |
| `Shift` | Dodge roll (brief i-frames) — stretch |
| `P` | Pause |
| Left half drag | Move — floating thumbstick |
| Right half drag | Aim, and throw while held |
| Jump pad | Jump |

Keyboard-only fallback: arrows move, `IJKL` aims twin-stick style. **Both this and
the touch controls shipped after M3**, pulled forward out of M6 — they are the same
problem (aiming without a mouse) and were cheaper to solve once, together, while the
aim system was still small.

Aim arrives in one of two shapes and the rest of the game must not care which: a mouse
gives a *point* to resolve against the ground, a stick gives a *direction* and no point
at all. `input.aimMode` says which is live and `main.js` resolves both to the same aim
point, so the player and the reticle never learn there is more than one kind.

### 4.2 Movement and collision

No physics engine. Everything resolves on the **XZ plane** with a separate `y` for jumping:

- Entities are circles on XZ (`position`, `radius`). Obstacles are circles or AABBs.
- Jump is the same integrator Data Dash already uses — `velocity -= gravity * dt`, clamp at ground.
- **Projectiles fly at a fixed height** and only collide in 2D, *except* that a jumping Jerry above
  a threshold height dodges ground-fired shots. That one rule makes jumping tactical instead of
  decorative, and costs almost nothing to implement.
- Pteranodon shots come from above and *cannot* be jumped — they punish standing still instead.

### 4.3 Enemy AI

One small state machine per enemy, no pathfinding — the arena is open with sparse cover:

`spawn` → `approach` (move toward Jerry until within preferred range) → `strafe` (circle, maintain
range) → `fire` (telegraph, then shoot on a cooldown) → `stagger` (on hit) → `die`.

Per-species variation is data, not code: `preferredRange`, `speed`, `fireCooldown`, `telegraphTime`,
`projectileSpec`. Chargers (Triceratops, Ankylosaurus) swap `strafe` for a `windup` → `charge` pair.

**Telegraphs matter.** Every shot gets a visible wind-up — the dinosaur rears, the muzzle point
glows in the file type's colour — so damage always feels earned rather than random.

### 4.4 Pickups

Ammo caches float and rotate slowly above the mud, glowing in their tier colour, on respawn timers.
Picking one up grants ammo and auto-equips the tier if it is better than what is held. Health comes
from coffee mugs — a nod to the reference art's "I DON'T NEED BACKUPS, I HAVE LUCK" mug.

### 4.5 Waves

| Waves | Composition |
|---|---|
| 1–3 | Compsognathus swarms, then Dilophosaurus |
| 4–6 | Add Stegosaurus and Pteranodon |
| 7–9 | Add Triceratops and Ankylosaurus |
| 10 | T-Rex boss |

Short breather between waves; ammo caches respawn; a wave banner announces what is coming.

---

## 5. The arena

A prehistoric swamp that is also, quietly, a data centre that lost.

- **Water:** a murky tannin-brown plane with a scrolling normal map and gentle vertex ripple.
- **Ground:** mud islands and raised boardwalk platforms — these double as the jumpable obstacles.
- **Flora:** instanced ferns, cycads and horsetails. `InstancedMesh`, a handful of base meshes,
  randomised scale and rotation.
- **Ruins:** server racks half-sunk in the swamp, floating punch cards, cable vines, and a
  monolithic dead mainframe as the arena's centrepiece and hard cover.
- **Atmosphere:** heavy fog, drifting spores, a volcano glowing on the horizon.
- **Palette:** mossy greens and tannin browns, deliberately desaturated, so the file-type projectiles
  and the tier-coloured pickups pop as the only saturated things on screen.

> **Lighting warning, learned the hard way.** Data Dash's key light is near-monochrome lime, which
> flattened Jerry's tan hide to a green silhouette and hid all the model detail. The swamp must use a
> broadly neutral key with coloured *fill*, not a coloured key. Jerry already carries two short-range
> warm fill lights; keep them.

---

## 6. Project layout

```
DataSwamp/
  index.html
  package.json
  vite.config.js
  PLAN.md
  src/
    main.js              bootstrap, game loop, state machine
    creature/
      blob.js            blob/blobSurface/deform/paint  (copied from Data Dash)
      hide.js            procedural pebbled skin + bump  (copied)
      parts.js           strut/claw helpers              (copied)
      jerry.js           the player model                (ported)
      dinos.js           enemy species built on blob()
    scene/
      arena.js           ground, water, islands, lighting, fog
      flora.js           instanced plants
      ruins.js           sunken server racks, mainframe
    game/
      player.js          movement, jump, aim, health, i-frames
      weapons.js         storage tier table + projectile factory
      enemies.js         spawning, AI state machine
      projectiles.js     shared pool + collision
      pickups.js         ammo and health caches
      waves.js           wave director
    ui/
      hud.js             health, ammo, tier selector, wave banner
      panels.js          start / pause / game over
    audio.js
    style.css
```

---

## 7. Milestones

Each milestone ends with something runnable. No milestone depends on art that does not exist yet.

| # | Goal | Done when |
|---|---|---|
| **M0** | Skeleton | Vite project builds; flat ground; follow camera; Jerry ported and moving in all directions with a working jump. Nothing else. |
| **M1** | Shooting | Floppy projectiles fire toward the cursor; one dummy enemy takes damage, staggers, dies; hit feedback reads. |
| **M2** | Enemy kit | `dinos.js` generates 3 species from `blob()`; file-type projectiles; AI approach/strafe/fire with telegraphs; Jerry takes damage and can die. |
| **M3** | Arsenal | 4 storage tiers, switching, ammo pickups, HUD showing health/ammo/tier. **This is the first genuinely playable build.** |
| **M4** | The swamp | Water, islands, jumpable obstacles, flora, ruins, fog, atmosphere pass. |
| **M5** | Structure | Wave director, remaining species and weapons, T-Rex boss, start/game-over panels, audio. |
| **M6** | Polish | Perf pass, and the shadow decision from §8. Touch controls and the Pages deploy both landed early — see §4.1 and §9.2. |

---

## 8. Risks and traps

**`blob()` is expensive — generate geometry once per species, never per spawn.** It ray-marches
~5,000 vertices with 26 bisection steps each. That is fine at load for a handful of species (~1s
total) and catastrophic if called when an enemy spawns. Build a geometry cache at boot, and share or
instance it across every individual of that species.

**Vertex colours need a colour attribute on *every* geometry using the material.** Data Dash's hide
materials set `vertexColors: true`; any geometry without a `color` attribute renders pure black. This
bit once already — fingers and toes came out black. Every geometry sharing a hide material must go
through `paint()`, even if only with a no-op tone.

**Projectile and enemy counts will be the perf ceiling, not the geometry.** Pool projectiles from the
start rather than allocating; a swarm wave plus their shots is easily 200+ moving objects. Cap
concurrent enemies and cull projectiles aggressively on leaving the arena.

**Scope is the real risk.** 7 weapons × 7 species is 49 interactions to balance. Ship M3 with 4 and 3,
play it, then expand. The tables above are a target, not a v1 commitment.

**Shadows.** Data Dash uses a single 1024 shadow map. A populated arena will need either a tighter
shadow camera fitted to the play area or cheap blob shadows under entities. Decide at M4.

---

## 9. Settled questions

All five are now decided. Recorded here rather than deleted, because the reasoning is what stops
them being reopened by accident later.

1. **Camera — 3/4 follow.** Settled at M0 and confirmed by playing M2: the fixed yaw keeps screen-up
   pinned to world -z so movement never inverts, and the whole of Jerry stays on screen.
   Over-the-shoulder is rejected — it would hide the model and make swarms unreadable.
2. **Aiming — mouse primary, twin-stick alongside it.** The mouse stays the precise, desktop-first
   scheme the pinpoint tiers (USB, SSD) are designed around. The twin-stick fallback was originally
   deferred to M6 and then **pulled forward and shipped after M3**, on the grounds that touch and
   `IJKL` are one problem, not two, and the aim system was at its smallest right then. What remains
   of M6 is the perf pass.
3. **Art direction — grubby and organic.** The HUD extends the existing mud/bone/tannin/amber chrome:
   serif title, hairline rules, and saturation reserved for projectiles and pickups so they stay the
   only loud things on screen. Data Dash's neon-brutalist HUD is rejected — it would compete with the
   file-type projectiles for attention, which is exactly what the palette rule in §5 exists to prevent.
4. **Repo shape — sibling folder.** `DataSwamp/` beside `GrandTheftData/`, built as a second entry by
   the shared Pages workflow and served under `/swamp/`.
5. **Tone of failure — "Data loss".** Dry and in-world: the joke is that the backup engineer is the
   one thing that did not get backed up. Data Dash's "SYSTEM FAILURE" register is not reused; the two
   games share a visual language, not a voice.
