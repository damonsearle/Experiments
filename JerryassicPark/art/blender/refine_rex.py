"""Blend sculpt masses, soften facial bosses and paint a naturalistic hide."""
import bpy, math, json, bmesh
from mathutils import Vector
from pathlib import Path
ROOT=Path('/Users/damon/source/Experiments/JerryassicPark')
scene=bpy.context.scene
skin=bpy.data.materials.get('Rex · umber hide / moss mottling')
for obj in list(scene.objects):
    if obj.name.startswith('Nasal ridge') or obj.name.startswith('Lip scale'):
        bpy.data.objects.remove(obj,do_unlink=True)
    elif obj.name.startswith('Orbital boss'):
        center=sum((v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
        for v in obj.data.vertices:
            v.co.z=center.z+(v.co.z-center.z)*.68
            v.co.y=center.y+(v.co.y-center.y)*.63
for node in skin.node_tree.nodes:
    if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.23

def skin_sphere(name,at,scale,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20)
    obj=bpy.context.object;obj.name=name
    for v in obj.data.vertices:
        v.co=Vector((v.co.x*scale[0]+at[0],-v.co.y*scale[2]-at[2],v.co.z*scale[1]+at[1]))
    obj.location=(0,0,0);obj.data.materials.append(skin)
    world=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=world
    return obj
for i,side in enumerate([-1,1]):
    skin_sphere('Rounded thigh muscle',(-.49,2.15,side*.80),(.53,.69,.35),bpy.data.objects['Leg'+str(i)])
    skin_sphere('Rounded knee',(.03,1.46,side*.79),(.255,.29,.25),bpy.data.objects['Knee'+str(i)])

def paint_hide(obj):
    for a in list(obj.data.color_attributes):obj.data.color_attributes.remove(a)
    color=obj.data.color_attributes.new(name='Hide',type='FLOAT_COLOR',domain='POINT')
    obj.data.color_attributes.active_color=color
    bpy.context.view_layer.update()
    for vertex,item in zip(obj.data.vertices,color.data):
        p=obj.matrix_world@vertex.co;x,y,z=p.x,p.z,-p.y
        grain=math.sin(x*22.7+z*17.1+y*13.4)*math.sin(x*7.1-y*12.6+z*6.2)
        breakup=math.sin(x*2.3+y*4+z*2.1)*.18
        band=max(0,math.sin(x*4.1+math.sin(y*2.5)+math.cos(z*4)*.5))**3
        dorsal=max(0,min(1,(y-2.65)/.8))
        face=max(0,min(1,(x-1.5)/1.3))
        shade=.96 + grain*.13 + breakup - band*.43 - dorsal*.32
        belly=max(0,1-abs(x+.1)/2)*max(0,1-abs(y-1.9)/.8)*max(0,1-abs(z)/.88)
        item.color=(.14*shade+belly*.09,.106*shade+belly*.068,.057*shade+belly*.038,1)

for role in ['Body','Head','Leg0','Leg1','Knee0','Knee1','Arm0','Arm1']:
    pivot=bpy.data.objects[role]
    meshes=[o for o in pivot.children if o.type=='MESH' and o.data.materials and o.data.materials[0]==skin]
    if not meshes:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.join();obj=bpy.context.object;obj.name='Sculpted '+role+' hide'
    remesh=obj.modifiers.new('Fused anatomical masses','REMESH');remesh.mode='VOXEL'
    remesh.voxel_size=.037 if role in ['Body','Head'] else .024
    remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=obj.modifiers.new('Relax muscle transitions','SMOOTH');smooth.factor=.7;smooth.iterations=5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    dec=obj.modifiers.new('Game mesh reduction','DECIMATE');dec.ratio=.62
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for poly in obj.data.polygons:poly.use_smooth=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project();bpy.ops.object.mode_set(mode='OBJECT')
    for uv in obj.data.uv_layers.active.data:uv.uv*=7
    paint_hide(obj)

for obj in scene.objects:
    if obj.type=='MESH' and obj.data.materials and obj.data.materials[0]==skin:
        if not obj.name.startswith('Sculpted'):paint_hide(obj)
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()

scene.render.filepath=str(ROOT/'art/rex/three-quarter.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/Tyrannosaurus_Rex.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps({'stage':'refined','vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH')}))
