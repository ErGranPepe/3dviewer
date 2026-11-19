import sys
from PIL import Image
tag,n=sys.argv[1],int(sys.argv[2]);ims=[Image.open(f'shots/{tag}_{i}.png') for i in range(n)];w,h=ims[0].size;cols=2;rows=(n+1)//2
c=Image.new('RGB',(w*cols,h*rows))
for i,im in enumerate(ims):c.paste(im,((i%cols)*w,(i//cols)*h))
c.resize((w*cols*3//4,h*rows*3//4)).save(f'shots/{tag}_grid.png')
