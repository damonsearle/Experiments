"""Data Swamp enemy collection. Execute in Blender via tools/blender_mcp_client.py.
Coordinates below use the game's +X forward, +Y up convention.
"""
import bpy, math, random, json
from mathutils import Vector
from pathlib import Path
ROOT = Path('/Users/damon/source/Experiments/DataSwamp')
OUT = ROOT / 'public/models/enemies'
random.seed(41)
# This script owns a new scene; other open scenes and files are preserved.
old = bpy.data.scenes.get('Data Swamp — Enemy Atelier')
if old:
    for obj in list(old.objects): bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new('Data Swamp — Enemy Atelier')
bpy.context.window.scene = scene

def V(p): return Vector((p[0], -p[2], p[1]))
def empty(name, parent=None, at=(0,0,0)):
    o=bpy.data.objects.new(name,None); scene.collection.objects.link(o)
    o.parent=parent; o.location=V(at); return o

def material(name, color, rough=.65, vertex=False):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    if vertex:
        attr=m.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name='Color'
        m.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    return m
skin=material('Painted reptile hide',(1,1,1),.78,True)
# A seamless reptile-scale normal texture, embedded in each GLB.
N=256
heights=[]
for y in range(N):
    for x in range(N):
        row=int(y/16); u=((x+8*(row%2))%16)/8-1; v=(y%16)/8-1
        heights.append(max(0,1-u*u-v*v)**.6)
pixels=[]
for y in range(N):
    for x in range(N):
        dx=heights[y*N+(x+1)%N]-heights[y*N+(x-1)%N]
        dy=heights[((y+1)%N)*N+x]-heights[((y-1)%N)*N+x]
        n=Vector((-dx*1.8,-dy*1.8,1)).normalized()
        pixels.extend((n.x*.5+.5,n.y*.5+.5,n.z*.5+.5,1))
