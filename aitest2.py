"""Auditoría de batallas: TRKS=11,0 LAPS=8 python3 aitest2.py"""
import asyncio,os,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for TRK in os.environ.get('TRKS','11').split(','):
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
            r=await pg.evaluate('''(()=>{const w=__app.w,t=w.track,HW=Sim.HW;document.getElementById('pauseBtn')&&document.getElementById('pauseBtn').click();
              let G={},n=0,off=0,grass=0,steps=0,starts=0,aborts=0,side=0,close=0;const L=%s;const prev=new Map();
              while(Sim.leaderLap(w)<L&&steps<60*60*25){Sim.raceStep(w);steps++;
                for(const c of w.cars){if(c.retired||c.inPit||c.gone)continue;const a0=prev.get(c)||0,a1=c.atkSide||0;if(!a0&&a1)starts++;if(a0&&!a1)aborts++;prev.set(c,a1);
                  if(steps%%6)continue;n++;const o=Math.abs(c.lat)-HW;if(o>0.3)off++;if(o>1.6){grass++;const k=c.along?'al':c.atkSide?'atk':(c.underAtk&&w.t-c.underAtkT<1)?'def':(c.nbP||c.nbN)?'nb':c.lateBrk?'lb':'other';G[k]=(G[k]||0)+1}if(c.ahead&&c.aheadD<1.5)side++;if(c.ahead&&c.aheadD<12)close++}}
              const ovt=w.cars.reduce((a,c)=>a+(c.overtakes||0),0);
              return {G,key:t.key,laps:Sim.leaderLap(w),ovt,AS:w.atkStats,starts,aborts,sidePct:+(100*side/n).toFixed(2),closePct:+(100*close/n).toFixed(1),offPct:+(100*off/n).toFixed(2),grassPct:+(100*grass/n).toFixed(3),dnf:w.cars.filter(c=>c.retired).map(c=>c.code+':'+c.dnfReason+'@'+Math.round(c.s)),best:Math.min(...w.cars.map(c=>c.bestLap||c.best||1e9)).toFixed(2)}})()'''%os.environ.get('LAPS','8'))
            print(TRK,json.dumps(r),errs[:2],flush=True);await pg.close()
        await b.close()
asyncio.run(main())
