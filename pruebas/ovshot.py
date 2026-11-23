import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
Q=os.environ.get('Q','high');PORT=int(os.environ.get('PORT','8881'));OUT=os.environ.get('OUT','ov')
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':1280,'height':800});errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)[:400]))
        pg.on('console',lambda m: m.type in('warning','error') and 'TUNNEL' not in m.text and 'ERR_' not in m.text and 'GL Driver' not in m.text and 'Canvas2D' not in m.text and errs.append(m.type+': '+m.text[:300]))
        await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('%s'));%s}catch(e){}"%(Q,os.environ.get('INIT','')))
        await pg.goto('http://localhost:%d/index.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_selector('#rTrack',state='visible',timeout=90000);await pg.wait_for_timeout(2500)
        await pg.select_option('#rTrack',index=int(os.environ.get('IDX','6')))
        await pg.evaluate("document.getElementById('rGo').click()")
        for k in range(400):
            await pg.wait_for_timeout(600)
            if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):break
        await pg.wait_for_timeout(3000)
        await pg.evaluate("document.getElementById('titlecard').hidden=true;document.getElementById('stage').classList.remove('intro');__app.sel=__app.w.cars[%d];__app.cam.mode='follow';R3D.setCam('%s')"%(int(os.environ.get('CAR','2')),os.environ.get('CAM','chase')))
        await pg.wait_for_timeout(int(os.environ.get('RUN','9000')))
        for step in json.loads(os.environ.get('STEPS','[]')):
            name,js,wait=step[0],step[1],step[2] if len(step)>2 else 8000
            if js: print(name, json.dumps(await pg.evaluate(js))[:600])
            await pg.wait_for_timeout(wait)
            await pg.screenshot(path='%s_%s.png'%(OUT,name),timeout=240000)
        print('ERRS',errs[:10])
        await b.close()
    srv.kill()
asyncio.run(main())
