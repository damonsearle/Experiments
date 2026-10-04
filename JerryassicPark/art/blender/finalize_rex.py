"""Keep each foot rigid below the ankle, including the spread inner toes."""
import bpy
from pathlib import Path
ROOT=Path('/Users/damon/source/Experiments/JerryassicPark')
hide=bpy.data.objects['Rex · continuous skinned hide']
count=0
for v in hide.data.vertices:
    if v.co.z < .85:
        for g in hide.vertex_groups:g.remove([v.index])
        side=0 if -v.co.y<0 else 1
        hide.vertex_groups['Knee'+str(side)].add([v.index],1.0,'REPLACE')
        count+=1
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/Tyrannosaurus_Rex.blend'))
print('Corrected foot weights:',count)
