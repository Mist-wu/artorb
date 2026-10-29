# artorb · 世界名画的立体漫游

Production: https://artorb.pages.dev

一个作品展示网站：56 幅公版名画散布在可拖动的三维空间里，靠近、旋转、点开，读一段中文介绍。没有账号、没有后端、没有第三方请求，整站是部署在 Cloudflare Pages 上的静态文件。

## 体验

- 五种形状逐项切换：sphere / heart / smiley / star / grid。
- 拖动旋转、滚轮或双指缩放、悬停显示标注、点击进入作品详情、方向键切换。
- 场景里保持 307 张卡片的密度，去重后是 56 幅作品；计数显示的是实际作品数（paintings 53 + prints 3）。
- 420px 预览图作为三维纹理，点击时按需加载 960px 大图。
- 390px 手机视口下可完整阅读 8 段介绍，可滚动，无横向溢出。
- 初始加载无任何第三方网络请求，图像全部本地托管。

## 图片来源与许可

56 幅画来自 Wikimedia Commons。逐一检查文件 API 返回的 `extmetadata`，仅接受：

```
Copyrighted: False
LicenseShortName: Public domain
```

存在现代作品 / 不明图片 / 未满足该条件的文件均跳过。每幅画的原图、Commons 文件说明页、作者、年份、许可等记录在：

- `artworks.json` / `public/artworks.json`
- `commons-cache/license-*.json`（原始许可查询结果）
- 线上来源页：https://artorb.pages.dev/credits.html

作品介绍是本站独立撰写的中文短文。公版状态因法域而异，进一步使用时请参考文件说明页。

## 目录

```
public/               部署到 Cloudflare Pages 的静态站
  index.html          首页
  _next/              应用 runtime、渲染器与 CSS
  art/                名画图片（960px 宽）
    thumbs/           420px 长边预览
  credits.html        图片来源（由 scripts/build.py 生成）
  artworks.json       图片的来源与许可清单（生成）
  navigation.css/js   链接悬停与页间淡入淡出（支持减少动态效果）
  favicon.svg / robots.txt / sitemap.xml / _headers
curation.json         名画标题、中文名、作者、年代的选择清单
stories.json          8 段作品介绍
commons-cache/        Wikipedia / Commons API 的原始响应
scripts/
  collect-commons.py  下载并校验公版图片，生成 artworks.json
  build.py            生成缩略图、来源页、headers、sitemap 与清单
  verify.py           静态完整性检查
build-manifest.json   构建产物哈希（生成）
verification.json     静态验证结果
browser-verification.json  桌面 / 移动端交互测试结果
wrangler.toml         Cloudflare Pages 配置
```

`public/index.html`、`public/_next/` 和 `public/navigation.*` 是维护的应用资产。`scripts/build.py` 生成图片来源页、缩略图及部署清单，不覆盖这些应用文件。

`collect-art.py` / `museum-cache/` 是早期图库候选的查询记录；Art Institute 的图片端点对当前网络返回 403，最终没有使用其图像。

## 构建、测试、部署

```sh
python3 scripts/collect-commons.py  # 有缓存时不重复下载
python3 scripts/build.py
python3 scripts/verify.py
node --test scripts/navigation.test.cjs
python3 -m http.server 8799 --directory public
wrangler pages deploy public --project-name artorb --branch main
```

Cloudflare Pages 无需服务器或环境变量。图像与前端文件全部从本域名提供。
