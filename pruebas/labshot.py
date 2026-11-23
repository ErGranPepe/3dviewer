import asyncio,os,json,subprocess,time
from playwright.async_api import async_playwright
PORT=int(os.environ.get('PORT','8841'));OUT=os.environ.get('OUT','lab')
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        mob=os.environ.get('MOB')
        pg=await b.new_page(viewport={'width':390,'height':844} if mob else {'width':1500,'height':950});errs=[]
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:500]))
        pg.on('console',lambda m: m.type in ('error','warning') and 'ERR_' not in m.text and 'GL Driver' not in m.text and errs.append(m.type+': '+m.text[:400]))
        await pg.add_init_script("try{localStorage.setItem('pn3-regs',JSON.stringify('%s'))}catch(e){}"%os.environ.get('REG','2026'))
        await pg.goto('http://localhost:%d/lab.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_timeout(4000)
        tab=os.environ.get('TAB','susp')
        await pg.evaluate("(t=>{const b=document.querySelector('[data-tab=\"'+t+'\"]');b&&b.click()})('%s')"%tab);await pg.wait_for_timeout(6000)
        for step in json.loads(os.environ.get('STEPS','[["all",null]]')):
            name,js=step[0],step[1]
            if js: print(name, await pg.evaluate(js))
            await pg.wait_for_timeout(int(os.environ.get('WAIT','5000')))
            el=await pg.query_selector(os.environ.get('SEL','.s3cv'))
            if el and not os.environ.get('FULL'): await el.screenshot(path='%s_%s.png'%(OUT,name),timeout=120000)
            else: await pg.screenshot(path='%s_%s.png'%(OUT,name),full_page=bool(os.environ.get('FULLPAGE')),timeout=120000)
        print('ERRS',errs[:8])
        await b.close()
    srv.kill()
asyncio.run(main())
