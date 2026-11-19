TRK=$1 TAG=$2 VIEWS='[["js","(()=>{const t=__app.w.track,P=t.pit,N=t.N,ds=t.ds,I=s=>Math.round((((s%t.L)+t.L)%t.L)/ds),sd=P.side||-1;return [[\"look\",I(P.inS-70),-sd*6,35,I(P.inS+110),sd*8,0,50],[\"look\",I(P.inS+P.len/2-60),-sd*14,9,I(P.inS+P.len/2+20),sd*Math.abs(P.lane),0,55],[\"look\",I(P.inS+P.len-200),-sd*8,35,I(P.inS+P.len+30),sd*4,0,50],[\"look\",I(P.inS-20),-sd*2,2.2,I(P.inS+40),sd*4,0.5,60]]})()"]]' timeout 900 python3 shot.py
python3 -c "
from PIL import Image
ims=[Image.open(f'shots/$2_{i}.png') for i in range(4)];w,h=ims[0].size
c=Image.new('RGB',(w*2,h*2))
for i,im in enumerate(ims):c.paste(im,((i%2)*w,(i//2)*h))
c.resize((w,h)).save('shots/$2_grid.png')"
