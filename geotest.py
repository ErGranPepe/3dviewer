import asyncio
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=A);pg=await b.new_page();errs=[];reqs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('request',lambda r: reqs.append(r.url[:90]) if 'google' in r.url or 'tiles3d' in r.url else None)
    await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('high'))}catch(e){}")
    await pg.goto('http://localhost:8765/index.html?gkey=AIzaFAKEKEY123',wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
    print('url',pg.url, await pg.evaluate("localStorage.getItem('pn3-gkey')"))
    await pg.evaluate("for(const d of document.querySelectorAll('dialog,.consent,#cookie'))try{d.remove()}catch(e){}")
    await pg.select_option('#rTrack','16');await pg.evaluate("document.getElementById('rGo').click()")
    for k in range(200):
      await pg.wait_for_timeout(1000)
      if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
    await pg.wait_for_timeout(8000)
    print(await pg.evaluate('R3D.geoInfo()'))
    print(errs[:5]); print(sorted(set(reqs))[:8])
    await b.close()
asyncio.run(main())
