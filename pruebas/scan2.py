import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
Q=os.environ.get('Q','high');PORT=int(os.environ.get('PORT','8831'))
HERE=os.path.dirname(os.path.abspath(__file__))
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for i in json.loads(os.environ.get('IDX','[8]')):
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
            await pg.wait_for_timeout(int(os.environ.get('WAIT','4000')))
            await pg.add_script_tag(path=os.path.join(HERE,'scan2.js'))
            t=time.time()
            try:
                r=await pg.evaluate("__scan(%s)"%os.environ.get('OPT','{}'))
                json.dump(r,open(os.path.join(HERE,'scan','%s.json'%r['key']),'w'))
                print(i,r['key'],'tiles',r['tiles'],'scan %ds id %ds'%(r['scanMs']/1000,r['idMs']/1000),'ARRIBA',r['upTot'],'ABAJO',r['dnTot'],flush=True)
                for c in r['up'][:int(os.environ.get('SHOW','14'))]: print('  +',json.dumps(c)[:900],flush=True)
                for c in r['dn'][:int(os.environ.get('SHOWD','8'))]: print('  -',json.dumps(c)[:900],flush=True)
            except Exception as e: print(i,'ERR',str(e)[:400],flush=True)
            if errs: print('  ERRS',errs[:3])
            await pg.close()
        await b.close()
    srv.kill()
asyncio.run(main())
