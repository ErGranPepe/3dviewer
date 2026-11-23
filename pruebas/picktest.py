import asyncio,subprocess,time,json
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8849'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1280,'height':800});errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
        await pg.goto('http://localhost:8849/lab.html#drive',wait_until='load');await pg.wait_for_timeout(7000)
        box=await (await pg.query_selector('#drv3d canvas')).bounding_box()
        seen={}
        for iy in range(2,9):
            for ix in range(1,10):
                x=box['x']+box['width']*ix/10;y=box['y']+box['height']*iy/10
                await pg.mouse.click(x,y);await pg.wait_for_timeout(350)
                t=await pg.evaluate("(()=>{const e=document.querySelector('#drv3d .s3pick');return e&&!e.hidden?[e.querySelector('b').textContent,e.querySelector('i').textContent]:null})()")
                if t and t[0] not in seen: seen[t[0]]=t[1]
        for k,v in seen.items(): print('-',k,'|',v)
        await pg.screenshot(path='pick.png')
        print('ERRS',errs)
        await b.close()
    srv.kill()
asyncio.run(main())
