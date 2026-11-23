import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
PORT=8832
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1280,'height':760});errs=[]
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:600]))
        pg.on('console',lambda m: m.type in('warning','error') and errs.append(m.type+': '+m.text[:300]))
        pg.on('requestfailed',lambda r: errs.append('REQFAIL '+r.url[-60:]))
        await pg.goto('http://localhost:%d/%s'%(PORT,os.environ.get('PAGE','index.html')),wait_until='domcontentloaded');await pg.wait_for_timeout(int(os.environ.get('WAIT','9000')))
        print('opts',await pg.evaluate("(document.getElementById('rTrack')||{options:[]}).options.length"))
        for e in errs[:12]: print(e)
        await b.close()
    srv.kill()
asyncio.run(main())
