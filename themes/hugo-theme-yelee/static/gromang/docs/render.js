// 轻量 markdown 渲染器 —— 为句芒智元官网 docs 页面定制。
// 支持子集（对齐使用者文档实际用到的语法）：
//   ATX 标题、段落、表格、引用块、有序/无序（一层嵌套）列表、水平线、围栏代码块；
//   行内：`code`、**bold**、[链接](url)、<https://角括号自动链>、裸 URL。
// 链接改写：#锚点 → #d-锚点（避免与文档路由 hash 冲突）；./x.md → #文档id；外链加 target=_blank。
// HTML 转义先行，防注入；代码段内容单独转义。

const PUNCT_STRIP = /[.,:;!?"'`*+#()[\]{}<>=~|/$–—·、。，：；！？“”‘’（）《》〈〉「」『』【】…]/g;

export function slugify(text) {
  return text.trim().toLowerCase()
    .replace(PUNCT_STRIP, '')
    .replace(/ /g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeHref(url) {
  return String(url).replace(/[<>"]/g, '');
}

// ---------- 行内 ----------

function makeInline(ctx) {
  const { anchors, docIds } = ctx;

  function isExternal(u) { return /^(https?:|mailto:)/.test(u); }

  function transformHref(url) {
    const u = safeHref(url);
    if (u.startsWith('#')) {
      const a = u.slice(1);
      return anchors.has(a) ? '#d-' + a : '#' + a;
    }
    const m = u.match(/^\.?\/?(?:\.\.\/)?([\w.-]+?)\.md$/);
    if (m && docIds.has(m[1])) return '#' + m[1];
    return u;
  }

  function boldify(s) {
    return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  return function renderInline(text) {
    if (!text) return '';
    // 1) 行内代码段：内容单独转义，以占位符保护
    const codeSlots = [];
    let s = text.replace(/`([^`]+)`/g, (_, code) => {
      codeSlots.push('<code>' + escapeHtml(code) + '</code>');
      return '\u0000C' + (codeSlots.length - 1) + '\u0000';
    });
    // 2) 转义其余文本
    s = escapeHtml(s);
    // 3) 生成 <a> 标签的三个来源都先进占位槽，防止被后续替换二次加工
    const anchorSlots = [];
    const slot = (html) => { anchorSlots.push(html); return '\u0000A' + (anchorSlots.length - 1) + '\u0000'; };
    // 3a) 角括号自动链接（转义后的形态）
    s = s.replace(/&lt;(https?:[^&\s]*)&gt;/g, (_, url) => {
      const u = safeHref(url);
      return slot('<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>');
    });
    // 3b) markdown 链接（链接文本内允许 bold）
    s = s.replace(/\[([^\][\n]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
      const routed = transformHref(url);
      const attrs = isExternal(url) ? ' target="_blank" rel="noopener"' : '';
      return slot('<a href="' + safeHref(routed) + '"' + attrs + '>' + boldify(txt) + '</a>');
    });
    // 4) bold
    s = boldify(s);
    // 5) 裸 URL 自动链接
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)\u0000]+)/g, (_, pre, url) => {
      const u = safeHref(url);
      return pre + slot('<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>');
    });
    // 6) 还原占位
    s = s.replace(/\u0000A(\d+)\u0000/g, (_, i) => anchorSlots[i]);
    s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => codeSlots[i]);
    return s;
  };
}

// ---------- 块级 ----------

const HEAD_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HR_RE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;
const FENCE_RE = /^\s*```/;

function isTableSep(line) {
  const t = line.trim();
  return t.startsWith('|') && t.replace(/\|/g, '') !== '' &&
    /^[\s:|-]*-[\s:|-]*$/.test(t.replace(/\|/g, ''));
}

function splitRow(line) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map(c => c.trim());
}

export function renderMarkdown(md, opts = {}) {
  const docIds = new Set(opts.docIds || []);
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');

  // 第一遍：收集标题锚点（供 #锚点 链接解析）
  const anchors = new Set();
  for (const line of lines) {
    const m = line.match(HEAD_RE);
    if (m) anchors.add(slugify(m[2]));
  }
  const renderInline = makeInline({ anchors, docIds });

  const out = [];
  let para = [];
  const flushPara = () => {
    if (!para.length) return;
    out.push('<p>' + renderInline(para.join('\n')) + '</p>');
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    if (FENCE_RE.test(line)) {
      flushPara();
      const buf = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre><code>' + escapeHtml(buf.join('\n')) + '</code></pre>');
      continue;
    }

    // 标题
    const hm = line.match(HEAD_RE);
    if (hm) {
      flushPara();
      const level = Math.min(hm[1].length, 4);
      const slug = slugify(hm[2]);
      out.push('<h' + level + ' id="d-' + slug + '">' + renderInline(hm[2]) + '</h' + level + '>');
      i++;
      continue;
    }

    // 水平线
    if (HR_RE.test(line)) {
      flushPara();
      out.push('<hr>');
      i++;
      continue;
    }

    // 表格
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushPara();
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const cols = head.length;
      let html = '<div class="md-table"><table><thead><tr>';
      for (let c = 0; c < cols; c++) html += '<th>' + renderInline(head[c] || '') + '</th>';
      html += '</tr></thead><tbody>';
      for (const row of rows) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) html += '<td>' + renderInline(row[c] || '') + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
      out.push(html);
      continue;
    }

    // 引用块
    if (line.trim().startsWith('>')) {
      flushPara();
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const t = lines[i].trim();
        if (t === '>') buf.push('');
        else if (t.startsWith('> ')) buf.push(t.slice(2));
        else buf.push(t.slice(1));
        i++;
      }
      const paras = [];
      let cur = [];
      for (const l of buf) {
        if (l === '') { if (cur.length) { paras.push(cur.join('\n')); cur = []; } }
        else cur.push(l);
      }
      if (cur.length) paras.push(cur.join('\n'));
      out.push('<blockquote>' + paras.map(p => '<p>' + renderInline(p) + '</p>').join('') + '</blockquote>');
      continue;
    }

    // 列表（支持一层嵌套）
    const lm = line.match(LIST_RE);
    if (lm) {
      flushPara();
      const items = [];
      while (i < lines.length) {
        const m2 = lines[i].match(LIST_RE);
        if (m2) {
          items.push({ indent: m2[1].length, ordered: /\d/.test(m2[2][0]), text: m2[3] });
          i++;
        } else if (items.length && lines[i].trim() === '' && lines[i + 1] && LIST_RE.test(lines[i + 1])) {
          i++; // 列表项之间的空行且后面仍是列表 → 继续
        } else if (items.length && /^ {2,}\S/.test(lines[i]) && lines[i].trim()) {
          items[items.length - 1].text += ' ' + lines[i].trim(); // 缩进续行
          i++;
        } else break;
      }
      const baseIndent = items[0].indent;
      let html = '';
      let open = null; // 'ol' | 'ul'
      let openOrdered = null;
      const closeList = () => { if (open) { html += '</' + open + '>'; open = null; openOrdered = null; } };
      for (const it of items) {
        if (it.indent <= baseIndent) {
          // 仅在列表类型切换时才关闭重开；同类型根条目续接同一列表（保序号连续）
          if (open && openOrdered === it.ordered) {
            html += '<li>' + renderInline(it.text) + '</li>';
          } else {
            closeList();
            openOrdered = it.ordered;
            open = it.ordered ? 'ol' : 'ul';
            html += '<' + open + '>';
            html += '<li>' + renderInline(it.text) + '</li>';
          }
        } else {
          html = html.replace(/<\/li>$/, '');
          html += (it.ordered ? '<ol>' : '<ul>') + '<li>' + renderInline(it.text) + '</li></' + (it.ordered ? 'ol' : 'ul') + '>';
          html += '</li>';
        }
      }
      closeList();
      out.push(html);
      continue;
    }

    // 空行
    if (line.trim() === '') { flushPara(); i++; continue; }

    // 普通段落行
    para.push(line.trim());
    i++;
  }
  flushPara();
  return out.join('\n');
}
