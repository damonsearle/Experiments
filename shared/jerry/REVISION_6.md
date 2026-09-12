# Jerry face revision 6

Open `Jerry_Character_Rev6.blend` for the revised model. `Jerry_Game_Rev6.glb` is its matching rigged export, now used by both games through `shared/jerry/jerry.js`. The original Revision 5 assets are retained as backups.

The beak now tapers into a forward, downward tip, with the nostrils lower on the snout. The lower jaw has a more curved smile, a fuller tongue, and a recessed mouth lining. Both glasses rims are complete and sit clear of the beak; the bridge, pins, and temples follow the revised fit.

Validation sampled idle frames 1, 23, 45, 68, and 90. All seven glasses components have zero triangle intersections with the head skin, beak/jaw, eyes, and nostril rims. The smallest sampled vertex clearance is about 0.014 model units. Full results are in `review/validation.json`. This checks the saved idle animation, not every possible gameplay pose.

The GLB has 91,544 triangles, 24 bones, four embedded texture images, and the retained `Jerry_Idle` animation. Every exported mesh is skinned; studio objects are excluded.

Comparison renders are in `review/before_*.png` and `review/revision6_*.png`. The original Blender snapshot is retained locally at `review/Jerry_before_face_refinement.blend` and excluded from Git.

`refine_face.py` uses preserved `R5_BASE_` mesh data to make the geometry changes repeatable without accumulating deformations. `mouth_lining.py` rebuilds the rigged mouth lining. `render_review.py` produces the three comparison views. `finalize_face.py` validates and creates a new revision output, refusing to overwrite an existing revision.
