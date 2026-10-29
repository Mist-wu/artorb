"""Regenerate the derived parts of the gallery: thumbnails, image credits, headers.

`public/index.html` and `public/_next/` are the hand-maintained application
assets; everything else under public/ is produced here from artworks.json.
"""
from pathlib import Path
import json, html, hashlib, subprocess
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public'
arts = json.loads((ROOT / 'artworks.json').read_text())
assert len(arts) >= 30, 'Run collect-commons.py first'
assert all(a['license'] == 'Public domain' and (OUT / a['img'].lstrip('/')).exists() for a in arts)

# Small thumbnails keep the 307 independent WebGL textures affordable on phones.
thumbs = OUT / 'art/thumbs'
thumbs.mkdir(parents=True, exist_ok=True)
for a in arts:
    original = OUT / a['img'].lstrip('/')
    if original.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n':
        # A Commons PNG may use a .jpg local name; normalize before Pages assigns its MIME type.
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '88', str(original), '--out', str(original)],
                       check=True, stdout=subprocess.DEVNULL)
    a['thumb'] = '/art/thumbs/' + Path(a['img']).name
    target = OUT / a['thumb'].lstrip('/')
    if not target.exists():
        subprocess.run(['sips', '-Z', '420', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', str(original), '--out', str(target)],
                       check=True, stdout=subprocess.DEVNULL)

# Image credits: exact source pages, public-domain declarations, original files.
rows = ''.join(
    f'<tr><td><img src="{a["img"]}" alt="{html.escape(a["title"])}" loading="lazy"></td>'
    f'<td><a href="{html.escape(a["source"], quote=True)}" target="_blank" rel="noopener noreferrer">{html.escape(a["title"])}</a>'
    f'<br><small>{html.escape(a["artist"])} · {a["year"]}</small></td>'
    f'<td><a href="{html.escape(a["original"], quote=True)}">原图 ↗</a></td></tr>'
    for a in arts)
(OUT / 'credits.html').write_text('''<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>artorb · 图片来源</title><style>*{box-sizing:border-box}body{margin:0;background:#bfbfbf;color:#242427;font:16px/1.8 Arial,"PingFang SC",sans-serif}main{max-width:920px;margin:70px auto;padding:24px}h1{font-size:30px;font-weight:400}a{color:inherit;text-underline-offset:4px}p{max-width:720px}table{border-collapse:collapse;width:100%;margin:40px 0}td{padding:18px 12px;border-bottom:1px solid #a4a4a4}td img{width:84px;height:75px;object-fit:contain}small{color:#555}@media(max-width:600px){main{margin:25px auto;padding:20px}td{padding:14px 5px;font-size:13px}td img{width:54px}}</style><main><a href="/">← artorb</a><h1>名画属于所有观看的人。</h1><table>''' + rows + '''</table><a href="/">返回</a></main></html>''')

(OUT / 'artworks.json').write_text(json.dumps(arts, ensure_ascii=False, indent=2))
(OUT / '_headers').write_text('''/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
/
  Cache-Control: no-cache
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
/art/*
  Cache-Control: public, max-age=604800
''')
(OUT / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: https://artorb.pages.dev/sitemap.xml\n')
(OUT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://artorb.pages.dev/</loc></url><url><loc>https://artorb.pages.dev/credits</loc></url></urlset>')

assert not (OUT / 'fonts').exists()
manifest = {str(p.relative_to(OUT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file()}
(ROOT / 'build-manifest.json').write_text(json.dumps(manifest, indent=2))
print(f'Built {len(arts)} public-domain paintings, {len(arts) * 2} image files, {len(manifest)} files.')
