#!/usr/bin/env node
/**
 * 生成 themes/hugo-theme-yelee/static/gromang/dl-meta.json：Gitee 发版资产 → 文件字节数。
 *
 * 为什么需要这个文件：产品站页面运行时从 Gitee API 实时读取版本与下载链接，
 * 但 Gitee 公开 API 的资产不带体积字段、下载链路也不发 CORS 头——浏览器端
 * 拿不到 Content-Length。只能在构建/发布时用本脚本量一次，页面按「资产文件名」
 * 匹配补上大小；版本更新后文件名变化、匹配不到就不显示，不会拿旧大小配新版本。
 *
 * 发新版后重跑一次：node scripts/gen-dl-meta.mjs（Node 18+，无需依赖）。
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API =
  "https://gitee.com/api/v5/repos/nicky-chin/gromang/releases?per_page=20&direction=desc";
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "themes/hugo-theme-yelee/static/gromang/dl-meta.json",
);

const res = await fetch(API);
if (!res.ok) throw new Error(`Gitee API ${res.status}`);
const releases = await res.json();

const sizes = {};
for (const r of releases) {
  for (const a of r.assets || []) {
    if (sizes[a.name] !== undefined) continue; // 同名资产只记最新发版的
    try {
      const h = await fetch(a.browser_download_url, { method: "HEAD" });
      const len = h.headers.get("content-length");
      if (h.ok && len) {
        sizes[a.name] = Number(len);
        console.log(`ok   ${r.tag_name}  ${a.name}  ${(len / 1024 / 1024).toFixed(1)} MB`);
      } else {
        console.log(`skip ${r.tag_name}  ${a.name}  (status ${h.status})`);
      }
    } catch (e) {
      console.log(`err  ${a.name}: ${e.message}`);
    }
  }
}

await writeFile(OUT, JSON.stringify(sizes, null, 2) + "\n");
console.log(`\nwrote ${OUT} (${Object.keys(sizes).length} assets)`);
