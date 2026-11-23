import asyncio,subprocess,time,json
from playwright.async_api import async_playwright
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8862'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            for w in (1002,1010,1060,1120,1200):
                pg=await b.new_page(viewport={'width':w,'height':800})
                await pg.add_init_script("try{localStorage.setItem('pn3-q',JSON.stringify('low'));localStorage.setItem('pn3-view',JSON.stringify('2d'))}catch(e){}");await pg.goto('http://localhost:8862/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(3500)
                r=await pg.evaluate('''(()=>{const R=e=>{if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]},q=s=>document.querySelector(s);
                  const els=[...document.querySelectorAll("header .brand h1, header .hdact > *, header .tabs")].filter(e=>e.offsetParent).map(e=>({t:(e.className||e.tagName)+"",r:R(e)}));
                  let ov=0;for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){const a=els[i].r,b=els[j].r;if(!(a[2]<=b[0]||b[2]<=a[0]||a[3]<=b[1]||b[3]<=a[1]))ov++}
                  return {solapes:ov,fuera:els.filter(e=>e.r[2]>innerWidth+1).length,els:els.map(e=>e.t.slice(0,10)+":"+e.r.join(","))}})()''')
                print(w,json.dumps(r,ensure_ascii=False)[:520]);await pg.close()
            await b.close()
    finally: srv.kill()
asyncio.run(main())
