# Comprueba la cabecera de las dos páginas: botones Apoya y Compartir, etiquetas sociales, sin errores de página.
import asyncio,subprocess,time,json
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8861'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            for page,vp in (('index.html',{'width':1366,'height':800}),('lab.html',{'width':1366,'height':800}),('index.html',{'width':390,'height':844})):
                pg=await b.new_page(viewport=vp);errs=[]
                pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
                await pg.goto('http://localhost:8861/'+page,wait_until='domcontentloaded');await pg.wait_for_timeout(4000)
                r=await pg.evaluate('''(async()=>{const q=s=>document.querySelector(s),sh=q(".shBtn"),su=q(".supBtn");let copied=null;
                  if(sh){navigator.share=undefined;try{Object.defineProperty(navigator,"clipboard",{value:{writeText:async t=>{copied=t}},configurable:true})}catch(e){}sh.click();await new Promise(r=>setTimeout(r,300))}
                  const r1=sh&&sh.getBoundingClientRect(),r2=su&&su.getBoundingClientRect();
                  return {share:!!sh,shareTxt:sh&&sh.textContent.trim(),copied,apoya:!!su,solape:!!(r1&&r2&&!(r1.right<=r2.left||r2.right<=r1.left||r1.bottom<=r2.top||r2.bottom<=r1.top)),dentro:r1?r1.right<=innerWidth+1&&r1.left>=0:null,og:!!q('meta[property="og:title"]'),canon:q('link[rel=canonical]')&&q('link[rel=canonical]').href,ld:!!q('script[type="application/ld+json"]'),desbordaX:document.documentElement.scrollWidth>innerWidth+1}})()''')
                print(page,vp['width'],json.dumps(r,ensure_ascii=False),errs[:2])
                await pg.close()
            await b.close()
    finally: srv.kill()
asyncio.run(main())
