import sys, json, asyncio, os
from playwright.async_api import async_playwright
# uso: shot.py <url-relativa-al-modelo> <prefijo-salida> [extra query] ; vistas en VIEWS
VIEWS = json.loads(os.environ.get('VIEWS', 'null')) or {
 'q34': [-5.2, 2.2, 4.6, 0, .45, 0, 28], 'side': [0, .6, 9, 0, .5, 0, 24], 'top': [0, 11, .001, 0, 0, 0, 26], 'front': [-8, .9, 0, 0, .5, 0, 16], 'rear34': [5.2, 1.9, 3.6, 0, .45, 0, 28],
}
async def main():
    model, out = sys.argv[1], sys.argv[2]; extra = sys.argv[3] if len(sys.argv) > 3 else ''
    port = os.environ.get('PORT', '8791')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': int(os.environ.get('W', 1400)), 'height': int(os.environ.get('H', 800))})
        pg.on('pageerror', lambda e: print('PAGEERR', e))
        pg.on('console', lambda m: print('CONSOLE', m.type, m.text[:300]) if m.type in ('error',) else None)
        await pg.goto(f'http://127.0.0.1:{port}/view.html?m={model}&w={os.environ.get("W", 1400)}&h={os.environ.get("H", 800)}{extra}')
        await pg.wait_for_function('window.__state !== "loading"', timeout=240000)
        print('state', await pg.evaluate('[window.__state, window.__err]'))
        for k, v in VIEWS.items():
            await pg.evaluate('v => setCam(...v)', v)
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{out}_{k}.png')
        await b.close()
asyncio.run(main())
