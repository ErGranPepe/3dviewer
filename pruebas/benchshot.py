import asyncio,os,subprocess,time
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8847'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for vp,tag in [({'width':1280,'height':800},'d'),({'width':390,'height':844},'m')]:
            for t,sel in [('engine','#engBench'),('drive','#drvBench')]:
                pg=await b.new_page(viewport=vp);errs=[]
                pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
                await pg.goto('http://localhost:8847/lab.html#'+t,wait_until='load');await pg.wait_for_timeout(5000)
                el=await pg.query_selector(sel)
                await el.scroll_into_view_if_needed();await pg.wait_for_timeout(500)
                await el.screenshot(path='bench_%s_%s.png'%(t,tag));print(t,tag,errs)
                await pg.close()
        await b.close()
    srv.kill()
asyncio.run(main())
