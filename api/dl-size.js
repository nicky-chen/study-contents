// Vercel Serverless Function：实时查询 Gitee 发版资产的文件大小。
//
// 为什么需要它：产品站页面运行时从 Gitee API 实时读取版本与下载链接，但
// Gitee 公开 API 不返回资产体积、下载链路（两级 302 + 附件响应）也不发
// CORS 头——浏览器端无法跨域拿到 Content-Length。站点部署在 Vercel，
// 用这个同源函数在服务端 HEAD 一次即可。
//
// - 仅放行本仓库发版下载链接（白名单前缀），防被当通用代理（SSRF）；
// - 响应交给 CDN 缓存一天（s-maxage），发新版后 url 参数变化自然换缓存键；
// - 函数不可用时页面自动回落到构建时生成的 dl-meta.json（scripts/gen-dl-meta.mjs）。
const ALLOWED_PREFIX = "https://gitee.com/nicky-chin/gromang/releases/download/";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
  );

  const url = (req.query && req.query.url) || "";
  if (!url.startsWith(ALLOWED_PREFIX)) {
    res.status(400).json({ error: "url not allowed" });
    return;
  }

  try {
    const h = await fetch(url, { method: "HEAD" });
    const len = h.headers.get("content-length");
    if (!h.ok || !len) throw new Error(`upstream ${h.status}`);
    res.status(200).json({ size: Number(len) });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
