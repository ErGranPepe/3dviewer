import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
OUT='qa/'
async def run():
    srv=subprocess.Popen(['python3','-m','http.server','8790'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    rep={}
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        async def page(vp,q='low'):
            pg=await b.new_page(viewport=vp);errs=[]
            pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:300]))
            pg.on('console',lambda m: m.type=='error' and 'TUNNEL' not in m.text and 'ERR_' not in m.text and errs.append('CONSOLE '+m.text[:300]))
            await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('%s'))}catch(e){}"%q)
            return pg,errs
        async def waitrun(pg,n=200):
            for k in range(n):
                await pg.wait_for_timeout(700)
                if await pg.evaluate('!!(window.__app&&__app.w&&__app.phase==="run")'):return True
            return False
        # 1) every track: start race, run 6s, cycle cameras on a few
        pg,errs=await page({'width':1280,'height':760})
        await pg.goto('http://localhost:8790/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
        n=await pg.evaluate("document.getElementById('rTrack').options.length")
        for i in range(n):
            e0=len(errs)
            await pg.select_option('#rTrack',index=i)
            reg='2026' if i%2 else '2025'
            await pg.evaluate("(()=>{const s=document.getElementById('rRegs');if(s){s.value='%s';s.dispatchEvent(new Event('change'))}})()"%reg)
            await pg.evaluate("document.getElementById('rGo').click()")
            ok=await waitrun(pg)
            await pg.wait_for_timeout(5000)
            if i in (0,7,16):
                for c in ['tv','chase','onboard','helmet','low','nose','heli','orbit','top','auto']:
                    await pg.evaluate("(()=>{const b=[...document.querySelectorAll('[data-c3]')].find(x=>x.dataset.c3==='%s');b&&b.click()})()"%c)
                    await pg.wait_for_timeout(1200)
                await pg.screenshot(path=OUT+'trk%d.png'%i)
            name=await pg.evaluate("document.getElementById('rTrack').options[%d].text"%i)
            rep['track %d %s %s'%(i,name,reg)]={'ok':ok,'errs':errs[e0:]}
        await pg.close()
        # 2) tabs: train, drive
        for tab in ['tab-train','tab-drive']:
            pg,errs=await page({'width':1280,'height':760})
            await pg.goto('http://localhost:8790/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
            await pg.evaluate("document.getElementById('%s').click()"%tab);await pg.wait_for_timeout(2000)
            btn=await pg.evaluate("(()=>{const b=[...document.querySelectorAll('.card:not([hidden]) .btn.primary')].filter(x=>x.offsetParent);return b.map(x=>x.id+':'+x.textContent.trim())})()")
            if btn:
                await pg.evaluate("[...document.querySelectorAll('.card .btn.primary')].filter(x=>x.offsetParent)[0].click()")
            await pg.wait_for_timeout(15000)
            await pg.screenshot(path=OUT+tab+'.png')
            rep[tab]={'buttons':btn,'errs':errs}
            await pg.close()
        # 3) season
        pg,errs=await page({'width':1280,'height':760})
        await pg.goto('http://localhost:8790/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
        sb=await pg.evaluate("(()=>{const b=document.querySelector('#seaBody .btn.primary');return b?b.textContent:null})()")
        await pg.evaluate("(()=>{const b=document.querySelector('#seaBody .btn.primary');b&&b.click()})()");await pg.wait_for_timeout(3000)
        await pg.screenshot(path=OUT+'season.png')
        rep['season']={'btn':sb,'errs':errs};await pg.close()
        # 4) mobile
        pg,errs=await page({'width':390,'height':844})
        await pg.goto('http://localhost:8790/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(2500)
        await pg.evaluate("document.getElementById('rGo').click()");await waitrun(pg);await pg.wait_for_timeout(4000)
        await pg.screenshot(path=OUT+'mobile.png',full_page=False)
        ov=await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+2")
        rep['mobile']={'overflowX':ov,'errs':errs};await pg.close()
        # 5) lab tabs desktop + mobile, both modes
        for vp,tag in [({'width':1280,'height':800},'d'),({'width':390,'height':844},'m')]:
            for t in ['susp','engine','limits','drive','chassis','tyre']:
                pg,errs=await page(vp)
                await pg.goto('http://localhost:8790/lab.html#'+t,wait_until='load');await pg.wait_for_timeout(3500)
                for md in ['pro','easy']:
                    await pg.evaluate("(()=>{const b=document.querySelector('[data-setmode=%s]');b&&b.click()})()"%md);await pg.wait_for_timeout(800)
                ov=await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+2")
                await pg.screenshot(path=OUT+'lab_%s_%s.png'%(t,tag))
                rep['lab %s %s'%(t,tag)]={'overflowX':ov,'errs':errs};await pg.close()
        await b.close()
    srv.kill()
    json.dump(rep,open(OUT+'report.json','w'),indent=1,ensure_ascii=False)
    for k,v in rep.items():
        bad=v.get('errs') or v.get('overflowX') or v.get('ok') is False
        print(('FAIL ' if bad else 'ok   ')+k, json.dumps({kk:vv for kk,vv in v.items() if vv and kk!='ok'},ensure_ascii=False)[:400] if bad else '')
asyncio.run(run())
