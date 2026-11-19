import asyncio,os,json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for TRK in os.environ.get('TRKS','12').split(','):
            pg=await b.new_page(viewport={'width':480,'height':300})
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
            await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2000)
            await pg.select_option('#rTrack',TRK);await pg.select_option('#rWeather','seco')
            await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(200):
                await pg.wait_for_timeout(1000)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            r=await pg.evaluate('''(()=>{const w=__app.w;document.getElementById('pauseBtn').click();let st=0;while(Sim.leaderLap(w)<%s&&st<60*60*15){Sim.raceStep(w);st++}
              const bl=w.cars.filter(c=>isFinite(c.bestLap)).map(c=>[c.code,c.team,+c.bestLap.toFixed(2),c.drv&&c.drv.pace,c.genome&&c.genome.id||'']).sort((a,b)=>a[2]-b[2]);
              const gaps=w.order.map(c=>Math.round(w.order[0].prog-c.prog));return {key:w.track.key,bl,gaps}})()'''%os.environ.get('LAPS','5'))
            print(json.dumps(r));await pg.close()
        await b.close()
asyncio.run(main())
