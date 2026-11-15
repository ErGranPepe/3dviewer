import json,urllib.request,urllib.parse,os,time,io
from PIL import Image
UA={'User-Agent':'CircuitRefBot/1.0 (reference photos for a hobby racing sim; contact via github ErGranPepe/3dviewer)'}
API='https://commons.wikimedia.org/w/api.php?'
def api(**p):
    p.update(format='json')
    for t in range(3):
        try:return json.loads(urllib.request.urlopen(urllib.request.Request(API+urllib.parse.urlencode(p),headers=UA),timeout=60).read())
        except Exception as e:print('retry',e,flush=True);time.sleep(3)
    return {}
def get(u):
    for t in range(3):
        try:return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
        except Exception as e:print('retry',u[:80],e,flush=True);time.sleep(3)
C={'Sakhir':'Bahrain International Circuit','Melbourne':'Albert Park Circuit','Suzuka':'Suzuka Circuit','Shanghai':'Shanghai International Circuit','Montreal':'Circuit Gilles Villeneuve','Catalunya':'Circuit de Barcelona-Catalunya','Spielberg':'Red Bull Ring','Silverstone':'Silverstone Circuit','Budapest':'Hungaroring','Spa':'Circuit de Spa-Francorchamps','Zandvoort':'Circuit Zandvoort','Monza':'Autodromo Nazionale di Monza','Austin':'Circuit of the Americas','MexicoCity':'Autódromo Hermanos Rodríguez','SaoPaulo':'Autódromo José Carlos Pace','YasMarina':'Yas Marina Circuit'}
os.makedirs('refs',exist_ok=True);man={}
for key,name in C.items():
    cats=['Category:'+name]
    s=api(action='query',list='search',srsearch=name,srnamespace=14,srlimit=8)
    for r in s.get('query',{}).get('search',[]):
        if r['title'] not in cats:cats.append(r['title'])
    files=[];seen=set()
    for cat in cats[:6]:
        for depth in range(2):
            d=api(action='query',generator='categorymembers',gcmtitle=cat,gcmtype='file|subcat',gcmlimit=200,prop='imageinfo',iiprop='url|size|mime',iiurlwidth=1000)
            pages=d.get('query',{}).get('pages',{}).values()
            sub=[]
            for pg in pages:
                if pg.get('ns')==14:sub.append(pg['title']);continue
                ii=(pg.get('imageinfo') or [{}])[0]
                if ii.get('mime') not in('image/jpeg','image/png'):continue
                if ii.get('width',0)<1200 or pg['title'] in seen:continue
                seen.add(pg['title']);files.append((pg['title'],ii.get('thumburl') or ii.get('url'),ii.get('descriptionurl')))
            if depth==0 and sub:
                for sc in sub[:8]:
                    d2=api(action='query',generator='categorymembers',gcmtitle=sc,gcmtype='file',gcmlimit=60,prop='imageinfo',iiprop='url|size|mime',iiurlwidth=1000)
                    for pg in d2.get('query',{}).get('pages',{}).values():
                        ii=(pg.get('imageinfo') or [{}])[0]
                        if ii.get('mime') not in('image/jpeg','image/png') or ii.get('width',0)<1200 or pg['title'] in seen:continue
                        seen.add(pg['title']);files.append((pg['title'],ii.get('thumburl') or ii.get('url'),ii.get('descriptionurl')))
            break
    # preferencia: fotos recientes (nombres con años altos) y variadas
    def score(f):
        t=f[0];import re;ys=[int(y) for y in re.findall(r'(20[0-2][0-9])',t)];return -(max(ys) if ys else 2000)
    files.sort(key=score);files=files[:36]
    os.makedirs('refs/'+key,exist_ok=True);out=[]
    for n,(t,u,du) in enumerate(files):
        b=get(u)
        if not b:continue
        try:
            im=Image.open(io.BytesIO(b)).convert('RGB');im.thumbnail((1000,1000));p=f'refs/{key}/{n:02d}.jpg';im.save(p,quality=80);out.append({'f':p,'title':t,'page':du})
        except Exception as e:print('bad',e)
    man[key]=out;print(key,len(cats),'cats',len(out),'fotos',flush=True)
json.dump(man,open('refs/manifest.json','w'),indent=1)
# lista completa de modelos de Poly Haven (nombres y categorías) para elegir a mano
try:
    M=json.loads(get('https://api.polyhaven.com/assets?t=models'))
    json.dump({k:{'c':v.get('categories',[]),'t':v.get('tags',[])} for k,v in M.items()},open('refs/polyhaven_models.json','w'))
    print('polyhaven modelos',len(M))
except Exception as e:print('ph',e)
