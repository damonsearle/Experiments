"""Original reference-informed T. rex, authored in Blender; +X forward, +Z up.
Builds only the dedicated atelier scene. Existing game assets are never overwritten.
"""
import bpy, math, json, random
import numpy as np
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path('/Users/damon/source/Experiments/JerryassicPark')
random.seed(83)
if bpy.context.screen.is_animation_playing:
    bpy.ops.screen.animation_cancel(restore_frame=False)
previous = bpy.data.scenes.get('Jerryassic — Tyrannosaurus Atelier')
if previous:
    for obj in list(previous.objects): bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.scenes.remove(previous)
scene = bpy.data.scenes.new('Jerryassic — Tyrannosaurus Atelier')
bpy.context.window.scene = scene
scene['references'] = 'Stan Winston Jurassic Park sculpture; Apple/BBC Prehistoric Planet; NHM tyrannosaur anatomy'

def enum_value(owner, prop, requested):
    values = [v.identifier for v in owner.bl_rna.properties[prop].enum_items]
    if requested not in values: raise ValueError((prop, requested, values))
    return requested

def V(p): return Vector((p[0], -p[2], p[1]))
def attach(obj, parent):
    if parent:
        bpy.context.view_layer.update()
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix
    return obj
def pivot(name, at=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None); scene.collection.objects.link(o)
    o.location = V(at); attach(o, parent); o['role'] = name
    return o
root = pivot('Tyrannosaurus_Rex')
root['species'] = 'rex'; root['revision'] = 2; root['animationRig'] = 'rex-articulated-v2'
body = pivot('Body', (0, 2.55, 0), root)
head = pivot('Head', (1.7, 3.55, 0), body)
jaw = pivot('Jaw', (1.98, 3.36, 0), head)
tail = pivot('Tail', (-1.25, 2.85, 0), body)
tail_tip = pivot('TailTip', (-3.75, 3.06, 0), tail)
head['muzzle'] = [2.48, -.12, 0]

def material(name, color, roughness=.72):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.diffuse_color = (*color, 1)
    bs = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value = (*color, 1); bs.inputs['Roughness'].default_value = roughness
    return m, bs
skin, skin_bs = material('Rex · umber hide / moss mottling', (1, 1, 1), .82)
attribute = skin.node_tree.nodes.new('ShaderNodeVertexColor'); attribute.layer_name = 'Hide'
skin.node_tree.links.new(attribute.outputs['Color'], skin_bs.inputs['Base Color'])
mouth, _ = material('Rex · mouth interior', (.075, .021, .02), .48)
gums, _ = material('Rex · muted gum and tongue', (.19, .072, .058), .5)
tooth, _ = material('Rex · worn ivory enamel', (.68, .56, .37), .36)
horn, _ = material('Rex · dark claw keratin', (.047, .042, .029), .46)
socket, _ = material('Rex · eye socket and nostrils', (.018, .013, .009), .7)
iris, _ = material('Rex · amber iris', (.46, .225, .045), .23)
pupil, _ = material('Rex · round black pupils', (.003, .004, .003), .16)

# A packed, exportable normal map, with irregular pebbled scales rather than rings.
N = 512
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
rows = np.floor(yy / 21)
u = ((xx + (rows % 2) * 11 + np.sin(yy * .062) * 2) % 22) / 11 - 1
v = (yy % 21) / 10.5 - 1
height = np.maximum(0, 1 - u * u - v * v) ** .4
height += .035 * np.sin(xx * 1.71 + yy * .68) + .025 * np.cos(xx * .23 - yy * .39)
dy, dx = np.gradient(height)
normals = np.stack((-dx * 1.9, -dy * 1.9, np.ones_like(dx)), axis=-1)
normals /= np.linalg.norm(normals, axis=-1)[..., None]
pixels = np.ones((N, N, 4), dtype=np.float32); pixels[:, :, :3] = normals * .5 + .5
image = bpy.data.images.new('Rex pebbled scale normal · packed', width=N, height=N)
image.colorspace_settings.name = 'Non-Color'; image.pixels.foreach_set(pixels.ravel()); image.pack()
tex = skin.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image
normal = skin.node_tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = .45
skin.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color']); skin.node_tree.links.new(normal.outputs['Normal'], skin_bs.inputs['Normal'])

