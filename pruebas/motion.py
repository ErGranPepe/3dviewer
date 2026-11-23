import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=os.environ.get('PORT','8841')
JS='''(()=>{const w=__app.w;__app.paused=true;const tr=w.track,P=tr.pit,L=tr.L,dt=1/60;
 const prev=new Map,ev=[],cnt={tp:0,hs:0,us:0,ls:0};let steps=0;
 const T=%d;
 const wr=a=>{a=(a+Math.PI)%%(2*Math.PI);return a<0?a+2*Math.PI-Math.PI:a-Math.PI};
 for(;steps<60*T;steps++){
  if(steps===60*40){let k=0;for(const c of w.cars){if(k++%%3===0&&!c.player){c.mgr=c.mgr||{};c.mgr.box='M';c.pitReq=true;c.pitTire='M'}}}
  Sim.raceStep(w);
  for(const c of w.cars){ if(c.retired||c.gone)continue; const p=prev.get(c.id);
   const cur={x:c.x,y:c.y,h:c.h,u:c.u,lat:c.lat,pit:!!c.inPit,s:c.s};
   if(p&&w.started){
    const d=Math.hypot(cur.x-p.x,cur.y-p.y), exp=Math.max(p.u,cur.u)*dt;
    const ctx=(cur.pit!==p.pit?(cur.pit?'ENTRA_BOX':'SALE_BOX'):cur.pit?'en_box':'pista');
    if(d-exp>1.0){cnt.tp++;ev.length<60&&ev.push(['SALTO',+w.t.toFixed(1),c.code,ctx,+d.toFixed(1),Math.round(cur.s),+cur.lat.toFixed(1),+cur.u.toFixed(0)])}
    const dh=Math.abs(wr(cur.h-p.h));
    if(dh>0.12&&cur.u>8){cnt.hs++;ev.length<60&&ev.push(['GIRO',+w.t.toFixed(1),c.code,ctx,+dh.toFixed(2),Math.round(cur.s),+cur.lat.toFixed(1),+cur.u.toFixed(0)])}
    const du=Math.abs(cur.u-p.u);
    if(du>2.5){cnt.us++;ev.length<60&&ev.push(['VEL',+w.t.toFixed(1),c.code,ctx,+du.toFixed(1),Math.round(cur.s),+cur.lat.toFixed(1),+cur.u.toFixed(0)])}
    const dl=Math.abs(cur.lat-p.lat);
    if(dl>0.7&&d<5){cnt.ls++;ev.length<60&&ev.push(['LAT',+w.t.toFixed(1),c.code,ctx,+dl.toFixed(1),Math.round(cur.s),+cur.lat.toFixed(1),+cur.u.toFixed(0)])}
   }
   prev.set(c.id,cur)}
 }
 return {key:tr.key,t:Math.round(w.t),cnt,ev,ret:w.cars.filter(c=>c.retired).map(c=>c.code+':'+c.dnfReason),stops:w.cars.reduce((a,c)=>a+(c.stops||0),0),inPit:w.cars.filter(c=>c.inPit).length}})()'''
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',PORT],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A)
        for TRK in os.environ.get('TRKS','5').split(','):
            pg=await b.new_page(viewport={'width':640,'height':400});errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
            await pg.goto('http://localhost:%s/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=90000);await pg.wait_for_timeout(1500)
            await pg.select_option('#rTrack',index=int(TRK));await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(300):
                await pg.wait_for_timeout(700)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            try:
                r=await pg.evaluate(JS%int(os.environ.get('T','420')))
                print(TRK,r['key'],'t',r['t'],'CUENTA',r['cnt'],'paradas',r['stops'],'aún en box',r['inPit'],'abandonos',r['ret'],errs[:2],flush=True)
                for e in r['ev'][:int(os.environ.get('SHOW','40'))]: print('   ',e)
            except Exception as e: print(TRK,'ERR',str(e)[:300],errs[:2],flush=True)
            await pg.close()
        await b.close()
    srv.kill()
asyncio.run(main())
