import asyncio,os,json,subprocess,time,sys
from playwright.async_api import async_playwright
Q=os.environ.get('Q','high');PORT=int(os.environ.get('PORT','8861'))
HERE=os.path.dirname(os.path.abspath(__file__))
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for i in json.loads(os.environ.get('IDX','[4]')):
            pg=await b.new_page(viewport={'width':640,'height':420});errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)[:300]))
            await pg.add_init_script("window.__SRCTAG=true;try{localStorage.setItem('pn3-q',JSON.stringify('%s'))}catch(e){}"%Q)
            await pg.goto('http://localhost:%d/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=90000);await pg.wait_for_timeout(1500)
            await pg.select_option('#rTrack',index=i)
            await pg.evaluate("document.getElementById('rGo').click()")
            for k in range(600):
                await pg.wait_for_timeout(600)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
            await pg.evaluate("R3D.__px(.1);__app.paused=true")
            await pg.wait_for_timeout(int(os.environ.get('WAIT','2500')))
            js=open(sys.argv[1]).read()
            try:
                r=await pg.evaluate(js)
                print(i,json.dumps(r)[:int(os.environ.get('MAXC','6000'))],flush=True)
            except Exception as e: print(i,'ERR',str(e)[:600],flush=True)
            if errs: print('  ERRS',errs[:3])
            await pg.close()
        await b.close()
    srv.kill()
asyncio.run(main())
