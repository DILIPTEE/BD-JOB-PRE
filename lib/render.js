// HTML sanitizer + plain-text → HTML formatter used to render answers safely
// and in a standard way on the public site (tables, lists, headings, etc.).
// No external dependencies.

const SAFE_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'caption', 'a', 'code', 'pre', 'blockquote', 'hr', 'div', 'span', 'sup', 'sub',
]);

const SAFE_ATTRS = new Set([
  'href', 'target', 'rel', 'title', 'colspan', 'rowspan', 'align', 'width', 'height',
]);

const SAFE_URL_PREFIXES = ['http://', 'https://', 'mailto:', 'tel:', '/', '#', '?'];

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Whitelist-based sanitizer for contenteditable HTML. */
function sanitizeHtml(html) {
  let s = String(html == null ? '' : html);

  // Drop whole dangerous elements (and their content).
  s = s.replace(/<\s*(\/)?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|video|audio|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\2\s*>/gi, '');
  s = s.replace(/<\s*(script|style|iframe|object|embed|form|input|button|textarea|select|option|meta|link|video|audio|svg|math)\b[^>]*>/gi, '');

  // Remove event handlers and javascript: URIs.
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|src)\s*=\s*("|'|)(javascript:|vbscript:|data:text\/html)[^"'\s>]*("|'|)/gi, '');

  // Whitelist remaining tags & attributes.
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))*)\s*\/?>/g, (m, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!SAFE_TAGS.has(t)) return '';
    const isClose = m[1] === '/';
    let out = (isClose ? '</' : '<') + t;
    if (!isClose) {
      const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let am;
      while ((am = attrRe.exec(attrs || ''))) {
        const name = am[1].toLowerCase();
        if (!SAFE_ATTRS.has(name)) continue;
        let val = am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : (am[5] || ''));
        if ((name === 'href' || name === 'src') && !SAFE_URL_PREFIXES.some((p) => val.toLowerCase().startsWith(p))) continue;
        val = val.replace(/[<>]/g, '').replace(/&(?!#\d+;)/g, '&amp;').replace(/"/g, '&quot;');
        out += ' ' + name + '="' + val + '"';
      }
    }
    return out + '>';
  });

  // Collapse stray leftover tags like </p > safely.
  s = s.replace(/<(\/?)>/g, '');
  return s;
}

/** Light inline markdown: **bold**, *italic*, `code`. Operates on escaped text. */
function inlineFormat(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>');
}

/** Convert plain text (with tables / lists / headings) into standard HTML. */
function textToHtml(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const out = [];
  let listType = null;
  let listItems = [];

  const flushList = () => {
    if (listItems.length) {
      out.push('<' + listType + '>' + listItems.map((i) => '<li>' + i + '</li>').join('') + '</' + listType + '>');
      listItems = [];
      listType = null;
    }
  };
  let para = [];
  const flushPara = () => {
    if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; }
  };
  const isPipe = (l) => /^\s*\|.*\|\s*$/.test(l);

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Pipe table block
    if (isPipe(line)) {
      flushList(); flushPara();
      const rows = [];
      while (i < lines.length && isPipe(lines[i])) {
        const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
        rows.push(cells);
        i++;
      }
      let table = '<table>';
      let body = rows;
      let head = null;
      if (rows.length > 1 && rows[1].every((c) => /^:?-+:?$/.test(c))) {
        head = rows[0];
        body = rows.slice(2);
        table += '<thead><tr>' + head.map((c) => '<th>' + inlineFormat(escapeHtml(c)) + '</th>').join('') + '</tr></thead>';
      }
      table += '<tbody>' + body.map((r) => '<tr>' + r.map((c) => '<td>' + inlineFormat(escapeHtml(c)) + '</td>').join('') + '</tr>').join('') + '</tbody>';
      table += '</table>';
      out.push(table);
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flushList(); flushPara();
      out.push('<h' + (h[1].length + 1) + '>' + inlineFormat(escapeHtml(h[2])) + '</h' + (h[1].length + 1) + '>');
      i++;
      continue;
    }

    // Bullet list
    const bu = line.match(/^[-•*]\s+(.*)$/);
    if (bu) {
      flushPara();
      if (listType && listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(inlineFormat(escapeHtml(bu[1])));
      i++;
      continue;
    }

    // Numbered list
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (listType && listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(inlineFormat(escapeHtml(ol[1])));
      i++;
      continue;
    }

    // Blank line
    if (line === '') {
      flushList(); flushPara();
      i++;
      continue;
    }

    // Normal paragraph line
    flushList();
    para.push(inlineFormat(escapeHtml(line)));
    i++;
  }
  flushList();
  flushPara();
  return out.join('\n');
}

/** Decide how to render a stored answer: HTML as-is (sanitized) or text formatted. */
function renderAnswer(text) {
  const s = String(text == null ? '' : text);
  const looksLikeHtml = /<\/?[a-z][^>]*>/i.test(s) || /\n?\s*<[a-z]+/i.test(s);
  return looksLikeHtml ? sanitizeHtml(s) : textToHtml(s);
}

module.exports = { sanitizeHtml, escapeHtml, textToHtml, renderAnswer };