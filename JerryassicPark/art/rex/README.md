# Tyrannosaurus redesign

An original, stylized Blender model for Jerryassic Park. The reference goal was a heavier predator with a deep skull, thick neck and hips, long counterbalancing tail, tiny two-fingered arms, three weight-bearing toes and subdued mottled skin. This is a game character, not a scientifically definitive reconstruction or a replica of a movie asset.

## References consulted

- [Stan Winston School: Jurassic Park's full-size T. rex sculpture](https://www.stanwinstonschool.com/blog/jurassic-park-t-rex-sculpting-a-full-size-dinosaur): skull mass, jaw silhouette and body presence.
- [Apple TV / BBC Studios: Prehistoric Planet press gallery](https://www.apple.com/tv-pr/originals/prehistoric-planet/): substantial torso, muscular legs, naturalistic stance and restrained coloration.
- [Natural History Museum: Tyrannosaurus](https://www.nhm.ac.uk/discover/dino-directory/tyrannosaurus.html): general proportions and anatomy.
- [Natural History Museum: evidence for dinosaur lips](https://www.nhm.ac.uk/discover/news/2023/march/dinosaurs-may-have-had-scaly-lips-protect-teeth-from-damage.html): soft tissue remains uncertain. This model retains an open-jaw cinematic silhouette for gameplay readability.

No film stills, documentary images, or third-party models are embedded in the game.

## Deliverables

- `../blender/Tyrannosaurus_Rex.blend`: editable continuous hide, 15-bone skeleton, separate jaw and details, studio lights and camera. The original default Blender scene is retained alongside the creature scene.
- `../../public/models/tyrannosaurus-rex.glb`: nine skinned meshes with vertex-color markings and packed pebbled normal texture. Export only `Tyrannosaurus_Rex` and its descendants, with modifier baking disabled to retain the skeleton.
- `three-quarter.png`: Blender studio render.
- `browser-preview.jpg`: actual browser viewer screenshot.

The browser animates named bones procedurally; there are no baked walk clips. Feet use contact markers for grounding. Model instances clone skeletons independently, while sharing immutable geometry and materials. Tests load the real GLB and check scale, independent skeletons, grounding and deterministic rewind poses.

To regenerate the source in Blender, run the scripts under `../blender/` in order: `build_rex.py`, `review_rex.py`, `refine_rex.py`, `rig_rex.py`, `finalize_rex.py`. They target the dedicated creature scene. Export the root hierarchy again after editing.
