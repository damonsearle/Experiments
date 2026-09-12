import bpy, sys, os, json
from mathutils import Vector
root=os.path.dirname(os.path.abspath(__file__))
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
bpy.ops.wm.open_mainfile(filepath=os.path.join(root,args[0] if args else 'Jerry_Character.blend'))
s=bpy.context.scene
s.frame_set(1)
s.render.engine='CYCLES'
s.cycles.samples=24
s.cycles.use_denoising=True
s.render.resolution_x=800
s.render.resolution_y=900
s.render.resolution_percentage=100
s.render.image_settings.file_format='PNG'
cam=s.camera
cam.data.type='ORTHO'; cam.data.ortho_scale=1.32
os.makedirs(os.path.join(root,'review'),exist_ok=True)
for label,loc in [('front',(0,-5,1.75)),('three_quarter',(3,-5,1.85)),('side',(5,-0.4,1.75))]:
    cam.location=loc; cam.rotation_euler=(Vector((0,-.06,1.59))-cam.location).to_track_quat('-Z','Y').to_euler()
    s.render.filepath=os.path.join(root,'review',(args[1] if len(args)>1 else 'before')+'_'+label+'.png')
    bpy.ops.render.render(write_still=True)