def paint(obj, underside=False):
    layer = obj.data.color_attributes.new(name='Hide', type='FLOAT_COLOR', domain='POINT')
    for vertex, item in zip(obj.data.vertices, layer.data):
        x, z, y = vertex.co.x, -vertex.co.y, vertex.co.z
        n = math.sin(x * 13.7 + z * 21.1 + y * 7.4) * math.sin(x * 6.1 - y * 14.6 + z * 8.2)
        stripe = max(0, math.sin(x * 4.2 + math.sin(y * 3.7) + math.cos(z * 4) * .7)) ** 5
        dorsal = max(0, min(1, (y - 2.6) / 1.35))
        base = (.205, .148, .077)
        shade = 1 - dorsal * .35 - stripe * (.21 + .12 * dorsal) + n * .14
        # Countershading on lower torso; toes and face remain richly pigmented.
        belly = max(0, 1 - abs(x + .1) / 2) * max(0, 1 - abs(y - 1.95) / .5) * max(0, 1 - abs(z) / .85)
        item.color = (base[0] * shade + belly * .08, base[1] * shade + belly * .068, base[2] * shade + belly * .04, 1)
def finish(obj, parent, mat=skin):
    obj.data.materials.append(mat)
    for f in obj.data.polygons: f.use_smooth = True
    if mat == skin: paint(obj)
    attach(obj, parent)
    return obj

def smooth_points(points, steps=8):
    pts = [np.array(p, dtype=float) for p in points]; output = []
    for i in range(len(pts) - 1):
        a, b, c, d = pts[max(0, i-1)], pts[i], pts[i+1], pts[min(len(pts)-1, i+2)]
        for j in range(steps):
            t = j / steps
            output.append(.5 * ((2*b) + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t))
    output.append(pts[-1]); return output

