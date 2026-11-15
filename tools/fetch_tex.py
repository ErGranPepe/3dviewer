"""Texturas CC0 de ambientCG para fachadas, aceras y muros: descarga 1K-JPG, extrae color/normal/rugosidad y reduce a 512 px."""
import json,urllib.request,os,io,zipfile,time
from PIL import Image
UA={'User-Agent':'Mozilla/5.0 (tex-fetch)'}
def get(url,tries=3):
    for t in range(tries):
        try:return urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=120).read()
        except Exception as e:print('retry',url[:100],e,flush=True);time.sleep(3)
    return None
os.makedirs('tex',exist_ok=True);man=[]
QUERIES=[('grass',10),('ground',12),('rock',8),('fabric',8),('pavingstones',10),('gravel',4),('cliff',3),('moss',2),('leather',2),('rubber',2),('carpet',2),('road',4),('planks',2)]
seen=set()
for q,lim in QUERIES:
    d=get('https://ambientcg.com/api/v2/full_json?type=Material&q=%s&limit=%d&include=downloadData,tagData'%(q,lim))
    if not d:continue
    for a in json.loads(d).get('foundAssets',[]):
        aid=a['assetId']
        if aid in seen:continue
        seen.add(aid)
        dl=[x for f in a.get('downloadFolders',{}).values() for c in f.get('downloadFiletypeCategories',{}).values() for x in c.get('downloads',[])]
        z=[x for x in dl if x.get('attribute')=='1K-JPG']
        if not z:continue
        b=get(z[0]['fullDownloadPath'] if 'fullDownloadPath' in z[0] else z[0]['downloadLink'])
        if not b:continue
        try:zf=zipfile.ZipFile(io.BytesIO(b))
        except Exception as e:print('zip',aid,e);continue
        got={}
        for n in zf.namelist():
            ln=n.lower()
            kind='color' if '_color' in ln else 'normal' if '_normalgl' in ln else 'rough' if '_roughness' in ln else None
            if not kind or not ln.endswith('.jpg'):continue
            im=Image.open(io.BytesIO(zf.read(n))).convert('RGB' if kind!='rough' else 'L').resize((512,512),Image.LANCZOS)
            p='tex/%s_%s.jpg'%(aid,kind);im.save(p,quality=86);got[kind]=p
        if 'color' in got:man.append({'id':aid,'q':q,'tags':a.get('tags',[]),'files':got,'src':'ambientCG (CC0)'});print('tex',aid,list(got),flush=True)
json.dump(man,open('tex/manifest.json','w'),indent=1)
print('TOTAL',len(man))
