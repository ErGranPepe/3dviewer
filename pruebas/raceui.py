# Capturas de la interfaz de carrera con contenido (varias vueltas avanzadas): ficha del coche, análisis (stints con el plan
# del muro) y registro. uso: OUT=prefijo [IDX=0] [LAPS=3] [SEL=RIV] python3 raceui.py   (servidor en :8765 → /home/claude/pages)
import asyncio,os
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
OUT=os.environ.get('OUT','/home/claude/src/shots/rui');IDX=int(os.environ.get('IDX','0'));LAPS=float(os.environ.get('LAPS','3'));SEL=os.environ.get('SEL','')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A)
        for name,vp,mob in (('pc',{'width':1366,'height':860},False),('movil',{'width':390,'height':844},True)):
            ctx=await b.new_context(viewport=vp,device_scale_factor=1,is_mobile=mob,has_touch=mob)
            pg=await ctx.new_page();errs=[]
            pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:300]))
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'));localStorage.setItem('pn3-view',JSON.stringify('2d'))}catch(e){}")
            await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(3000)
            await pg.select_option('#rTrack',index=IDX);await pg.select_option('#rWeather','seco');await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(400):
                await pg.wait_for_timeout(800)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            # avanzar la carrera sin esperar al reloj
            await pg.evaluate("(()=>{const w=__app.w;let n=0;while(n<60*%d&&!w.over&&Math.max(...w.cars.map(c=>c.prog))<w.track.L*%f){Sim.raceStep(w);n++}})()"%(600,LAPS))
            if SEL: await pg.evaluate("(()=>{const c=__app.w.cars.find(c=>c.code===%r);c&&(__app.sel=c)})()"%SEL)
            await pg.evaluate("document.getElementById('anaBox').open=true")
            await pg.wait_for_timeout(2500)
            await pg.screenshot(path=f'{OUT}_{name}.png',full_page=True)
            for sel,tag in (('#tele','ficha'),('#anaBox','analisis'),('#feed','registro'),('#tower','torre')):
                el=await pg.query_selector(sel)
                if el:
                    try: await el.screenshot(path=f'{OUT}_{name}_{tag}.png')
                    except Exception as e: print(name,tag,'sin captura',str(e)[:80])
            print(name,'ok',errs[:3])
            await ctx.close()
        await b.close()
asyncio.run(main())
