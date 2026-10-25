"""Cache-busting for deploys: stamps ?v=<hash of the file's contents> onto the links to style.css and float.js in every page,
so a browser never pairs new HTML with an old cached stylesheet or script. The hash only changes when the file's contents change.
Run before you deploy (build.py runs it too):   python src/stamp.py"""
import glob,hashlib,os,re
here=os.path.dirname(os.path.abspath(__file__)); site=os.path.join(here,'..')
def h(name): return hashlib.md5(open(os.path.join(site,name),'rb').read()).hexdigest()[:8]
v={'style.css':h('style.css'),'float.js':h('float.js')}
changed=0
for page in sorted(glob.glob(os.path.join(site,'*.html'))):
    s=o=open(page,encoding='utf-8').read()
    s=re.sub(r'href="style\.css(\?v=[^"]*)?"','href="style.css?v=%s"'%v['style.css'],s)
    s=re.sub(r"'float\.js(\?v=[^']*)?'","'float.js?v=%s'"%v['float.js'],s)
    if s!=o: open(page,'w',encoding='utf-8',newline='\n').write(s); changed+=1
print('stamped style.css?v=%s float.js?v=%s (%d page(s) updated)'%(v['style.css'],v['float.js'],changed))
