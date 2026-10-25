"""Builds site/float.js (clean, for deploy) and site/float.debug.js (with ?debug tools, local only) from src/float.src.js.
Run from anywhere:  python src/build.py"""
import os,re
here=os.path.dirname(os.path.abspath(__file__)); site=os.path.join(here,'..')
src=open(os.path.join(here,'float.src.js'),encoding='utf-8').read()
# debug build: just drop the marker comments
dbg=re.sub(r'^//#debug-(start|end)\n','',src,flags=re.M).replace(' //#d','')
# production build: remove debug blocks and flagged lines
prod=re.sub(r'^//#debug-start\n.*?^//#debug-end\n','',src,flags=re.S|re.M)
prod='\n'.join(l for l in prod.split('\n') if not l.rstrip().endswith('//#d'))
open(os.path.join(site,'float.js'),'w',encoding='utf-8',newline='\n').write(prod)
open(os.path.join(site,'float.debug.js'),'w',encoding='utf-8',newline='\n').write(dbg)
print('built float.js (%d bytes, clean) and float.debug.js (%d bytes, local only)'%(len(prod),len(dbg)))
# stamp the cache-busting versions into the pages
import runpy; runpy.run_path(os.path.join(here,'stamp.py'))
