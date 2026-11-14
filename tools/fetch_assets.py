import json,urllib.request,urllib.parse,os,io,zipfile,time
from PIL import Image
UA={'User-Agent':'Mozilla/5.0 (asset-fetch)'}
def get(url,tries=3):
    for t in range(tries):
        try:return urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=90).read()
        except Exception as e:print('retry',url[:110],e,flush=True);time.sleep(3)
    return None
os.makedirs('out/tex',exist_ok=True);os.makedirs('out/models',exist_ok=True);man={'tex':[],'models':[],'hdri':[]}
# ---------- ambientCG (CC0) ----------
Q={'facade':8,'roofing tiles':4,'bricks':5,'paving stones':4,'asphalt':6,'gravel':5,'ground sand':4,'grass':5,'concrete':5,'chainlink fence':2,'plaster':4,'corrugated steel':3,'tiles':3,'road':3,'sand':4,'rock':3,'leaf set':4,'metal walkway':2}
seen=set()
for q,n in Q.items():
    d=get('https://ambientcg.com/api/v2/full_json?'+urllib.parse.urlencode({'type':'Material','q':q,'limit':n,'sort':'Popular','include':'downloadData,tagData'}))
    if not d:print('sin respuesta ambientcg',q);continue
    for a in json.loads(d).get('foundAssets',[]):
        aid=a['assetId']
        if aid in seen:continue
        seen.add(aid);url=None
        for cat in a.get('downloadFolders',{}).get('default',{}).get('downloadFiletypeCategories',{}).values():
            for dl in cat.get('downloads',[]):
                if dl.get('attribute')=='2K-JPG':url=dl.get('fullDownloadPath') or dl.get('downloadLink')
        if not url:continue
        z=get(url)
        if not z:continue
        try:
            zf=zipfile.ZipFile(io.BytesIO(z));keep={}
            for nm in zf.namelist():
                low=nm.lower()
                for k,tag in(('color','_color'),('normal','_normalgl'),('rough','_roughness'),('ao','_ambientocclusion'),('opacity','_opacity'),('disp','_displacement')):
                    if tag in low and low.endswith('.jpg'):
                        im=Image.open(io.BytesIO(zf.read(nm)));im=im.convert('L' if k in('rough','ao','opacity','disp') else 'RGB')
                        if max(im.size)>1024:im=im.resize((1024,int(1024*im.size[1]/im.size[0])),Image.LANCZOS)
                        p=f'tex/{aid}_{k}.jpg';im.save('out/'+p,quality=86,optimize=True);keep[k]=p
            man['tex'].append({'id':aid,'q':q,'tags':a.get('tags',[]),'files':keep,'src':'ambientCG (CC0)'});print('ok',aid,list(keep),flush=True)
        except Exception as e:print('zip',aid,e)
# ---------- Poly Haven (CC0): modelos ----------
d=get('https://api.polyhaven.com/assets?t=models')
if d:
    M=json.loads(d);want=('tree','shrub','bush','plant','fern','grass','barrier','fence','lamp','bench','cone','pallet','crate','barrel','tyre','tire','bollard','sign','container','chair','umbrella','flag','camera','truck','van','car')
    pick=[k for k,v in M.items() if any(w in (k+' '+' '.join(v.get('tags',[]))+' '+' '.join(v.get('categories',[]))).lower() for w in want)][:70]
    for aid in pick:
        f=get('https://api.polyhaven.com/files/'+aid)
        if not f:continue
        F=json.loads(f);g=F.get('gltf',{}).get('1k',{}).get('gltf')
        if not g:continue
        base=f'models/{aid}';os.makedirs('out/'+base,exist_ok=True);ok=True
        for rel,info in [(aid+'.gltf',g)]+list(g.get('include',{}).items()):
            b=get(info['url'])
            if not b:ok=False;break
            path='out/'+base+'/'+os.path.basename(rel) if rel==aid+'.gltf' else 'out/'+base+'/'+rel
            os.makedirs(os.path.dirname(path),exist_ok=True);open(path,'wb').write(b)
        if ok:man['models'].append({'id':aid,'tags':M[aid].get('tags',[]),'cats':M[aid].get('categories',[]),'dir':base,'src':'Poly Haven (CC0)'});print('modelo',aid,flush=True)
# HDRI cielos (CC0)
d=get('https://api.polyhaven.com/assets?t=hdris&c=outdoor')
if d:
    H=json.loads(d);sky=[k for k,v in H.items() if 'clear' in ' '.join(v.get('tags',[])) or 'sunny' in k or 'sky' in k][:6]+['kloofendal_48d_partly_cloudy_puresky','qwantani_dusk_2_puresky','kloppenheim_06_puresky','moonless_golf']
    for aid in sky:
        f=get('https://api.polyhaven.com/files/'+aid)
        if not f:continue
        F=json.loads(f);u=F.get('hdri',{}).get('2k',{}).get('hdr',{}).get('url')
        if not u:continue
        b=get(u)
        if b:os.makedirs('out/hdri',exist_ok=True);open(f'out/hdri/{aid}_2k.hdr','wb').write(b);man['hdri'].append(aid);print('hdri',aid,flush=True)
json.dump(man,open('out/manifest.json','w'),indent=1)
print('TOTAL tex',len(man['tex']),'models',len(man['models']),'hdri',len(man['hdri']))
