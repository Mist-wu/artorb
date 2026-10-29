"""Static integrity checks for the deployed gallery."""
from pathlib import Path
import json, re, subprocess
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public'
arts = json.loads((OUT / 'artworks.json').read_text())
assert len(arts) >= 50
assert len({a['id'] for a in arts}) == len(arts)

# Every artwork keeps a Commons file page, a public-domain declaration and two local images.
for a in arts:
    assert a['license'] == 'Public domain'
    assert a['source'].startswith('https://commons.wikimedia.org/wiki/File:')
    for k in ['img', 'thumb']:
        f = OUT / a[k].lstrip('/')
        assert f.exists() and f.stat().st_size > 1000, (a['id'], k)
        assert b'<html' not in f.read_bytes()[:200].lower()

html = (OUT / 'index.html').read_text()
for ref in set(re.findall(r'(?:src|href)="(/[^"?#]*)', html)):
    assert (OUT / ref.lstrip('/')).is_file(), ref
assert 'xfumbjnq' not in html
assert '/prototypes/' not in html
assert 'artorb — 世界名画，立体漫游' in html
assert not (OUT / 'fonts').exists()

# Pages and assets must only describe the site itself and its image sources.
FORBIDDEN = ['不主张', '原作者', '原站', '开源授权']
for page in [OUT / 'index.html', OUT / 'credits.html', OUT / '_headers', OUT / 'robots.txt']:
    text = page.read_text().lower()
    for word in FORBIDDEN:
        assert word.lower() not in text, (page.name, word)
for asset in (OUT / '_next').rglob('*'):
    if asset.is_file() and asset.suffix in {'.js', '.css', '.html'}:
        text = asset.read_text(errors='ignore').lower()
        for word in FORBIDDEN:
            assert word.lower() not in text, (asset.name, word)
        assert 'mirror' not in asset.name, asset.name

app_refs = re.findall(r'<script src="([^"]*/artorb-[a-f0-9]+\.js)"', html)
assert len(app_refs) == 1
app = (OUT / app_refs[0].lstrip('/')).read_text()
stories = [{k: v for k, v in story.items() if k != 'color'}
           for story in json.loads((ROOT / 'stories.json').read_text())]
assert 'let _=' + json.dumps(stories, ensure_ascii=False, separators=(',', ':')) + ';' in app
assert '图片来自维基共享资源的开放图像库' not in app
credits = (OUT / 'credits.html').read_text()
assert '<a href="/">返回</a>' in credits
assert '回到名画轨道' not in credits
assert 'public domain' not in (html + app + credits).lower()
assert '<p>' not in credits
assert credits.count('<tr>') == len(arts)
for js in (OUT / '_next').rglob('*.js'):
    subprocess.run(['node', '--check', str(js)], check=True, capture_output=True)

print(json.dumps({'artworks': len(arts), 'images': len(arts) * 2, 'public_domain_verified': True,
                  'missing_assets': 0, 'forbidden_provenance_strings': 0, 'javascript_syntax': 'pass'},
                 ensure_ascii=False, indent=2))
