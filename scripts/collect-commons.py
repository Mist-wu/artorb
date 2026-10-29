"""Curate public-domain master paintings from Wikimedia Commons, with license checks.
No source images are hotlinked at runtime: optimized local copies are deployed.
"""
from pathlib import Path
from urllib.parse import urlencode,unquote,urlparse
import json,subprocess,time,html
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'commons-cache';CACHE.mkdir(exist_ok=True)
IMAGES=ROOT/'public/art';IMAGES.mkdir(parents=True,exist_ok=True)
curation=json.loads((ROOT/'curation.json').read_text())

def get(url,file):
 for attempt in range(4):
  actual=url+('&maxlag=5' if attempt and '/w/api.php?' in url else '')
  p=subprocess.run(['curl','-fsSL','--retry','2','--retry-all-errors','--max-time','80','-A','Artorb/1.0 (public-domain art study)',actual,'-o',str(file)])
  if p.returncode==0:
   time.sleep(1)
   return
  time.sleep(2+attempt)
 raise RuntimeError('Unable to download '+url)

pages={}
for start in range(0,len(curation),20):
 batch=curation[start:start+20];f=CACHE/f'pages-{start}.json'
 if not f.exists():get('https://en.wikipedia.org/w/api.php?'+urlencode({'action':'query','format':'json','redirects':1,'titles':'|'.join(a[0] for a in batch),'prop':'pageimages','piprop':'thumbnail|original','pithumbsize':960}),f)
 data=json.loads(f.read_text())['query']
 rows={v['title']:v for v in data['pages'].values()}
 normalized={v['from']:v['to'] for v in data.get('normalized',[])}
 redirected={v['from']:v['to'] for v in data.get('redirects',[])}
 for a in batch:
  title=normalized.get(a[0],a[0]);title=redirected.get(title,title)
  if title in rows:pages[a[0]]=rows[title]

arts=[]
for i,(page,title,artist,year) in enumerate(curation):
 row=pages.get(page,{})
 if not row.get('thumbnail') or not row.get('original'):print('SKIP missing',page,flush=True);continue
 original=row['original']['source'].split('?')[0]
 if '/wikipedia/commons/' not in original:print('SKIP non-commons',page,flush=True);continue
 filename=unquote(urlparse(original).path.rsplit('/',1)[-1])
 f=CACHE/f'license-{i}.json'
 if not f.exists():get('https://commons.wikimedia.org/w/api.php?'+urlencode({'action':'query','format':'json','titles':'File:'+filename,'prop':'imageinfo','iiprop':'url|extmetadata'}),f)
 metadata=json.loads(f.read_text()).get('query',{}).get('pages',{})
 info=next((v['imageinfo'][0] for v in metadata.values() if v.get('imageinfo')),None)
 if not info:print('SKIP metadata',page,flush=True);continue
 em=info['extmetadata'];license=em.get('LicenseShortName',{}).get('value','');copyright=em.get('Copyrighted',{}).get('value','')
 if copyright!='False' or not ('public domain' in license.lower() or license.lower()=='cc0'):
  print('SKIP license',page,license,copyright,flush=True);continue
 thumb=row['thumbnail']['source'].split('?')[0]
 file=IMAGES/f'master-{i:02}.jpg'
 if not file.exists():get(thumb,file)
 # Use sips to check real dimensions and to cap imagery for fast GPU textures.
 output=subprocess.check_output(['sips','-g','pixelWidth','-g','pixelHeight',str(file)],text=True)
 import re
 w=int(re.search(r'pixelWidth: (\d+)',output)[1]);h=int(re.search(r'pixelHeight: (\d+)',output)[1])
 art={'id':f'master-{i:02}','title':title,'title_en':row['title'],'artist':artist,'year':year,'img':'/art/'+file.name,'w':w,'h':h,'source':info['descriptionurl'],'license':license,'original':original,'downloaded_from':thumb,'tag':'image' if artist in ['葛饰北斋','歌川广重'] else 'prototype'}
 arts.append(art)
 (ROOT/'artworks.json').write_text(json.dumps(arts,ensure_ascii=False,indent=2))
 print('OK',art['id'],title,license,file.stat().st_size,flush=True)
print('TOTAL',len(arts),flush=True)
