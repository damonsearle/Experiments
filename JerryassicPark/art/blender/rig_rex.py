"""Create a continuous deforming hide with a proper skeleton and smooth hip weights."""
import bpy, math, json, bmesh
from mathutils import Vector, Matrix
from pathlib import Path
ROOT=Path('/Users/damon/source/Experiments/JerryassicPark')
scene=bpy.context.scene
root=bpy.data.objects['Tyrannosaurus_Rex']
skin=bpy.data.materials['Rex · umber hide / moss mottling']
def V(p):return Vector((p[0],-p[2],p[1]))
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)

# Reduce exposed iris area and the forelimbs without losing their two fingers.
for obj in list(root.children_recursive):
    if obj.name.startswith('Amber eye') or obj.name.startswith('Round pupil'):
        center=sum((v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
        for v in obj.data.vertices:v.co=center+(v.co-center)*.73
for index in [0,1]:
    bpy.data.objects['Arm'+str(index)].scale*=.78
bpy.context.view_layer.update()
pieces=[];rigid=[]
for obj in list(root.children_recursive):
    if obj.type!='MESH':continue
    role=obj.parent.get('role','Body')
    matrix=obj.matrix_world.copy()
    for v in obj.data.vertices:v.co=matrix@v.co
    obj.parent=None;obj.matrix_world=Matrix.Identity(4)
    if obj.data.materials and obj.data.materials[0]==skin and role!='Jaw':pieces.append(obj)
    else:rigid.append((obj,role))
bpy.ops.object.select_all(action='DESELECT')
for obj in pieces:obj.select_set(True)
bpy.context.view_layer.objects.active=pieces[0];bpy.ops.object.join()
hide=bpy.context.object;hide.name='Rex · continuous skinned hide'
remesh=hide.modifiers.new('Continuous skin at shoulders and hips','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.035;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
sm=hide.modifiers.new('Sculpt relaxation','SMOOTH');sm.factor=.65;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
dec=hide.modifiers.new('Game surface','DECIMATE');dec.ratio=.55;bpy.ops.object.modifier_apply(modifier=dec.name)
for face in hide.data.polygons:face.use_smooth=True
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project();bpy.ops.object.mode_set(mode='OBJECT')
for uv in hide.data.uv_layers.active.data:uv.uv*=8
for attribute in list(hide.data.color_attributes):hide.data.color_attributes.remove(attribute)
colors=hide.data.color_attributes.new(name='Hide',type='FLOAT_COLOR',domain='POINT');hide.data.color_attributes.active_color=colors
for vertex,item in zip(hide.data.vertices,colors.data):
    x,z,y=vertex.co.x,-vertex.co.y,vertex.co.z
    grain=math.sin(x*22.7+z*17.1+y*13.4)*math.sin(x*7.1-y*12.6+z*6.2)
    band=max(0,math.sin(x*4.1+math.sin(y*2.5)+math.cos(z*4)*.5))**3
    dorsal=smooth(2.6,3.6,y)
    shade=.92+grain*.12+math.sin(x*2.3+y*4+z*2.1)*.12-band*.42-dorsal*.28
    belly=max(0,1-abs(x+.1)/2)*max(0,1-abs(y-1.9)/.8)*max(0,1-abs(z)/.88)
    item.color=(.125*shade+belly*.09,.09*shade+belly*.068,.047*shade+belly*.04,1)

# All deformation controls are named for the browser rig; the contact bones are markers.
old_pivots=[o for o in root.children_recursive if o.type=='EMPTY']
armdata=bpy.data.armatures.new('Tyrannosaurus skeleton')
arm=bpy.data.objects.new('Tyrannosaurus skeleton',armdata);scene.collection.objects.link(arm);arm.parent=root
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None,deform=True):
    b=armdata.edit_bones.new(name);b.head=V(head);b.tail=V(tail);b.use_deform=deform
    if parent:b.parent=armdata.edit_bones[parent]
    return b
bone('Body',(0,2.55,0),(1,2.9,0))
bone('Head',(1.7,3.55,0),(2.7,3.95,0),'Body')
bone('Jaw',(1.98,3.36,0),(3.1,3.1,0),'Head')
bone('Tail',(-1.25,2.85,0),(-3.75,3.06,0),'Body')
bone('TailTip',(-3.75,3.06,0),(-6.7,3.2,.1),'Tail')
for i,side in enumerate([-1,1]):
    bone('Leg'+str(i),(-.65,2.62,side*.66),(.03,1.44,side*.79),'Body')
    bone('Knee'+str(i),(.03,1.44,side*.79),(-.4,.43,side*.83),'Leg'+str(i))
    bone('Arm'+str(i),(1.04,2.91,side*.53),(1.48,2.47,side*.71),'Body')
    bone('ToeContact'+str(i),(.94,.035,side*.84),(1.04,.035,side*.84),'Knee'+str(i),False)
    bone('HeelContact'+str(i),(-.4,.075,side*.83),(-.3,.075,side*.83),'Knee'+str(i),False)
bpy.ops.object.mode_set(mode='OBJECT')
for b in armdata.bones:b['role']=b.name
groups={b.name:hide.vertex_groups.new(name=b.name) for b in armdata.bones if b.use_deform}
for vertex in hide.data.vertices:
    x,z,y=vertex.co.x,-vertex.co.y,vertex.co.z
    weights={'Body':1.0}
    if x < -1.2:
        tail=smooth(-1.15,-1.9,x);tip=smooth(-3.5,-4.2,x)
        weights={'Body':1-tail,'Tail':tail*(1-tip),'TailTip':tail*tip}
    elif x>1.35:
        head=smooth(1.35,2.0,x)*smooth(2.6,3.3,y)
        weights={'Body':1-head,'Head':head}
    if -1.55<x<1.05 and y<2.7:
        leg=(1-smooth(1.9,2.8,y))*smooth(.30,.65,abs(z))
        if leg>0:
            i=0 if z<0 else 1;knee=1-smooth(1.18,1.72,y)
            weights={k:w*(1-leg) for k,w in weights.items()}
            weights['Leg'+str(i)]=leg*(1-knee);weights['Knee'+str(i)]=leg*knee
    if 1.0<x<1.95 and 2.2<y<3.05 and abs(z)>.48:
        weight=smooth(.48,.70,abs(z))*(1-smooth(2.7,3.03,y));i=0 if z<0 else 1
        weights={k:w*(1-weight) for k,w in weights.items()};weights['Arm'+str(i)]=weight
    total=sum(weights.values())
    for key,weight in weights.items():
        if weight>.0001:groups[key].add([vertex.index],weight/total,'REPLACE')

def bind_mesh(obj):
    obj.parent=arm
    mod=obj.modifiers.new('Tyrannosaurus deformation','ARMATURE');mod.object=arm
    obj['skinned_rex']=True
bind_mesh(hide)
for obj,role in rigid:
    if role not in groups:role='Body'
    group=obj.vertex_groups.new(name=role);group.add(list(range(len(obj.data.vertices))),1.0,'REPLACE');bind_mesh(obj)
for obj in old_pivots:bpy.data.objects.remove(obj,do_unlink=True)

# Combine rigid accessories by material while retaining their bone groups.
by_material={}
for obj,role in rigid:by_material.setdefault(obj.data.materials[0].name,[]).append(obj)
for name,objects in by_material.items():
    if len(objects)<2:continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    bpy.context.object.name=name+' · skinned details'
root['animationRig']='rex-skinned-v2'
bpy.context.view_layer.update()
scene.render.filepath=str(ROOT/'art/rex/three-quarter.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/Tyrannosaurus_Rex.blend'))
bpy.ops.render.render(write_still=True)
print(json.dumps({'stage':'skinned','bones':len(armdata.bones),'meshes':sum(o.type=='MESH' for o in root.children_recursive),'vertices':sum(len(o.data.vertices) for o in root.children_recursive if o.type=='MESH')}))
