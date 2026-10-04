"""Studio setup for the dedicated Rex atelier. Run after build_rex.py."""
import bpy, math, json
from mathutils import Vector
from pathlib import Path
ROOT = Path('/Users/damon/source/Experiments/JerryassicPark')
scene=bpy.context.scene
world=bpy.data.worlds.new('Rex · warm slate studio');world.use_nodes=True;scene.world=world
background=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
background.inputs['Color'].default_value=(.13,.16,.18,1);background.inputs['Strength'].default_value=.4
try: scene.render.engine='CYCLES'
except TypeError: pass
scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
camdata=bpy.data.cameras.new('Rex review camera');camdata.type='ORTHO';camdata.ortho_scale=13.7
camera=bpy.data.objects.new('Rex review camera',camdata);scene.collection.objects.link(camera);scene.camera=camera
target=Vector((-.9,0,2.25));camera.location=target+Vector((7,-17,6));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
for name,at,power,color,size in [('Warm key',(3,-6,9),1900,(1,.85,.64),7),('Cool rim',(-3,5,7),2700,(.59,.79,1),6),('Head fill',(7,1,6),1200,(1,.93,.83),5)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=at;obj.rotation_euler=(Vector((0,0,2))-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200)
floor=bpy.context.object;floor.name='Studio floor';floor.location.z=-.012
mat=bpy.data.materials.new('Studio charcoal');mat.use_nodes=True
next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value=(.065,.081,.087,1)
floor.data.materials.append(mat)
for area in bpy.context.screen.areas:
    if area.type=='CONSOLE': area.type='VIEW_3D'
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.type='MATERIAL'
scene.render.filepath=str(ROOT/'art/rex/three-quarter.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/Tyrannosaurus_Rex.blend'))
bpy.ops.render.render(write_still=True)
print('REX_STUDIO_RENDER_COMPLETE')
