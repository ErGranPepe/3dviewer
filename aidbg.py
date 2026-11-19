import asyncio,os,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':480,'height':300})
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
        await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2000)
        await pg.select_option('#rTrack',os.environ['TRK']);await pg.select_option('#rWeather','seco')
        await pg.evaluate("document.getElementById('rGo').click()")
        for k in range(200):
            await pg.wait_for_timeout(1000)
            if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
        r=await pg.evaluate('''(()=>{const w=__app.w,t=w.track,HW=Sim.HW,Z=%s;document.getElementById('pauseBtn').click();const ev=[];let steps=0;
          while(Sim.leaderLap(w)<3&&steps<60*60*10){Sim.raceStep(w);steps++;
            for(const c of w.cars){if(c.retired||c.inPit)continue;const o=Math.abs(c.lat)-HW;if(o>0.6&&Math.abs(c.s-Z)<80&&ev.length<14&&!(c._lg&&w.t-c._lg<3)){c._lg=w.t;const i=c.idx;
              ev.push({c:c.code,s:Math.round(c.s),lat:+c.lat.toFixed(2),u:+c.u.toFixed(1),vref:+t.vref[i].toFixed(1),k:+(1/t.k[i]).toFixed(0),near:(()=>{let m=1e9;for(const o2 of w.cars)if(o2!==c&&!o2.retired){const d=Math.abs(o2.s-c.s);if(d<m)m=d}return Math.round(m)})(),mode:c.mode||c.state||'',err:c.err||c.mist||''})}}}
          return ev})()'''%os.environ['Z'])
        for e in r: print(e)
        await b.close()
asyncio.run(main())
