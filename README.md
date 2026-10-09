# Casa Yun 网站源码(重构版)

这是 casayun.com 的源码仓库,由 2026-10-09 的纯静态单文件站重构而来。
**铁律:零视觉改动** —— 构建输出 `dist/index.html` 与旧生产文件字节级一致
(已用 `node scripts/validate.mjs` 验证)。

## 目录结构

```
casayun-source/
├── content/posts/            # 可编辑内容:2 篇文章 x 6 种语言 = 12 个 Markdown
│   ├── ppk-old-age.{en,zh,zhHans,es,pt,ja}.md
│   └── kefir.{en,zh,zhHans,es,pt,ja}.md
├── src/
│   ├── template.html         # 页面骨架(原 index.html,博客区留了 4 个占位符)
│   └── partials/             # 首屏默认文字的冻结 HTML(字节级原文,不由 Markdown 生成)
├── scripts/
│   ├── build.mjs             # 构建脚本:Markdown -> 翻译注入 -> dist/(零依赖)
│   ├── validate.mjs          # 校验:字节一致 + 六语言键全覆盖 + 文章键模拟切换
│   └── extract-posts.py      # 一次性抽取脚本(12 个 md 即由此生成,留作以后抽其他文章用)
├── public/admin/             # Decap CMS 后台(/admin 可访问)
│   ├── index.html
│   └── config.yml            # repo 字段待填真实仓库名
├── assets/                   # 图片(与旧站一致)
├── dist/                     # 构建产物(git 不入库,Vercel 用它部署)
├── vercel.json               # buildCommand: node scripts/build.mjs, output: dist
├── CNAME / sitemap.xml / google 验证文件
└── package.json              # npm run build / npm run validate(零依赖)
```

## 构建与校验

```bash
node scripts/build.mjs      # 输出到 dist/
node scripts/validate.mjs   # 三项检查,全过才算成功
```

构建逻辑:
1. 读 `src/template.html`,把 4 个占位符换成 `src/partials/` 的冻结 HTML。
2. 从 12 个 Markdown 生成两篇文章在 `translations` / `shopTranslations`
   六种语言下的全部翻译键值,注入页面 `<script>`(字符串感知替换,格式不动)。
3. 复制 `assets/`、`CNAME`、`sitemap.xml`、Google 验证文件和 `public/` 到 `dist/`。

## 内容编辑契約(给 Decap CMS / 手动编辑用)

- Front matter 字段与翻译键一一对应(见 `scripts/build.mjs` 顶部 `POSTS` 表)。
  改错别字、换标题、改日期:只改对应语言的 md,构建后六处入口
  (首页卡片、文章页、栏目列表、栏目详情)自动同步。
- **正文块的顺序和种类不许变**(段落 / `##` 小标题 / `![alt](src)` 配图)。
  文字随便改,结构由构建脚本锁定;块数或种类对不上构建会直接报错退出。
- `**加粗**` 会转成 `<strong>加粗</strong>`(克菲尔文的四个步骤用它)。
- 图片 `alt` 文字会同时作为翻译 `*PhotoAlt*` 键的值(kefir 的图注 = alt 文字,
  与旧站行为一致;ppk 文中图无图注)。
- 语言代号沿用站内原代号:`en` 英文、`zh` 繁中、`zhHans` 简中、`es` 西语、
  `pt` 葡语、`ja` 日语(不要改成 zh-TW 这类,构建直接映射 JS 键)。

## Decap CMS 上线步骤(需用户配合)

1. 把本仓库推到 GitHub 后,把 `public/admin/config.yml` 里
   `repo: elpuntoyun-dotcom/CASA-YUN-REPO` 换成真实的 `用户名/仓库名`。
2. **OAuth 授权网关**(github backend 在浏览器登录必需,三选一):
   - A(推荐,Vercel):部署一个极小的 GitHub OAuth 中转服务(约 30 行 serverless
     函数),在 config.yml 加 `auth_endpoint: https://<你的服务>/auth`;
   - B:网站改托管到 Netlify 并启用 Netlify Identity + git-gateway(改 backend.name);
   - C:继续用 Decap 默认的 Netlify OAuth 网关(需先在 Netlify 建站点)。
3. 访问 `https://casayun.com/admin`,用 GitHub 账号登录即可可视化编辑;
   点 Publish = 提交到 GitHub = Vercel 自动重新构建部署。

## 部署说明

- Vercel 连 GitHub 仓库后会自动读取 `vercel.json`,无需其他配置。
- 当前生产站仍在旧部署上;切流量前必须走预览部署 + 六语言人工点检
  (语言切换是历史事故高危区)。
- 其他文章(mushroom/moon/rename/序/玛德琳/下单/关于页)仍嵌在模板里,
  以后抽取时复用 `scripts/extract-posts.py` 的思路。
