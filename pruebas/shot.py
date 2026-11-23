# Capturas de elementos del Laboratorio. uso: TAB=engine SELS='#engFuel,#engComp' [MODE=adv] [VP=d|m] [OUT=dir] [WAIT=ms] python3 shot.py
import asyncio, os, subprocess, time, json
from playwright.async_api import async_playwright
async def main():
    tab = os.environ.get('TAB', 'engine'); sels = os.environ.get('SELS', 'main').split(','); out = os.environ.get('OUT', '.'); wait = int(os.environ.get('WAIT', '6000'))
    vps = {'d': {'width': 1360, 'height': 900}, 'm': {'width': 390, 'height': 844}}
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8853'], cwd='/home/claude/pages', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            for tag in os.environ.get('VP', 'd').split(','):
                pg = await b.new_page(viewport=vps[tag], device_scale_factor=2 if os.environ.get('HI') else 1); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)[:400])); pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text[:300]))
                if os.environ.get('MODE'): await pg.add_init_script("try{localStorage.setItem('lab-mode','%s')}catch(e){}" % os.environ['MODE'])
                await pg.goto('http://localhost:8853/lab.html#' + tab, wait_until='load'); await pg.wait_for_timeout(wait)
                if os.environ.get('JS'): print('js:', json.dumps(await pg.evaluate(os.environ['JS']), ensure_ascii=False)[:int(os.environ.get("JSMAX","3000"))])
                for i, sel in enumerate(sels):
                    el = await pg.query_selector(sel)
                    if not el: print('no existe', sel); continue
                    await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(400)
                    await el.screenshot(path='%s/%s_%d_%s.png' % (out, tab, i, tag))
                print(tab, tag, 'errores:', errs)
                await pg.close()
            await b.close()
    finally:
        srv.kill()
asyncio.run(main())
