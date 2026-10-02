import bpy, math
from mathutils import Vector
from pathlib import Path
root=Path('/Users/damon/source/Experiments/DataSwamp')
scene=bpy.context.scene
models=[o for o in scene.objects if o.get('species')]
for obj in models: obj.location=(0,0,0)
world=bpy.data.worlds.new('Atelier charcoal'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.08,.11,.13,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES'; scene.cycles.samples=24
scene.render.resolution_x=720;scene.render.resolution_y=560;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Atelier camera';scene.camera=cam;cam.data.type='ORTHO'
lights=[]
for name,at,power,color,size in [('Key',(2,-4,6),950,(1,.83,.64),5),('Rim',(-3,3,4),1500,(.55,.79,1),4),('Fill',(4,4,3),700,(1,.49,.23),4)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=at;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Atelier floor'
mat=bpy.data.materials.new('Slate');mat.diffuse_color=(.032,.052,.056,1);mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.032,.052,.056,1);floor.data.materials.append(mat)
(root/'art/previews').mkdir(exist_ok=True)
for model in models:
    for other in models:
        other.hide_render=other!=model
        for o in other.children_recursive: o.hide_render=other!=model
    bpy.context.view_layer.update()
    pts=[o.matrix_world@Vector(v) for o in model.children_recursive if o.type=='MESH' for v in o.bound_box]
    low=Vector(tuple(min(p[i] for p in pts) for i in range(3))); high=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
    center=(low+high)/2; span=max(high.x-low.x,high.y-low.y,high.z-low.z)
    floor.location.z=low.z-.025
    cam.location=center+Vector((3.5,-6,2.7))*span
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=span*1.24
    scene.render.filepath=str(root/'art/previews'/f'{model.name}.png');bpy.ops.render.render(write_still=True)
for i,model in enumerate(models):
    model.hide_render=False
    for o in model.children_recursive:o.hide_render=False
    model.location=((i%4)*4.8,-(i//4)*5.5,0)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/blender/DataSwamp_Enemies.blend'))
print('RENDERS_COMPLETE')
