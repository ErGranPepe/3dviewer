# Capturas de la interfaz (portada y carrera) en escritorio y móvil. uso: OUT=prefijo [RACE=1] python3 uishot.py
import asyncio,os
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
OUT=os.environ.get('OUT','/home/claude/src/shots/ui')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A)
        for name,vp,mob in (('pc',{'width':1366,'height':800},False),('movil',{'width':390,'height':844},True)):
            ctx=await b.new_context(viewport=vp,device_scale_factor=1,is_mobile=mob,has_touch=mob)
            pg=await ctx.new_page()
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
            await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(3500)
            await pg.screenshot(path=f'{OUT}_{name}_0.png')
            await pg.screenshot(path=f'{OUT}_{name}_full.png',full_page=True)
            if os.environ.get('RACE'):
                await pg.select_option('#rTrack',index=6);await pg.select_option('#rWeather','seco');await pg.evaluate("document.getElementById('rGo').click()")
                for k in range(300):
                    await pg.wait_for_timeout(1000)
                    if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
                await pg.wait_for_timeout(14000)
                await pg.screenshot(path=f'{OUT}_{name}_race.png')
                await pg.screenshot(path=f'{OUT}_{name}_racefull.png',full_page=True)
            await ctx.close()
        await b.close()
asyncio.run(main())
