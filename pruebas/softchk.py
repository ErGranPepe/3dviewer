# Aviso de fluidez: (A) navegador sin tarjeta gráfica -> calidad ligera, vista 2D y aviso; «Ver en 3D» lo respeta en la sesión.
# (B) con gráfica «de verdad» pero lenta (se falsea el nombre del renderizador sobre SwiftShader) -> aviso de 3D lento con sus botones.
# (C) prueba automática normal (navigator.webdriver = true) -> nada cambia.
import asyncio,subprocess,time,json
from playwright.async_api import async_playwright
A=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
NOWD="Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false});"
FAKE="for(const P of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!P)continue;const g=P.prototype.getParameter;P.prototype.getParameter=function(p){return p===0x9246?'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Direct3D11 vs_5_0 ps_5_0, D3D11)':g.call(this,p)}}"
ST="(()=>{const n=document.querySelector('.perfNote');return {vista:window.__app&&__app.view,calidad:document.getElementById('rQual').value,aviso:n?n.querySelector('b').textContent:null,botones:n?[...n.querySelectorAll('button')].map(b=>b.textContent):[],guardada:localStorage.getItem('pn3-view'),qGuardada:localStorage.getItem('pn3-q')}})()"
async def main():
    srv=subprocess.Popen(['python3','-m','http.server','8863'],cwd='/home/claude/pages',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(.8)
    ok=True
    try:
        async with async_playwright() as p:
            b=await p.chromium.launch(args=A)
            # A
            ctx=await b.new_context(viewport={'width':1100,'height':700});pg=await ctx.new_page();errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
            await pg.add_init_script(NOWD+"try{localStorage.getItem('pn3-q')||localStorage.setItem('pn3-q',JSON.stringify('ultra'))}catch(e){}")
            await pg.goto('http://localhost:8863/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(6000)
            a1=await pg.evaluate(ST)
            await pg.screenshot(path='/home/claude/src/shots/soft_A.png')
            await pg.evaluate('''document.querySelector(".perfNote button[data-a='3d']").click()''');await pg.wait_for_timeout(1500)
            a2=await pg.evaluate(ST)
            await pg.reload(wait_until='domcontentloaded');await pg.wait_for_timeout(6000)
            a3=await pg.evaluate(ST)
            print('A1',json.dumps(a1,ensure_ascii=False));print('A2',json.dumps(a2,ensure_ascii=False));print('A3',json.dumps(a3,ensure_ascii=False),errs[:2])
            ok&=a1['vista']=='2d' and a1['calidad']=='low' and bool(a1['aviso']) and a1['qGuardada']=='"ultra"' and a2['vista']=='3d' and a2['aviso'] is None and a3['vista']=='3d' and not errs
            await ctx.close()
            # B
            ctx=await b.new_context(viewport={'width':1100,'height':700});pg=await ctx.new_page();errs=[]
            pg.on('pageerror',lambda e: errs.append(str(e)[:200]))
            await pg.add_init_script(NOWD+FAKE+"try{localStorage.setItem('pn3-q',JSON.stringify('high'))}catch(e){}")
            await pg.goto('http://localhost:8863/index.html',wait_until='domcontentloaded')
            b1=None
            for k in range(60):
                await pg.wait_for_timeout(1500)
                b1=await pg.evaluate(ST)
                if b1['aviso']: break
            await pg.screenshot(path='/home/claude/src/shots/soft_B.png')
            print('B1',json.dumps(b1,ensure_ascii=False))
            if b1['aviso']:
                await pg.evaluate('''document.querySelector(".perfNote button[data-a='2d']").click()''');await pg.wait_for_timeout(1500)
            b2=await pg.evaluate(ST);print('B2',json.dumps(b2,ensure_ascii=False),errs[:2])
            ok&=bool(b1['aviso']) and 'lento' in b1['aviso'] and b1['vista']=='3d' and b2['vista']=='2d' and b2['aviso'] is None and not errs
            await ctx.close()
            # C
            ctx=await b.new_context(viewport={'width':1100,'height':700});pg=await ctx.new_page()
            await pg.goto('http://localhost:8863/index.html',wait_until='domcontentloaded');await pg.wait_for_timeout(9000)
            c1=await pg.evaluate(ST);print('C1',json.dumps(c1,ensure_ascii=False))
            ok&=c1['vista']=='3d' and c1['aviso'] is None
            await ctx.close();await b.close()
    finally: srv.kill()
    print('OK' if ok else 'FALLO')
asyncio.run(main())
