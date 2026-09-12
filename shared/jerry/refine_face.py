"""Jerry revision 6: preserve topology, UVs, nostril bores and rig weights."""
import bpy, math, os
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))

def smooth(t):
    t=max(0,min(1,t)); return t*t*(3-2*t)

def interp(z,knots):
    if z<=knots[0][0]: return knots[0][1]
    slopes=[(knots[i+1][1]-knots[i][1])/(knots[i+1][0]-knots[i][0]) for i in range(len(knots)-1)]
    tangents=[slopes[0]]
    for d,e in zip(slopes,slopes[1:]): tangents.append(2*d*e/(d+e) if d*e>0 else 0)
    tangents.append(slopes[-1])
    for i,((a,x),(b,y)) in enumerate(zip(knots,knots[1:])):
        if z<=b:
            t=(z-a)/(b-a)
            return (2*t**3-3*t*t+1)*x+(t**3-2*t*t+t)*(b-a)*tangents[i]+(-2*t**3+3*t*t)*y+(t**3-t*t)*(b-a)*tangents[i+1]
    return knots[-1][1]

# Keep an in-memory baseline so refinement can be rerun without accumulating edits.
names=['Jerry_Beak_and_jaw','Jerry_Tongue','Jerry_Oral_cavity','Jerry_Broad_bridge']
names += [o.name for o in bpy.data.objects if o.name.startswith(('Jerry_Rounded_frames','Jerry_Temple_band','Jerry_Frame_pin','Jerry_Nostril_'))]
for name in names:
    o=bpy.data.objects[name]
    key='R5_BASE_'+name
    if key not in bpy.data.meshes:
        baseline=o.data.copy(); baseline.name=key; baseline.use_fake_user=True
    baseline=bpy.data.meshes[key]
    for v,src in zip(o.data.vertices,baseline.vertices): v.co=src.co

beak=bpy.data.objects['Jerry_Beak_and_jaw']
src=bpy.data.meshes['R5_BASE_Jerry_Beak_and_jaw']
source=[]
for j in range(36):
    vs=list(src.vertices)[j*64:(j+1)*64]
    source.append((vs[0].co.z,max(abs(v.co.x) for v in vs),min(v.co.y for v in vs),max(v.co.y for v in vs)))
source.sort()

# Cross sections: a broad cheek-to-beak root and a tapered, forward hooked tip.
width=[(1.284,.003),(1.295,.015),(1.31,.035),(1.33,.064),(1.355,.098),(1.38,.133),(1.41,.176),(1.435,.210),(1.465,.235),(1.495,.228),(1.525,.207),(1.55,.179),(1.575,.150),(1.60,.119),(1.625,.091),(1.65,.068),(1.675,.050)]
front=[(1.284,-.590),(1.30,-.607),(1.33,-.616),(1.36,-.617),(1.40,-.612),(1.44,-.599),(1.48,-.583),(1.52,-.564),(1.56,-.539),(1.60,-.507),(1.64,-.463),(1.675,-.418)]
back=[(1.284,-.584),(1.30,-.563),(1.33,-.506),(1.36,-.445),(1.40,-.350),(1.44,-.279),(1.48,-.250),(1.52,-.244),(1.56,-.243),(1.60,-.246),(1.64,-.256),(1.675,-.269)]
def beak_point(co):
    x,y,z=co
    w=interp(z,[(r[0],r[1]) for r in source])
    f=interp(z,[(r[0],r[2]) for r in source]); b=interp(z,[(r[0],r[3]) for r in source])
    t=(y-b)/max(.0001,b-f)
    new_z=interp(z,[(1.284,1.284),(1.40,1.38),(1.465,1.418),(1.505,1.455),(1.55,1.51),(1.60,1.588),(1.675,1.675)])
    return (x*interp(z,width)/max(.003,w),interp(z,back)+t*(interp(z,back)-interp(z,front)),new_z)
for v in beak.data.vertices:
    if v.index<2502: v.co=beak_point(v.co)
    else:
        x,y,z=v.co
        forward=smooth((-.06-y)/.40)
        v.co.x=x*(1-.04*forward)
        v.co.y=y-.040*forward
        v.co.z=z + .032*smooth((1.30-z)/.20) + .060*forward*(abs(x)/.337)**1.6
for o in bpy.data.objects:
    if o.name.startswith('Jerry_Nostril_'):
        for v in o.data.vertices: v.co=beak_point(v.co)

for v in bpy.data.objects['Jerry_Tongue'].data.vertices:
    x,y,z=v.co
    v.co=(x*.88,-.36+(y+.345)*1.30,1.266+(z-1.2765)*1.65 + (y+.345)*.25)
for v in bpy.data.objects['Jerry_Oral_cavity'].data.vertices:
    x,y,z=v.co
    v.co=(x*1.13,-.20+(y+.195)*1.25,1.355+(z-1.354)*1.10)

# The front follows the snout's curvature. Both temples flare around the skull.
def frame_shift(x,z=1.73): return .032+.25*(.4-min(.4,abs(x)))
for o in bpy.data.objects:
    if o.name.startswith(('Jerry_Rounded_frames','Jerry_Frame_pin')) or o.name=='Jerry_Broad_bridge':
        for v in o.data.vertices:
            v.co.z=1.815+(v.co.z-1.815)*.88
            v.co.y-=frame_shift(v.co.x,v.co.z)
    if o.name.startswith('Jerry_Temple_band'):
        for v in o.data.vertices:
            x,y,z=v.co
            v.co.y-=frame_shift(x)*smooth((.10-y)/.49)
            v.co.x+=math.copysign(.008*smooth((y+.39)/.16),x)
            v.co.z+=.008*smooth((.10-y)/.49)

for name in names: bpy.data.objects[name].data.update()
# Keep the rolled lip golden while shading the inner jaw as mouth tissue.
dark=bpy.data.materials['Mouth | warm shadow']
if dark.name not in beak.data.materials: beak.data.materials.append(dark)
dark_index=list(beak.data.materials).index(dark)
for p in beak.data.polygons:
    p.material_index=dark_index if min(p.vertices)>=2502+20*64 else 0
bpy.context.view_layer.update()
print('Revision 6 face geometry applied')
