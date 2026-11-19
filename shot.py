"""Uso: TRK=12 TAG=x VIEWS='[["look",i,lat,h,j,lat2,h2,fov],["camw",[px,py,pz,tx,ty,tz,fov]],["js","expr que devuelve lista de vistas"]]' python3 shot.py"""
import asyncio,os,json
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
E=os.environ.get;TRK=E('TRK','5');TAG=E('TAG','s');VIEWS=json.loads(E('VIEWS','[]'));PRE=E('PRE','');W=int(E('W','1280'));Hh=int(E('H','800'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=A);errs=[]
        pg=await b.new_page(viewport={'width':W,'height':Hh})
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m: errs.append(m.type+': '+m.text) if m.type in('error',) or (m.type=='warning' and ('relieve' in m.text or 'urbano' in m.text or 'Error' in m.text)) else None)
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('high'))}catch(e){}")
        await pg.goto('http://localhost:8765/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
        await pg.evaluate("for(const d of document.querySelectorAll('dialog,.consent,#cookie'))try{d.remove()}catch(e){}")
        await pg.select_option('#rTrack',TRK)
        try: await pg.select_option('#rWeather','seco')
        except Exception: pass
        await pg.evaluate("document.getElementById('rGo').click()")
        for k in range(300):
            await pg.wait_for_timeout(1000)
            if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
        print('ready',await pg.evaluate('!!(window.__app&&__app.w)'),'\n'.join(list(dict.fromkeys(errs))[:8]))
        await pg.evaluate("document.getElementById('titlecard')&&(document.getElementById('titlecard').hidden=true)")
        await pg.add_style_tag(content='#stage>*:not(canvas){visibility:hidden!important}')
        if PRE: print('PRE',await pg.evaluate(PRE))
        await pg.wait_for_timeout(3000)
        try: await pg.evaluate("document.getElementById('pauseBtn').click()")
        except Exception: pass
        vs=[]
        for v in VIEWS:
            if v[0]=='js': vs+=await pg.evaluate(v[1])
            else: vs.append(v)
        for n,v in enumerate(vs):
            if v[0]=='look': await pg.evaluate("R3D.__look(%s)"%','.join(str(x) for x in v[1:]))
            else: await pg.evaluate("R3D.__camW(%s)"%json.dumps(v[1]))
            await pg.wait_for_timeout(2500)
            bb=await (await pg.query_selector('#stage')).bounding_box()
            await pg.screenshot(path=f'shots/{TAG}_{n}.png',clip=bb,animations='disabled',timeout=180000)
        print('\n'.join(list(dict.fromkeys(errs))[:20]) or 'no errors')
        await b.close()
asyncio.run(main())
