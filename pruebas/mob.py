import asyncio,subprocess,time,sys
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8789'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        dev=p.devices['iPhone 13']
        ctx=await b.new_context(**{k:v for k,v in dev.items() if k!='default_browser_type'})
        pg=await ctx.new_page();errs=[];pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'))}catch(e){}")
        await pg.goto('http://localhost:8789/index.html',wait_until='domcontentloaded')
        for k in range(150):
            await pg.wait_for_timeout(700)
            if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
        await pg.wait_for_timeout(8000)
        await pg.screenshot(path='mb_0.png')
        for g in ['times','car','info','race']:
            await pg.evaluate("document.querySelector('#mnav [data-g=%s]').click()"%g);await pg.wait_for_timeout(900)
            await pg.screenshot(path='mb_%s.png'%g)
            print(g, await pg.evaluate("(()=>{const r=document.querySelector('.stagewrap').getBoundingClientRect(),c=getComputedStyle(document.querySelector('.stagewrap'));const st=document.getElementById('stage');return [r.top,r.height,c.position,scrollY,getComputedStyle(document.body).overflowX,getComputedStyle(st).visibility,st.className,[...st.children].filter(e=>e.offsetParent).map(e=>e.tagName+'.'+e.className).slice(0,6)]})()"))
        await pg.goto('http://localhost:8789/lab.html#susp',wait_until='load');await pg.wait_for_timeout(5000)
        await pg.screenshot(path='mb_lab.png')
        await pg.goto('http://localhost:8789/lab.html#chassis',wait_until='load');await pg.wait_for_timeout(4500)
        await pg.screenshot(path='mb_lab2.png')
        print(errs)
        await b.close()
    srv.kill()
asyncio.run(main())
