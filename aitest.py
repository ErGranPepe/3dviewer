"""Auditoría de la IA: TRKS=0,1 LAPS=3 python3 aitest.py -> salidas de pista, abandonos, adelantamientos"""
import asyncio,os,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for TRK in os.environ.get('TRKS','5').split(','):
            pg=await b.new_page(viewport={'width':480,'height':300});errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)))
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
            await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2000)
            await pg.select_option('#rTrack',TRK)
            try: await pg.select_option('#rWeather',os.environ.get('WX','seco'))
            except Exception: pass
            await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(200):
                await pg.wait_for_timeout(1000)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            r=await pg.evaluate('''(()=>{const w=__app.w,t=w.track,HW=Sim.HW;__app.paused=true;document.getElementById('pauseBtn')&&document.getElementById('pauseBtn').click();
              let n=0,off=0,grass=0,zones={},steps=0;const L=%s;
              while(Sim.leaderLap(w)<L&&steps<60*60*12){Sim.raceStep(w);steps++;if(steps%%6)continue;
                for(const c of w.cars){if(c.retired||c.inPit||c.gone)continue;n++;const o=Math.abs(c.lat)-HW;if(o>0.3){off++;const z=Math.round(c.s/50)*50;zones[z]=(zones[z]||0)+1}if(o>1.6)grass++}}
              const top=Object.entries(zones).sort((a,b)=>b[1]-a[1]).slice(0,5);
              return {key:t.key,laps:Sim.leaderLap(w),offPct:+(100*off/n).toFixed(2),grassPct:+(100*grass/n).toFixed(3),top,dnf:w.cars.filter(c=>c.retired).map(c=>c.code+':'+c.dnfReason+'@'+Math.round(c.s)),ovt:w.cars.reduce((a,c)=>a+(c.overtakes||0),0),best:Math.min(...w.cars.map(c=>c.best||1e9)).toFixed(2)}})()'''%os.environ.get('LAPS','3'))
            print(TRK,json.dumps(r),errs[:2],flush=True);await pg.close()
        await b.close()
asyncio.run(main())
