import json,urllib.request,time,math,os,io
from PIL import Image
G=json.load(open('tools/f1-circuits.geojson'))
SRC={
 'es-1991':('https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{ty}.jpeg','PNOA cedido por © Instituto Geográfico Nacional (CC BY 4.0)'),
 'nl-1948':('https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg','Luchtfoto © Beeldmateriaal Nederland / PDOK (CC BY 4.0)'),
 'at-1969':('https://maps.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg','Orthofoto © basemap.at (CC BY 4.0)'),
 'jp-1962':('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg','出典: 国土地理院 (GSI Japan)'),
 'us-2012':('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}','USGS The National Map (dominio público)'),
}
os.makedirs('sat',exist_ok=True)
def get(url):
    for t in range(4):
        try:return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'circuit-sat-fetch/1.0'}),timeout=60).read()
        except Exception as e:print('retry',url[:90],e,flush=True);time.sleep(5*(t+1))
    return None
for fid,(tpl,attr) in SRC.items():
    f=[x for x in G['features'] if x['properties']['id']==fid][0]
    xs=[c[0] for c in f['geometry']['coordinates']];ys=[c[1] for c in f['geometry']['coordinates']]
    lat0=sum(ys)/len(ys);mlat=1100/111320;mlon=1100/(111320*math.cos(math.radians(lat0)))
    s,w,n,e=min(ys)-mlat,min(xs)-mlon,max(ys)+mlat,max(xs)+mlon
    z=17
    def fx(lon):return (lon+180)/360*2**z
    def fy(lat):r=math.radians(lat);return (1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**z
    X0,X1,Y0,Y1=int(fx(w)),int(fx(e)),int(fy(n)),int(fy(s))
    W,H=(X1-X0+1)*256,(Y1-Y0+1)*256;img=Image.new('RGB',(W,H),(90,100,80));ok=0
    for X in range(X0,X1+1):
        for Y in range(Y0,Y1+1):
            d=get(tpl.format(z=z,x=X,y=Y,ty=2**z-1-Y))
            if not d:continue
            try:img.paste(Image.open(io.BytesIO(d)).convert('RGB'),((X-X0)*256,(Y-Y0)*256));ok+=1
            except Exception as ex:print('bad',ex)
    l,t,r_,b=(fx(w)-X0)*256,(fy(n)-Y0)*256,(fx(e)-X0)*256,(fy(s)-Y0)*256
    img=img.crop((int(l),int(t),int(r_),int(b)));sc=min(1,4096/max(img.size));img=img.resize((max(1,int(img.size[0]*sc)),max(1,int(img.size[1]*sc))),Image.LANCZOS)
    img.save(f'sat/{fid}.jpg',quality=82,optimize=True,progressive=True)
    json.dump({'bbox':[s,w,n,e],'attr':attr,'tiles_ok':ok,'size':img.size},open(f'sat/{fid}.json','w'))
    print(fid,'tiles',ok,'size',img.size,os.path.getsize(f'sat/{fid}.jpg'),flush=True)
