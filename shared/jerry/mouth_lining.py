import bpy, math

old=bpy.data.objects.get('Jerry_Oral_cavity')
old.hide_render=True; old.hide_set(True)
for name in ['Jerry_Mouth_lining','Jerry_Smile_lip']:
    o=bpy.data.objects.get(name)
    if o: bpy.data.objects.remove(o,do_unlink=True)

def mesh_object(name,verts,faces,mat,weights):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
    o=bpy.data.objects.new(name,m);bpy.context.scene.collection.objects.link(o)
    o.parent=bpy.data.objects['Jerry_Rig']
    m.materials.append(bpy.data.materials[mat])
    for p in m.polygons:p.use_smooth=True
    for bone,vals in weights.items():
        g=o.vertex_groups.new(name=bone)
        for i,w in enumerate(vals):
            if w>0:g.add([i],w,'REPLACE')
    mod=o.modifiers.new('Jerry facial deformation','ARMATURE');mod.object=bpy.data.objects['Jerry_Rig']
    return o

# A recessed bowl with its opening tucked into the lip, cheeks and upper palate.
verts=[];faces=[];jw=[];N=80;R=18
for j in range(R):
    t=j/(R-1); r=math.cos(t*math.pi/2)*.999+.001
    for i in range(N):
        a=2*math.pi*i/N
        x=.298*math.cos(a)*r
        z=1.362+.170*math.sin(a)*r
        edge_y=-.502+.225*abs(math.cos(a))**1.65
        y=edge_y*(1-math.sin(t*math.pi/2))-.075*math.sin(t*math.pi/2)
        verts.append((x,y,z));jw.append(max(0,min(1,(1.44-z)/.18))*(1-t*.6))
        if j<R-1:
            a0=j*N+i;b0=j*N+(i+1)%N
            faces.append((a0,b0,b0+N,a0+N))
faces.append(tuple(range((R-1)*N,R*N)))
mesh_object('Jerry_Mouth_lining',verts,faces,'Mouth | warm shadow',{'jaw':jw,'head':[1-w for w in jw]})

print('Recessed mouth lining rebuilt; the existing textured jaw supplies the lip')
