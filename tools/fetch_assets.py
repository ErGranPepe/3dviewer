import json,urllib.request,urllib.parse,os,io,zipfile,time
from PIL import Image
UA={'User-Agent':'Mozilla/5.0 (asset-fetch)'}
def get(url,tries=3):
    for t in range(tries):
        try:return urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=90).read()
        except Exception as e:print('retry',url[:110],e,flush=True);time.sleep(3)
    return None
os.makedirs('out/tex',exist_ok=True);os.makedirs('out/models',exist_ok=True);man={'tex':[],'models':[],'hdri':[]}
Q={}
# ---------- Poly Haven (CC0): modelos ----------
d=get('https://api.polyhaven.com/assets?t=models')
if d:
    M=json.loads(d)
    def score(k,v):
        t=(k+' '+' '.join(v.get('tags',[]))+' '+' '.join(v.get('categories',[]))).lower()
        if any(w in t for w in('tree','shrub','bush','hedge','pine','palm','fir')) and not any(w in t for w in('indoor','pot','vase','dead','trunk','branch','log','stump')):return 3
        if any(w in t for w in('road barrier','traffic cone','barrier','bollard','road sign','street lamp','streetlight','lamppost','fire hydrant','trash bin','bin','bench','pallet','tire','tyre','jersey','fence')):return 2
        return 0
    pick=sorted([k for k,v in M.items() if score(k,v)],key=lambda k:-score(k,M[k]))[:60]
    print('elegidos',pick,flush=True)
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
json.dump(man,open('out/manifest.json','w'),indent=1)
print('TOTAL tex',len(man['tex']),'models',len(man['models']),'hdri',len(man['hdri']))