def loft(name, sections, parent, mat=skin, sides=40, steps=7, boxiness=1, detail=.004):
    # Sections: x, height, depth, vertical radius, lateral radius.
    points = smooth_points(sections, steps); verts = []; faces = []
    for i, point in enumerate(points):
        x, y, z, ry, rz = point; ry=max(.006, ry); rz=max(.006, rz)
        for j in range(sides):
            a = math.tau * j / sides; ca = math.cos(a); sa = math.sin(a)
            ca = math.copysign(abs(ca)**boxiness, ca); sa = math.copysign(abs(sa)**boxiness, sa)
            bump = detail * math.sin(x * 31 + j * 2.19) * math.sin(i * .67 - j * .81)
            verts.append(V((x, y + ca * (ry + bump), z + sa * (rz + bump))))
    for i in range(len(points)-1):
        for j in range(sides):
            a = i*sides+j; b = i*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides))
    faces += [tuple(reversed(range(sides))), tuple((len(points)-1)*sides+j for j in range(sides))]
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    uv = me.uv_layers.new(name='UVMap')
    for face in me.polygons:
        js = [me.loops[k].vertex_index % sides for k in face.loop_indices]; seam = 0 in js and sides-1 in js
        for k in face.loop_indices:
            vi = me.loops[k].vertex_index; j = vi % sides
            uv.data[k].uv = (vi//sides / (len(points)-1) * max(1, abs(sections[-1][0]-sections[0][0])) * 1.2, (sides if seam and j==0 else j) / sides * 1.3)
    return finish(ob, parent, mat)

def tube(name, path, radii, parent, mat=skin, sides=20, steps=5):
    points = smooth_points([(*p, *(r if isinstance(r, tuple) else (r, r))) for p, r in zip(path, radii)], steps)
    verts=[]; faces=[]
    for i, p in enumerate(points):
        center = Vector(p[:3]); tangent = Vector(points[min(i+1,len(points)-1)][:3]) - Vector(points[max(0,i-1)][:3])
        tangent.normalize(); axis = Vector((0,0,1))
        if abs(tangent.dot(axis)) > .9: axis=Vector((0,1,0))
        u=tangent.cross(axis).normalized(); v=tangent.cross(u).normalized()
        for j in range(sides):
            a=j*math.tau/sides
            verts.append(V(center + u * (math.cos(a)*max(.004,p[3])) + v * (math.sin(a)*max(.004,p[4]))))
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides; faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob)
    uv=me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        js=[me.loops[k].vertex_index%sides for k in f.loop_indices];seam=0 in js and sides-1 in js
        for k in f.loop_indices:
            vi=me.loops[k].vertex_index;j=vi%sides
            uv.data[k].uv=(vi//sides/(len(points)-1)*2,(sides if seam and j==0 else j)/sides)
    return finish(ob,parent,mat)

def ell(name, center, scale, parent, mat=skin, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings)
    o=bpy.context.object; o.name=name
    for v in o.data.vertices: v.co=V((v.co.x*scale[0]+center[0],v.co.z*scale[1]+center[1],-v.co.y*scale[2]+center[2]))
    o.location=(0,0,0); return finish(o,parent,mat)

# Mass distribution: broad barrel torso, heavy forward neck, long horizontal tail.
loft('Deep ribcage and pelvis', [(-1.85,2.8,0,.17,.2),(-1.35,2.75,0,.65,.55),(-.65,2.62,0,.94,.83),(.1,2.65,0,1.02,.86),(.72,2.79,0,.84,.69),(1.17,2.92,0,.52,.46),(1.5,3.12,0,.30,.3)], body, sides=56, steps=10)
loft('Powerful neck',[(.55,2.88,0,.58,.51),(.96,3.10,0,.62,.54),(1.35,3.47,0,.64,.53),(1.73,3.73,0,.6,.53),(2.04,3.85,0,.4,.43)], body, sides=48, steps=10)
loft('Tail muscular base',[(-3.95,3.07,.02,.27,.29),(-3.3,3.04,0,.36,.38),(-2.55,2.98,0,.44,.44),(-1.85,2.88,0,.55,.49),(-1.18,2.79,0,.55,.49)],tail,sides=40,steps=9)
loft('Tail taper',[(-7.05,3.22,.14,.008,.008),(-6.55,3.19,.14,.045,.045),(-5.9,3.14,.12,.09,.09),(-5.1,3.1,.08,.15,.16),(-4.4,3.08,.05,.23,.24),(-3.75,3.06,.015,.3,.32)],tail_tip,sides=32,steps=8)

# Deep, broad rear skull tapering into a rectangular snout: no spherical cartoon head.
loft('Tyrannosaur skull',[(1.57,3.85,0,.28,.32),(1.87,4.00,0,.60,.54),(2.2,4.03,0,.63,.64),(2.52,4.02,0,.58,.60),(2.92,3.99,0,.45,.44),(3.4,3.94,0,.39,.41),(3.92,3.92,0,.31,.38),(4.11,3.91,0,.24,.3),(4.19,3.92,0,.10,.18),(4.20,3.92,0,.01,.01)],head,sides=56,steps=10,boxiness=.72)
loft('Lower mandible',[(1.94,3.37,0,.17,.47),(2.24,3.28,0,.22,.52),(2.63,3.24,0,.18,.45),(3.05,3.28,0,.13,.38),(3.55,3.34,0,.12,.36),(4.0,3.40,0,.095,.3),(4.15,3.42,0,.045,.15)],jaw,sides=40,steps=8,boxiness=.8)
loft('Dark palate',[(2.0,3.4,0,.07,.43),(2.6,3.43,0,.065,.46),(3.2,3.51,0,.035,.36),(3.9,3.6,0,.025,.3)],head,mouth,sides=24,steps=6)
loft('Lower mouth lining',[(2.03,3.45,0,.02,.4),(2.7,3.44,0,.02,.39),(3.35,3.45,0,.02,.31),(4.02,3.49,0,.015,.25)],jaw,gums,sides=24,steps=6)
ell('Tongue',(3.15,3.48,0),(.76,.065,.22),jaw,gums)

for side in [-1,1]:
    z=side*.624
    ell('Recessed orbital shadow',(2.3,4.3,z),(.18,.13,.045),head,socket)
    ell('Amber eye',(2.34,4.31,z+side*.032),(.091,.085,.044),head,iris)
    ell('Round pupil',(2.355,4.313,z+side*.07),(.039,.051,.013),head,pupil)
    tube('Orbital boss',[(2.06,4.42,side*.53),(2.22,4.5,side*.64),(2.42,4.46,side*.66),(2.59,4.34,side*.57)],[.12,.135,.10,.035],head,sides=24)
    tube('Lower eyelid',[(2.16,4.23,side*.635),(2.32,4.20,side*.665),(2.47,4.24,side*.615)],[.04,.045,.025],head,sides=16)
    ell('Nasal opening',(3.91,4.055,side*.348),(.09,.052,.018),head,socket)
    tube('Nasal ridge',[(3.0,4.43,side*.24),(3.45,4.36,side*.27),(3.92,4.22,side*.26)],[.06,.055,.024],head,sides=16)
    tube('Cheek muscle',[(1.94,3.67,side*.47),(2.14,3.56,side*.60),(2.47,3.51,side*.52)],[.16,.16,.045],head,sides=24)
    for i in range(12):
        t=i/11;x=2.29+t*1.73;z=side*(.45-.16*t)
        y=3.43+.16*t; length=.16+.15*math.sin((t*.8+.05)*math.pi)
        tube('Upper maxillary tooth',[(x,y,z),(x-.01,y-length*.55,z*.96),(x-.065,y-length,z*.93)],[.061,.043,.003],head,tooth,sides=12,steps=3)
        tube('Lower dentary tooth',[(x,3.44+t*.055,z*.92),(x+.015,3.54+t*.055,z*.91),(x-.027,3.61+t*.05,z*.90)],[.045,.031,.003],jaw,tooth,sides=12,steps=3)
    # A handful of subdued scales at the jawline read at gameplay distance.
    for i in range(11):
        x=2.53+i*.125;z=side*(.48-(x-2.53)*.12)
        ell('Lip scale',(x,3.55+(x-2.53)*.07,z),(.035,.022,.012),head,segments=12,rings=8)

for index,side in enumerate([-1,1]):
    leg=pivot('Leg'+str(index),(-.65,2.62,side*.66),body)
    knee=pivot('Knee'+str(index),(.03,1.44,side*.79),leg)
    tube('Massive thigh',[(-.75,2.65,side*.60),(-.59,2.38,side*.76),(-.27,1.87,side*.80),(.03,1.43,side*.79)],[.56,(.58,.47),(.40,.36),.26],leg,sides=36,steps=10)
    tube('Angled lower leg',[(.03,1.5,side*.79),(-.18,1.2,side*.8),(-.43,.74,side*.82),(-.40,.43,side*.83),(-.16,.23,side*.83)],[.26,.22,.145,.14,.18],knee,sides=28,steps=10)
    for toe_index in [-1,0,1]:
        z=side*.83+toe_index*.16
        end_x=.73-(.11 if toe_index else 0)
        tube('Three weight bearing toes',[(-.17,.2,z),(.11,.145,z+toe_index*.10),(end_x,.11,z+toe_index*.17)],[.13,.10,.052],knee,sides=20,steps=6)
        tube('Foot claw',[(end_x-.025,.115,z+toe_index*.17),(end_x+.13,.1,z+toe_index*.18),(end_x+.20,.045,z+toe_index*.19)],[.061,.038,.003],knee,horn,sides=14,steps=4)
    tube('Raised hallux',[(-.37,.45,side*.68),(-.62,.32,side*.62),(-.71,.30,side*.61)],[.07,.043,.005],knee,horn,sides=16)
    arm=pivot('Arm'+str(index),(1.04,2.91,side*.53),body)
    tube('Short muscular upper arm',[(1.02,2.9,side*.57),(1.12,2.61,side*.77),(1.2,2.42,side*.8)],[.17,.125,.09],arm,sides=24)
    tube('Inward facing forearm',[(1.2,2.42,side*.8),(1.4,2.40,side*.78),(1.6,2.48,side*.69)],[.095,.076,.065],arm,sides=20)
    for finger in [-1,1]:
        z=side*.69+finger*.052
        tube('Two fingers',[(1.57,2.48,z),(1.71,2.45,z),(1.75,2.37,z)],[.047,.033,.021],arm,sides=14)
        tube('Hand claw',[(1.75,2.38,z),(1.82,2.31,z),(1.82,2.26,z)],[.031,.022,.003],arm,horn,sides=12)

# Slightly open resting jaw; runtime rotates relative to this transform.
jaw.rotation_euler.y = .19
bpy.context.view_layer.update()
print(json.dumps({'scene':scene.name,'objects':len(scene.objects),'vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH')}))
