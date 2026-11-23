import asyncio,os,json,subprocess,time,sys
from playwright.async_api import async_playwright
Q=os.environ.get('Q','high');PORT=int(os.environ.get('PORT','8801'))
NOISE=('TUNNEL','ERR_','GL Driver','Canvas2D','willReadFrequently','fonts.g','GPU stall','Automatic fallback to software')
STAT=r'''(()=>{const d=R3D.__therm();let m=0,bad=0,tris=0;const badL=[];
 d.scene.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.attributes.position){m++;const g=o.geometry;if(!g.boundingSphere)g.computeBoundingSphere();const r=g.boundingSphere.radius;
   if(!isFinite(r)||isNaN(r)){bad++;if(badL.length<6){let n=o.name||'';let q=o.parent;while(q&&!n){n=q.name||'';q=q.parent}badL.push((n||'?')+':'+g.attributes.position.count)}}
   tris+=(g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1)}});
 const tr=__app.track;let wmin=1e9,wmax=-1e9,wnan=0;if(tr.wallX)for(const a of tr.wallX)for(const v of a){if(!isFinite(v))wnan++;wmin=Math.min(wmin,v);wmax=Math.max(wmax,v)}
 return {meshes:m,nanGeo:bad,badL,tris:Math.round(tris/1e3)+'k',posts:d.tvPosts.length,vcl:!!(d.VCL.mesh&&d.VCL.mesh.visible),wr:!!tr.wr,wallX:[+wmin.toFixed(1),+wmax.toFixed(1),wnan],cars:__app.w.cars.length,carNaN:__app.w.cars.filter(c=>!isFinite(c.x)||!isFinite(c.v)).length}})()'''
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        vp={'width':1280,'height':760} if not os.environ.get('MOB') else {'width':390,'height':844}
        pg=await b.new_page(viewport=vp);errs=[]
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:260]))
        pg.on('console',lambda m: m.type in('error','warning') and not any(k in m.text for k in NOISE) and errs.append(m.type.upper()+' '+m.text[:260]))
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('%s'))}catch(e){}"%Q)
        await pg.goto('http://localhost:%d/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
        n=await pg.evaluate("document.getElementById('rTrack').options.length")
        idx=json.loads(os.environ.get('IDX','null')) or list(range(n))
        for i in idx:
            e0=len(errs);t0=time.time()
            await pg.select_option('#rTrack',index=i)
            await pg.evaluate("document.getElementById('rGo').click()")
            ok=False
            for k in range(400):
                await pg.wait_for_timeout(600)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):ok=True;break
            await pg.evaluate("R3D.__px(.15)")
            await pg.wait_for_timeout(int(os.environ.get('RUN','6000')))
            name=await pg.evaluate("document.getElementById('rTrack').options[%d].text"%i)
            try: st=await pg.evaluate(STAT)
            except Exception as ex: st={'statErr':str(ex)[:200]}
            print(json.dumps({'i':i,'track':name[:34],'q':Q,'ok':ok,'s':round(time.time()-t0),'stat':st,'errs':errs[e0:][:8]},ensure_ascii=False),flush=True)
        await b.close()
    srv.kill()
asyncio.run(main())
