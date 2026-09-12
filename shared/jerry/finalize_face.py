import bpy, json, os, struct
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
skin_names=['Jerry_Skin','Jerry_Beak_and_jaw','Jerry_Eyes','Jerry_Nostril_rim','Jerry_Nostril_rim.001']
frames=[o for o in scene.objects if o.name.startswith(('Jerry_Rounded_frames','Jerry_Temple_band','Jerry_Frame_pin')) or o.name=='Jerry_Broad_bridge']
report={'revision':6,'frames':{}}
for frame in [1,23,45,68,90]:
    scene.frame_set(frame);bpy.context.view_layer.update()
    dg=bpy.context.evaluated_depsgraph_get()
    skin={n:BVHTree.FromObject(bpy.data.objects[n],dg) for n in skin_names}
    results={}
    for o in frames:
        tree=BVHTree.FromObject(o,dg)
        overlaps={n:len(tree.overlap(b)) for n,b in skin.items()}
        assert not any(overlaps.values()),(frame,o.name,overlaps)
        ev=o.evaluated_get(dg)
        clearance=min(b.find_nearest(v.co)[3] for v in ev.data.vertices for b in skin.values())
        results[o.name]={'intersection_pairs':sum(overlaps.values()),'minimum_vertex_clearance':round(clearance,6)}
    report['frames'][str(frame)]=results
scene.frame_set(1)
# Save a separate candidate; the existing shared source and runtime stay intact.
blend_out=os.path.join(ROOT,'Jerry_Character_Rev6.blend')
glb_out=os.path.join(ROOT,'Jerry_Game_Rev6.glb')
assert not os.path.exists(blend_out) and not os.path.exists(glb_out), 'Revision output already exists'
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.name.startswith('Jerry_') and o.type in {'MESH','ARMATURE'} and not o.hide_render:
        o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=bpy.data.objects['Jerry_Rig']
scene['Jerry_revision']='6 - reference beak profile, smile and glasses clearance'
bpy.ops.wm.save_as_mainfile(filepath=blend_out)
bpy.ops.export_scene.gltf(filepath=glb_out,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_yup=True,export_apply=False)
with open(glb_out,'rb') as f:
    head=f.read(12);length,kind=struct.unpack('<II',f.read(8));data=json.loads(f.read(length))
assert data['asset']['version']=='2.0'
assert all('uri' not in im for im in data.get('images',[]))
assert not data.get('cameras')
assert all('Studio' not in n.get('name','') for n in data['nodes'])
joint_names=set(data['nodes'][j]['name'] for s in data['skins'] for j in s['joints'])
required={'head','jaw','thigh.L','thigh.R','upper_arm.L','upper_arm.R','tail.01','propeller'}
assert required<=joint_names,(required-joint_names)
report['export']={'triangles':sum(data['accessors'][p['indices']]['count']//3 for m in data['meshes'] for p in m['primitives']),'bones':len(joint_names),'animations':[a.get('name') for a in data.get('animations',[])],'embedded_images':len(data.get('images',[])),'bytes':os.path.getsize(glb_out)}
with open(os.path.join(ROOT,'review','validation.json'),'w') as f:json.dump(report,f,indent=2)
print(json.dumps(report['export']))
print('Saved revision 6 and exported GLB; five sampled idle poses pass glasses collision checks')
