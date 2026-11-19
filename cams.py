"""Capturas de cada cámara de la realización con la carrera pausada: TRK=5 TAG=x CAMS=tv,low,heli,onboard python3 cams.py"""
import asyncio,os
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
E=os.environ.get
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A);errs=[]
        pg=await b.new_page(viewport={'width':1280,'height':720})
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('high'))}catch(e){}")
        await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
        await pg.select_option('#rTrack',E('TRK','5'))
        if E('WX'):
            try: await pg.select_option('#rWeather',E('WX'))
            except Exception as e: print(e)
        await pg.evaluate("document.getElementById('rGo').click()")
        for k in range(300):
            await pg.wait_for_timeout(1000)
            if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
        await pg.evaluate("document.getElementById('titlecard')&&(document.getElementById('titlecard').hidden=true)")
        await pg.add_style_tag(content='#stage>*:not(canvas){visibility:hidden!important}')
        await pg.evaluate("(()=>{const w=__app.w;for(let i=0;i<60*%s;i++)Sim.raceStep(w)})()"%E('SKIP','45'))
        await pg.evaluate("__app.director=false;document.getElementById('pauseBtn')&&document.getElementById('pauseBtn').click()")
        cams=E('CAMS','tv,low,heli,onboard,chase,orbit').split(',')
        for n,m in enumerate(cams):
            await pg.evaluate("(()=>{const w=__app.w,c=w.order[%d];__app.sel=c;R3D.setCam('%s')})()"%(int(E('CAR','3')),m))
            await pg.wait_for_timeout(3500)
            bb=await (await pg.query_selector('#stage')).bounding_box()
            await pg.screenshot(path=f"shots/{E('TAG','cam')}_{n}.png",clip=bb,timeout=180000)
        print('\n'.join(errs[:5]) or 'ok')
        await b.close()
asyncio.run(main())
