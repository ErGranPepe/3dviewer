# Integridad de lo publicado: todo archivo local que citan index.html, lab.html y privacidad.html (y los a/*.js entre comillas con
# rutas t/… o a/…) existe en /home/claude/pages, y la rama publicada coincide con la local.
import re,os,subprocess,json,sys
P='/home/claude/pages'; bad=[]; n=0
def chk(ref,src):
    global n
    f=ref.split('?')[0].split('#')[0]
    if not f or f.startswith(('http:','https:','data:','mailto:','#','//')): return
    n+=1
    if not os.path.exists(os.path.join(P,f)) and not os.path.exists(os.path.join(P,f+'.html')): bad.append((src,ref))
for page in ('index.html','lab.html','privacidad.html'):
    s=open(os.path.join(P,page),encoding='utf8').read()
    for m in re.finditer(r'(?:src|href)="([^"]+)"',s): chk(m.group(1),page)
for js in os.listdir(os.path.join(P,'a')):
    s=open(os.path.join(P,'a',js),encoding='utf8',errors='ignore').read()
    for m in re.finditer(r'["\'`]((?:t|a)/[A-Za-z0-9_.\-/]+\.(?:json|jpg|png|bin|js|webp|ktx2|hdr|glb))["\'`]',s): chk(m.group(1),'a/'+js)
loc=subprocess.run(['git','-C',P,'rev-parse','HEAD'],capture_output=True,text=True).stdout.strip()
rem=subprocess.run(['gh','api','repos/ErGranPepe/3dviewer/branches/gh-pages','--jq','.commit.sha'],capture_output=True,text=True).stdout.strip()
dirty=subprocess.run(['git','-C',P,'status','--short'],capture_output=True,text=True).stdout.strip()
pg=subprocess.run(['gh','api','repos/ErGranPepe/3dviewer/pages'],capture_output=True,text=True).stdout
try: pj=json.loads(pg); pinfo={k:pj.get(k) for k in ('html_url','status','https_enforced','public')}; pinfo['rama']=pj.get('source',{}).get('branch')
except Exception: pinfo=pg[:200]
print('referencias comprobadas',n,'| rotas',len(bad),bad[:8])
print('rama local',loc[:7],'| rama publicada',rem[:7],'| iguales',loc==rem,'| cambios sin publicar:',bool(dirty))
print('GitHub Pages:',pinfo)
sys.exit(1 if bad or loc!=rem else 0)