tex=bpy.data.images.new('Reptile micro scales',width=N,height=N)
tex.colorspace_settings.name='Non-Color';tex.pixels=pixels;tex.pack()
img=skin.node_tree.nodes.new('ShaderNodeTexImage');img.image=tex
normal=skin.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.18
skin.node_tree.links.new(img.outputs['Color'],normal.inputs['Color'])
skin.node_tree.links.new(normal.outputs['Normal'],skin.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
armor=material('Painted keratin',(1,1,1),.62,True)
ivory=material('Warm ivory claws',(0.72,.61,.40),.4)
mouth=material('Deep mouth and pupils',(.025,.018,.012),.58)
eye=material('Amber iris',(.88,.40,.025),.25)
PALETTES={'compy':(.26,.43,.12),'dilo':(.12,.32,.37),'stego':(.40,.31,.15),'ptero':(.43,.24,.15),'trike':(.38,.20,.13),'anky':(.27,.32,.16),'rex':(.28,.32,.19)}

def paint(o, base, variation=True):
    a=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(o.data.vertices,a.data):
        x,z,y=v.co
        # Broken dorsal bands and fine mottling, baked into exportable vertex colour.
        band=max(0,math.sin(x*13+math.sin(z*16)*1.1))**5
        shade=1 - (.29*band if variation else 0) + .065*math.sin(x*87+z*59+y*47)
        c.color=(*(max(.015,min(.95,t*shade)) for t in base),1)

def finish(o,name,parent,mat,base=None):
    o.name=name; o.parent=parent
    o.data.materials.append(mat)
    for f in o.data.polygons: f.use_smooth=True
    if base: paint(o,base)
    return o

def ell(name,p,s,parent,mat=skin,base=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=(0,0,0))
    o=bpy.context.object
    for v in o.data.vertices: v.co=V((v.co.x*s[0]+p[0],v.co.z*s[1]+p[1],-v.co.y*s[2]+p[2]))
    return finish(o,name,parent,mat,base)

def tube(name, points, radii, parent, mat=skin, base=None, sides=12):
    pts=[Vector(p) for p in points]; verts=[]; faces=[]
    for i,(p,r) in enumerate(zip(pts,radii)):
        tangent=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        axis=Vector((0,0,1))
        if abs(tangent.dot(axis))>.9: axis=Vector((0,1,0))
        a=tangent.cross(axis).normalized(); b=tangent.cross(a).normalized()
        ra,rb=(r,r) if isinstance(r,(float,int)) else r
        for j in range(sides):
            t=2*math.pi*j/sides; verts.append(V(p+a*(math.cos(t)*ra)+b*(math.sin(t)*rb)))
    for i in range(len(pts)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))])
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); scene.collection.objects.link(o)
    uv=mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        js=[mesh.loops[k].vertex_index%sides for k in face.loop_indices]
        seam=0 in js and sides-1 in js
        for k in face.loop_indices:
            vi=mesh.loops[k].vertex_index; j=vi%sides
            uv.data[k].uv=(vi//sides/max(1,len(pts)-1)*2,(sides if seam and j==0 else j)/sides)
    if mat==skin:
        bpy.context.view_layer.objects.active=o; o.select_set(True)
        sub=o.modifiers.new('Sculpted contour','SUBSURF');sub.levels=2 if 'torso' in name.lower() else 1
        bpy.ops.object.modifier_apply(modifier=sub.name)
    return finish(o,name,parent,mat,base)

def horn(name,a,b,r,parent): return tube(name,[a,tuple(Vector(a).lerp(Vector(b),.55)),b],[r,r*.6,.002],parent,ivory,sides=10)

def plate(name,x,y,z,w,h,parent,base):
    # A keeled, diamond-shaped plate with a crisp silhouette.
    p=[(x-w,y,z),(x+w,y,z),(x+w*.68,y+h*.64,z),(x,y+h,z),(x-w*.75,y+h*.55,z),(x,y+h*.36,z+.045),(x,y+h*.36,z-.045)]
    f=[]
    for i in range(5): f.extend([(i,(i+1)%5,5),((i+1)%5,i,6)])
    me=bpy.data.meshes.new(name); me.from_pydata([V(v) for v in p],[],f); me.update()
    o=bpy.data.objects.new(name,me); scene.collection.objects.link(o); finish(o,name,parent,armor,base)

def rig(id,height,headpos):
    root=empty(id); root['species']=id
    body=empty('Body',root,(0,height,0)); head=empty('Head',body,headpos); tail=empty('Tail',body,(-.42,0,0))
    return root,body,head,tail

def face(head,size,length,col,teeth=True):
    ell('Cranium',(-.015,.025,0),(size*.82,size*.76,size*.66),head,base=col)
    ell('Upper muzzle',(length*.49,-size*.10,0),(length*.60,size*.39,size*.48),head,base=col)
    ell('Mouth gap',(length*.50,-size*.41,0),(length*.56,size*.13,size*.43),head,mouth)
    ell('Lower jaw',(length*.46,-size*.57,0),(length*.55,size*.16,size*.39),head,base=tuple(c*1.35 for c in col))
    for side in [-1,1]:
        z=side*size*.60
        ell('Eye socket',(.025,size*.28,z),(size*.37,size*.31,size*.13),head,mouth)
        ell('Amber eye',(.044,size*.29,z*1.085),(size*.23,size*.21,size*.10),head,eye)
        ell('Slit pupil',(.06,size*.29,z*1.20),(size*.053,size*.17,size*.035),head,mouth)
        tube('Heavy brow',[(-size*.18,size*.49,z),(.08,size*.52,z),(.17,size*.39,z)],[size*.14,size*.17,size*.08],head,skin,col)
        ell('Nostril',(length*.87,size*.035,side*size*.37),(size*.08,size*.055,size*.025),head,mouth)
        if teeth:
            for i in range(7):
                x=length*(.14+i*.115)
                horn('Tooth',(x,-size*.36,side*size*.36),(x+.014,-size*.64,side*size*.32),size*.07,head)
    head['muzzle']=[length*1.07,-size*.4,0]

def biped(id,scale=1):
    col=PALETTES[id]; rex=id=='rex'; small=id=='compy'
    # All dimensions authored at Dilo scale, Compy and Rex are scaled at the root.
    root,body,head,tail=rig(id,1.02,(.63,.67,0))
    tube('Continuous torso and S neck',[(-.53,0,0),(-.3,.02,0),(.02,0,0),(.27,.10,0),(.40,.29,0),(.43,.52,0),(.61,.66,0)],
        [.06,(.24,.25),(.30,.29),(.27,.25),(.18,.17),(.12,.12),(.14,.13)],body,base=col,sides=20)
    ell('Cream throat',(.38,.29,0),(.115,.24,.148),body,base=tuple(c*.6+.25 for c in col))
    tube('Long counterbalance tail',[(0,0,0),(-.3,.025,0),(-.65,.10,.035),(-1.0,.18,.065),(-1.32,.23,.04)], [.20,.16,.10,.05,.004],tail,base=col,sides=14)
    face(head,.24 if rex else .17,.56 if rex else .37,col)
    if id=='dilo':
        for z in [-.072,.072]:
            plate('Twin scarlet crest',.10,.10,z,.25,.30,head,(.58,.16,.065))
    elif rex:
        for z in [-.12,.12]: plate('Orbital horn',.035,.14,z,.12,.13,head,(.18,.22,.10))
    for index,side in enumerate([-1,1]):
        leg=empty('Leg'+str(index),body,(-.23,-.10,side*.20))
        tube('Powerful thigh and angled shin',[(0,0,0),(.15,-.24,side*.025),(.10,-.36,side*.03),(-.015,-.65,side*.035),(.015,-.80,side*.04),(.015,-.90,side*.04)], [.175,.145,.09,.06,.057,.045],leg,base=col)
        for toe in [-1,0,1]:
            z=side*.04+toe*.058
            tube('Separated toe',[(.01,-.81,z),(.16,-.855,z+toe*.027),(.28,-.86,z+toe*.042)],[.049,.032,.012],leg,base=col,sides=8)
            horn('Toe claw',(.25,-.86,z+toe*.042),(.35,-.87,z+toe*.05),.027,leg)
        arm=empty('Arm'+str(index),body,(.24,.05,side*.22))
        size=.60 if rex else 1
        tube('Bent grasping arm',[(0,0,0),(.06,-.20*size,side*.06),(.21*size,-.25*size,side*.04)],[.062,.04,.025],arm,base=col,sides=10)
        for finger in [-1,1]: horn('Hand claw',(.21*size,-.25*size,side*.04+finger*.025),(.29*size,-.29*size,side*.04+finger*.028),.017,arm)
    root.scale=(scale,scale,scale)
    return root

def quad(id):
    col=PALETTES[id]; root,body,head,tail=rig(id,.80,(.78,-.07,0))
    tube('Barrel torso',[(-.77,0,0),(-.48,.07,0),(-.08,.10,0),(.33,.04,0),(.64,-.02,0),(.80,-.06,0)], [.16,(.37,.40),(.43,.46),(.35,.39),(.23,.27),.13],body,base=col,sides=20)
    tail.location=V((-.64,.02,0))
    tube('Tapered tail',[(0,0,0),(-.36,.035,0),(-.72,.10,0),(-1.08,.16,0)],[.23,.17,.09,.012],tail,base=col)
    face(head,.21 if id=='trike' else .15,.35 if id=='trike' else .28,col,False)
    for index,(x,side) in enumerate([(-.43,-1),(.43,1),(-.43,1),(.43,-1)]):
        leg=empty('Leg'+str(index),body,(x,-.12,side*.29))
        tube('Weight bearing leg',[(0,0,0),(-.03,-.21,side*.035),(.025,-.46,side*.045),(.08,-.60,side*.05),(.08,-.68,side*.05)],[.18,.145,.10,.12,.10],leg,base=col)
        for toe in [-1,0,1]:
            ell('Broad toe',(.13,-.615,side*.05+toe*.075),(.115,.055,.054),leg,base=col)
            horn('Hoof',(.20,-.61,side*.05+toe*.075),(.27,-.63,side*.05+toe*.078),.035,leg)
    if id=='stego':
        for i in range(8):
            x=.52-i*.20; y=.18+.31*math.sin((i+1)/9*math.pi)
            h=.28+.34*math.sin((i+1)/9*math.pi)
            plate('Dorsal sail',x,y,(-1 if i%2 else 1)*.08,.16,h,body,(.54,.23,.085))
        for x in [-.63,-.87]:
            for s in [-1,1]: horn('Thagomizer',(x,.12,s*.06),(x-.20,.31,s*.44),.067,tail)
    if id=='trike':
        ell('Bony frill',(-.14,.17,0),(.13,.46,.47),head,armor,(.25,.125,.07))
        ell('Frill inlay',(-.015,.21,0),(.03,.33,.34),head,armor,(.59,.28,.105))
        for i in range(11):
            a=math.pi*(i/10)
            y=.13+math.sin(a)*.44; z=math.cos(a)*.45
            horn('Frill rim',(-.12,y,z),(-.16,y+.085,z*1.17),.044,head)
        for side in [-1,1]: horn('Brow horn',(.03,.20,side*.15),(.58,.59,side*.20),.083,head)
        horn('Nose horn',(.30,.075,0),(.45,.34,0),.067,head)
    if id=='anky':
        for row in range(5):
            x=-.48+row*.23
            for side in [-1,0,1]:
                z=side*.27; y=.35 if side==0 else .25
                ell('Overlapping osteoderm',(x,y,z),(.17,.11,.16),body,armor,(.35,.39,.20))
                if side: horn('Flank spike',(x,.18,side*.38),(x-.13,.29,side*.67),.10,body)
        ell('Tail club',(-1.11,.16,0),(.24,.17,.32),tail,armor,(.34,.32,.18))
        for s in [-1,1]: horn('Cheek horn',(-.03,.06,s*.13),(-.18,.14,s*.32),.055,head)
    return root

def ptero():
    col=PALETTES['ptero']; root,body,head,tail=rig('ptero',2.6,(.40,.24,0))
    ell('Flight torso',(-.02,0,0),(.39,.21,.21),body,base=col)
    tube('Neck',[(.18,.04,0),(.32,.18,0),(.44,.25,0)],[.15,.11,.09],body,base=col)
    face(head,.15,.66,col,False)
    plate('Swept head crest',-.20,.05,0,.28,.30,head,(.56,.23,.10))
    tube('Short tail',[(0,0,0),(-.18,0,0)],[.10,.009],tail,base=col)
    for i,s in enumerate([-1,1]):
        wing=empty('Leg'+str(i),body,(.03,.075,s*.15))
        points=[(0,0,0),(.32,.045,s*.50),(.12,.025,s*1.02),(-.50,-.06,s*1.70),(-.37,-.12,s*1.03),(-.53,-.16,s*.53),(-.35,-.12,0)]
        me=bpy.data.meshes.new('Wing membrane'); me.from_pydata([V(p) for p in points],[],[(0,1,6),(1,5,6),(1,2,5),(2,4,5),(2,3,4)])
        o=bpy.data.objects.new('Scalloped membrane',me); scene.collection.objects.link(o); finish(o,'Scalloped membrane',wing,armor,(.52,.29,.13))
        solid=o.modifiers.new('Membrane thickness','SOLIDIFY'); solid.thickness=.013
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=solid.name)
        tube('Wing leading finger',points[:4],[.055,.044,.026,.004],wing,skin,col,sides=10)
        for target in [points[4],points[5],points[6]]: tube('Membrane tendon',[points[1],target],[.015,.005],wing,ivory,sides=6)
        horn('Thumb claw',points[1],(.46,.07,s*.53),.033,wing)
        tube('Trailing leg',[(-.21,-.10,s*.12),(-.46,-.23,s*.17),(-.56,-.21,s*.22)],[.065,.035,.02],body,base=col)
    return root

roots=[biped('compy',.58),biped('dilo'),quad('stego'),ptero(),quad('trike'),quad('anky'),biped('rex',1.85)]
# Merge only within an animation pivot and material, preserving all rig controls.
for root in roots:
    descendants=list(root.children_recursive)
    groups={}
    for o in descendants:
        if o.type=='MESH': groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
    for (parent,mat),objs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]
        if len(objs)>1:bpy.ops.object.join()
        objs[0].name=parent.name+'_'+mat.name
    # Blender appends suffixes globally. Export role names as explicit metadata.
    for o in root.children_recursive:
        if o.type=='EMPTY': o['role']=o.name.split('.')[0]
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in root.children_recursive:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(root.name+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_yup=True,export_animations=False,export_apply=True)
    print('EXPORTED',root.name)
# Arrange the editable collection as a lineup for inspection.
for i,r in enumerate(roots): r.location=V(((i%4)*4.8,(0), (i//4)*5.5))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/DataSwamp_Enemies.blend'))
print('ALL_SEVEN_ENEMIES_SAVED')
