import asyncio,os,json
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A)
        for TRK in os.environ.get('TRKS','12,14,16,5').split(','):
            pg=await b.new_page(viewport={'width':640,'height':400});errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)))
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
            await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2000)
            await pg.select_option('#rTrack',TRK);await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(200):
                await pg.wait_for_timeout(1000)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            r=await pg.evaluate('''(()=>{const w=__app.w;__app.paused=true;for(let i=0;i<60*15;i++)Sim.raceStep(w);
              for(const c of w.cars){c.mgr=c.mgr||{};c.mgr.box='M';c.pitReq=true;c.pitTire='M'}
              let done=0,enter=0,dnf=0;const seen=new Set();for(let i=0;i<60*240;i++){Sim.raceStep(w);for(const c of w.cars){if(c.inPit)seen.add(c.id)}}
              for(const c of w.cars){if(c.retired)dnf++;}
              const P=w.track.pit;return {key:w.track.key,pit:{inS:Math.round(P.inS),len:P.len,side:P.side,lane:P.lane,rin:P.rin,rout:P.rout},entered:seen.size,stillIn:w.cars.filter(c=>c.inPit).length,pitsDone:w.cars.filter(c=>(c.stops||c.pits||0)>0).length,dnf,ret:w.cars.filter(c=>c.retired).map(c=>c.code+':'+c.dnfReason+'@'+Math.round(c.s)+'/'+c.lat.toFixed(1))}})()''')
            print(TRK,json.dumps(r),errs[:3]);await pg.close()
        await b.close()
asyncio.run(main())
