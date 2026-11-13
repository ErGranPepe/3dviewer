import json,urllib.request,urllib.parse,time,math,os
G=json.load(open('tools/f1-circuits.geojson'))
IDS=['bh-2002','au-1953','jp-1962','cn-2004','ca-1978','es-1991','at-1969','gb-1948','hu-1986','be-1925','nl-1948','it-1922','us-2012','mx-1962','br-1940','ae-2009','mc-1929']
EP=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter']
os.makedirs('out',exist_ok=True)
def get(url,data=None,tries=4):
    for t in range(tries):
        try:
            req=urllib.request.Request(url,data=data,headers={'User-Agent':'osm-circuit-fetch/1.0'})
            return urllib.request.urlopen(req,timeout=300).read()
        except Exception as e:
            print('retry',url[:60],e,flush=True);time.sleep(15*(t+1))
    return None
for fid in IDS:
    f=[x for x in G['features'] if x['properties']['id']==fid][0]
    xs=[c[0] for c in f['geometry']['coordinates']];ys=[c[1] for c in f['geometry']['coordinates']]
    lat0=sum(ys)/len(ys);mlat=1100/111320;mlon=1100/(111320*math.cos(math.radians(lat0)))
    s,w,n,e=min(ys)-mlat,min(xs)-mlon,max(ys)+mlat,max(xs)+mlon;bb=f'{s:.6f},{w:.6f},{n:.6f},{e:.6f}'
    q=f'''[out:json][timeout:240];(
way["building"]({bb});relation["building"]({bb});way["building:part"]({bb});
way["landuse"]({bb});relation["landuse"]({bb});way["natural"]({bb});relation["natural"]({bb});way["leisure"]({bb});relation["leisure"]({bb});
node["natural"="tree"]({bb});way["waterway"]({bb});way["highway"]({bb});way["amenity"="parking"]({bb});way["barrier"]({bb});way["railway"]({bb});
way["man_made"]({bb});node["man_made"]({bb});way["power"="line"]({bb});node["power"="tower"]({bb});
);out geom;'''
    if not os.path.exists(f'out/{fid}.osm.json'):
        data=None
        for ep in EP:
            data=get(ep,urllib.parse.urlencode({'data':q}).encode())
            if data and data[:1]==b'{':break
            time.sleep(20)
        if data:open(f'out/{fid}.osm.json','wb').write(data);print(fid,'osm',len(data),flush=True)
        time.sleep(8)
    z=14;os.makedirs(f'out/dem_{fid}',exist_ok=True)
    def tx(lon):return int((lon+180)/360*2**z)
    def ty(lat):r=math.radians(lat);return int((1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**z)
    for X in range(tx(w),tx(e)+1):
        for Y in range(ty(n),ty(s)+1):
            p=f'out/dem_{fid}/{z}_{X}_{Y}.png'
            if os.path.exists(p):continue
            d=get(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{X}/{Y}.png')
            if d:open(p,'wb').write(d)
    json.dump({'bbox':[s,w,n,e],'z':z},open(f'out/dem_{fid}/meta.json','w'))
    print(fid,'dem ok',flush=True)
