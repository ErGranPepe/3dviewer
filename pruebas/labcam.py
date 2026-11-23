import asyncio,os,json,subprocess,time,sys
from playwright.async_api import async_playwright
from PIL import Image
PORT=int(os.environ.get('PORT','8845'));OUT=os.environ.get('OUT','lc')
# uso: TAB=engine VIEWER=engine3d SEL='#e3View canvas' CAMS='[["a",[az,el,d,x,y,z]],...]' [PRE=js] [GRID=2]
async def main():
    srv=subprocess.Popen(['python3','-m','http.server',str(PORT)],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':int(os.environ.get('VW','1500')),'height':int(os.environ.get('VH','1000'))});errs=[]
        pg.on('pageerror',lambda e: errs.append('PAGEERR '+str(e)[:500]))
        pg.on('console',lambda m: m.type in ('error','warning') and 'ERR_' not in m.text and 'GL Driver' not in m.text and errs.append(m.type+': '+m.text[:300]))
        await pg.add_init_script("try{localStorage.setItem('pn3-regs',JSON.stringify('%s'))}catch(e){}"%os.environ.get('REG','2025'))
        await pg.goto('http://localhost:%d/lab.html'%PORT,wait_until='domcontentloaded');await pg.wait_for_timeout(3500)
        tab=os.environ.get('TAB','engine')
        await pg.evaluate("(t=>{const b=document.querySelector('[data-tab=\"'+t+'\"]');b&&b.click()})('%s')"%tab);await pg.wait_for_timeout(6000)
        pre=os.environ.get('PRE')
        if pre: print('PRE',await pg.evaluate(pre)); await pg.wait_for_timeout(2500)
        host=os.environ.get('HOST')
        if host:
            await pg.add_style_tag(content="%s{position:fixed!important;left:0!important;top:0!important;width:%spx!important;height:%spx!important;z-index:99999!important;max-width:none!important}.s3info,.e3lab,.e3cams,.e3legend,.s3lab{display:none!important}"%(host,os.environ.get('BW','1400'),os.environ.get('BH','900')))
            await pg.wait_for_timeout(1500)
        sel=os.environ.get('SEL','#e3View canvas');viewer=os.environ.get('VIEWER','engine3d')
        cams=json.loads(os.environ['CAMS']);files=[]
        for name,c in cams:
            await pg.evaluate("LAB.%s.cam(%s)"%(viewer,json.dumps(c)));await pg.wait_for_timeout(int(os.environ.get('WAIT','3500')))
            el=await pg.query_selector(sel);f='%s_%s.png'%(OUT,name);await el.screenshot(path=f,timeout=120000);files.append(f)
        print('ERRS',errs[:6])
        await b.close()
    srv.kill()
    g=int(os.environ.get('GRID','2'))
    if g>0 and files:
        ims=[Image.open(f).convert('RGB') for f in files];w=int(os.environ.get('CW','780'));h=int(w*ims[0].height/ims[0].width)
        rows=(len(ims)+g-1)//g;sheet=Image.new('RGB',(w*g,h*rows),(0,0,0))
        for i,im in enumerate(ims): sheet.paste(im.resize((w,h),Image.LANCZOS),((i%g)*w,(i//g)*h))
        sheet.save('%s_sheet.png'%OUT);print('sheet',sheet.size)
asyncio.run(main())
