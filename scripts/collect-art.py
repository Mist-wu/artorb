"""Small, throttled selection from AIC's public-domain collection. Images are CC0.
API guide: https://api.artic.edu/docs/#images — one request per second.
"""
import json,subprocess,time
from pathlib import Path
from urllib.parse import urlencode
ROOT=Path(__file__).resolve().parents[1]
cache=ROOT/'museum-cache';cache.mkdir(exist_ok=True)
images=ROOT/'public/art';images.mkdir(parents=True,exist_ok=True)
artists=[('Claude Monet',6),('Vincent van Gogh',5),('Georges Seurat',3),('Pierre-Auguste Renoir',4),('Edgar Degas',4),('Paul Cézanne',4),('Paul Gauguin',3),('Gustave Caillebotte',2),('Édouard Manet',3),('Katsushika Hokusai',4),('Utagawa Hiroshige',4),('Joseph Mallord William Turner',2),('Rembrandt',2),('El Greco',2),('John Singer Sargent',3),('Wassily Kandinsky',2),('Henri Matisse',2),('Piet Mondrian',2)]
fields='id,title,artist_title,image_id,is_public_domain,date_display,date_start,artwork_type_title,style_title,thumbnail,medium_display'

def curl(url,file):
 subprocess.run(['curl','-fsSL','--compressed','--retry','3','--max-time','90',url,'-o',str(file)],check=True)
 time.sleep(1.05)

arts=[];seen=set()
for artist,count in artists:
 f=cache/(artist.replace(' ','-')+'.json')
 if not f.exists():
  q={'q':artist,'query':{'bool':{'filter':[{'term':{'is_public_domain':True}}]}},'limit':25,'fields':fields}
  url='https://api.artic.edu/api/v1/artworks/search?'+urlencode({'params':json.dumps(q,ensure_ascii=False)})
  curl(url,f)
 rows=json.loads(f.read_text())['data']
 n=0
 for a in rows:
  if not a.get('is_public_domain') or not a.get('image_id') or a['id'] in seen:continue
  if artist.split(' ')[-1].lower() not in (a.get('artist_title') or '').lower():continue
  if a.get('artwork_type_title') not in ['Painting','Print']:continue
  if artist not in ['Katsushika Hokusai','Utagawa Hiroshige'] and a.get('artwork_type_title')!='Painting':continue
  seen.add(a['id']);arts.append(a);n+=1
  if n>=count:break
 print(artist,n,flush=True)

# Include universally recognized collection highlights, verified PD through the API.
for id in [27992,28560,20684,16568,81558,21023,8895,111628,5357,14591]:
 if id in seen:continue
 f=cache/f'{id}.json'
 if not f.exists():curl(f'https://api.artic.edu/api/v1/artworks/{id}?fields='+fields,f)
 a=json.loads(f.read_text())['data']
 if a.get('is_public_domain') and a.get('image_id') and a.get('artwork_type_title') in ['Painting','Print']:
  arts.append(a);seen.add(id)

(ROOT/'artworks.json').write_text(json.dumps(arts,ensure_ascii=False,indent=2))
print('TOTAL',len(arts),flush=True)
for a in arts:
 file=images/f'{a["id"]}.jpg'
 a['image_url']=f'https://www.artic.edu/iiif/2/{a["image_id"]}/full/843,/0/default.jpg'
 a['source']=f'https://www.artic.edu/artworks/{a["id"]}'
 if not file.exists():curl(a['image_url'],file)
 print(a['id'],a['title'],file.stat().st_size,flush=True)
(ROOT/'artworks.json').write_text(json.dumps(arts,ensure_ascii=False,indent=2))
