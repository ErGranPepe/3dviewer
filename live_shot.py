"""Capturas de la web publicada (con Google 3D si la clave funciona)."""
import asyncio, os, json, sys
from playwright.async_api import async_playwright
A = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
URL = 'https://ergranpepe.github.io/3dviewer/'
RUNS = [
    ('mon_hi', '16', 'high', False),
    ('mon_phone', '16', None, True),
    ('sil_hi', '7', 'high', False),
    ('spa_hi', '9', 'high', False),
]
VIEWS = "(()=>{const t=__app.w.track,N=t.N,f=a=>Math.floor(N*a)%N;return [[f(.02),0,3,f(.045),0,2.2,62],[f(.21),0,3,f(.235),0,2.2,62],[f(.374)-6,38,24,f(.374)+2,0,0,60],[f(.64),0,3,f(.68),0,2,62],[f(.3),-60,70,f(.36),-200,0,60]]})()"
async def run(p, tag, trk, q, mobile, log):
    b = await p.chromium.launch(args=A)
    ctx = await b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 960, 'height': 600},
                              device_scale_factor=1, is_mobile=mobile, has_touch=mobile,
                              user_agent=('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' if mobile else None))
    pg = await ctx.new_page(); errs = []
    pg.set_default_timeout(300000); pg.set_default_navigation_timeout(180000)
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)[:300]))
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text[:300]) if m.type in ('error', 'warning') and 'GL Driver' not in m.text else None)
    if q: await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('%s'))}catch(e){}" % q)
    await pg.goto(URL, wait_until='domcontentloaded'); await pg.wait_for_timeout(4000)
    await pg.evaluate("for(const d of document.querySelectorAll('dialog,.consent,#cookie'))try{d.remove()}catch(e){}")
    await pg.screenshot(path=f'out/{tag}_menu.png', timeout=300000)
    await pg.select_option('#rTrack', trk)
    await pg.evaluate("document.getElementById('rGo').click()")
    for k in range(400):
        await pg.wait_for_timeout(1000)
        if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'): break
    await pg.wait_for_timeout(5000)
    await pg.screenshot(path=f'out/{tag}_start.png', timeout=300000)
    gi = None
    for k in range(150):
        gi = await pg.evaluate('R3D.geoInfo && R3D.geoInfo()')
        if gi and (gi.get('cal') or gi.get('status')): break
        await pg.wait_for_timeout(1000)
    qq = await pg.evaluate("localStorage.getItem('pn3-q')")
    log.write(f'{tag} geo {json.dumps(gi)} q={qq}\n')
    await pg.evaluate("document.getElementById('titlecard')&&(document.getElementById('titlecard').hidden=true)")
    try: await pg.evaluate("document.getElementById('pauseBtn').click()")
    except Exception: pass
    vs = await pg.evaluate(VIEWS)
    for n, v in enumerate(vs):
        await pg.evaluate("R3D.__look(%s)" % ','.join(str(x) for x in v))
        await pg.wait_for_timeout(30000)
        await pg.screenshot(path=f'out/{tag}_{n}.png', timeout=300000)
    gi = await pg.evaluate('R3D.geoInfo && R3D.geoInfo()')
    log.write(f'{tag} geo-end {json.dumps(gi)}\n' + '\n'.join(list(dict.fromkeys(errs))[:25]) + '\n\n'); log.flush()
    await b.close()
async def main():
    os.makedirs('out', exist_ok=True); log = open('out/log.txt', 'w')
    async with async_playwright() as p:
        for r in RUNS:
            try: await run(p, *r, log)
            except Exception as e: log.write(f'{r[0]} FAIL {e}\n'); log.flush()
asyncio.run(main())
