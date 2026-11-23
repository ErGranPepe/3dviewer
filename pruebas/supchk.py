# Comprueba el botón «Apoya» y su diálogo en el simulador y en el Laboratorio. uso: [OUT=dir] python3 supchk.py
import asyncio, os, subprocess, time, json
from playwright.async_api import async_playwright
async def main():
    out = os.environ.get('OUT', '.')
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8857'], cwd='/home/claude/pages', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            for page, vp, tag in [('index.html', {'width': 1280, 'height': 760}, 'sim_d'), ('lab.html', {'width': 390, 'height': 844}, 'lab_m')]:
                pg = await b.new_page(viewport=vp); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
                await pg.goto('http://localhost:8857/' + page, wait_until='domcontentloaded'); await pg.wait_for_timeout(7000)
                r = await pg.evaluate("(()=>{const b=document.querySelector('.supBtn');if(!b)return {boton:false};b.click();const d=document.getElementById('supDlg');return {boton:true,abierto:!!(d&&d.open),enlaces:[...d.querySelectorAll('a[href]')].map(a=>[a.textContent.trim().slice(0,70),a.href]),texto:d.innerText.slice(0,400)}})()")
                await pg.wait_for_timeout(600); await pg.screenshot(path='%s/sup_%s.png' % (out, tag))
                print(tag, json.dumps(r, ensure_ascii=False)[:900], 'errores:', errs); await pg.close()
            await b.close()
    finally:
        srv.kill()
asyncio.run(main())
