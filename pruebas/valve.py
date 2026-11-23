import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
PORT=os.environ.get('PORT','8892')
JS='''(()=>{const w=__app.w;__app.paused=true;const tr=w.track,dt=1/60;const T=%d,FORCE=%s;
 const last=new Map,rep=[];let maxR=0;
 for(let steps=0;steps<60*T;steps++){
  if(FORCE&&steps===60*40){let k=0;for(const c of w.cars){if(k++%%3===0&&!c.player){c.mgr=c.mgr||{};c.mgr.box='M';c.pitReq=true;c.pitTire='M'}}}
  for(const c of w.cars){if(!c.retired){const S=c.sys||{};last.set(c.id,{t:+w.t.toFixed(1),rpm:Math.round(c.rpm||0),gear:c.gear,u:+(c.u||0).toFixed(1),inPit:!!c.inPit,ph:c.inPit&&c.pit?c.pit.phase:'',d:c.inPit&&c.pit?Math.round(c.pit.d):0,s:Math.round(c.s),fl:Math.round(S.floatRpm||0),pv:+(S.pvrsB||0).toFixed(1),leak:+(S.pvrsLeak||0).toFixed(2),seal:+(S.seal||0).toFixed(2),stops:c.stops});maxR=Math.max(maxR,c.rpm||0)}}
  Sim.raceStep(w);
  for(const c of w.cars){if(c.retired&&last.has(c.id)){const q=last.get(c.id);last.delete(c.id);rep.push([c.code,c.dnfReason,q,{rpm:Math.round(c.rpm||0),gear:c.gear,u:+(c.u||0).toFixed(1),inPit:!!c.inPit}])}}
 }
 return {key:tr.key,t:Math.round(w.t),rep,maxR:Math.round(maxR),rpmMax:Sim.CAR&&Sim.CAR.rpmMax,gears:Sim.CAR&&Sim.CAR.gears&&Array.from(Sim.CAR.gears).map(v=>+v.toFixed(1)),reg:Sim.CAR&&Sim.CAR.reg}})()'''
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',PORT],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A)
        for TRK in os.environ.get('TRKS','15').split(','):
            pg=await b.new_page(viewport={'width':640,'height':400});errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
            await pg.goto('http://localhost:%s/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=120000);await pg.wait_for_timeout(1500)
            await pg.select_option('#rTrack',index=int(TRK));await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(400):
                await pg.wait_for_timeout(700)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            try:
                r=await pg.evaluate(JS%(int(os.environ.get('T','330')),os.environ.get('FORCE','true')))
                print(TRK,r['key'],'t',r['t'],'maxRpm',r['maxR'],'rpmMax',r['rpmMax'],'reg',r['reg'],'gears',r['gears'],errs[:2],flush=True)
                for e in r['rep']: print('   ',json.dumps(e)[:420])
            except Exception as e: print(TRK,'ERR',str(e)[:300],errs[:2],flush=True)
            await pg.close()
        await b.close()
    srv.kill()
asyncio.run(main())
