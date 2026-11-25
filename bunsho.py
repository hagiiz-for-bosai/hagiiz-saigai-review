"""文章（Googleドキュメント）を読む。gen.py から呼ばれる。

入力：bunsho.json … {"T008": "（ドキュメントをMarkdownで書き出したもの）", ...}
   台帳のメニュー「サイトに反映する」が、台帳といっしょにGitHubへ送る。

読み方
- 「## 見出し」ごとに中身を分ける（見出しの名前はひな形どおり）
- 「ここから下はNoteに貼らない」より下は本文にしない。そこにある「管理」表から「状態」を読む
- 全体が（ ）で囲まれた段落は、まだ書いていない欄として捨てる（例：（防災士が書く））
- HTMLは、段落・箇条書き・リンク（http/https）・太字だけを作る。ほかの書き方は文字として出す
"""
import html
import json
import os
import re
from collections import OrderedDict

CUT = "ここから下はNoteに貼らない"


def _clean(s):
    s = re.sub(r"\\([\\`*_{}\[\]()#+\-.!|>~])", r"\1", s)  # Markdownのエスケープを外す
    return s.strip()


def _plain(s):
    return re.sub(r"\*\*|__", "", _clean(s)).strip()


def _inline(s):
    s = _clean(s)
    out, pos = [], 0
    for m in re.finditer(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", s):
        out.append(html.escape(s[pos:m.start()]))
        out.append('<a href="%s" target="_blank" rel="noopener">%s</a>' % (html.escape(m.group(2), quote=True), html.escape(_plain(m.group(1)))))
        pos = m.end()
    out.append(html.escape(s[pos:]))
    h = "".join(out)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", h)


def _placeholder(text):
    t = _plain(text)
    if "答える →" in t or "答える→" in t:
        return True  # 「この問いに答える →」はNote用。サイトでは出さない
    return not t or (t.startswith("（") and t.endswith("）"))


def _blocks(lines):
    """段落と箇条書きのHTMLにする"""
    out, para, items = [], [], []

    def flush():
        if para:
            t = " ".join(para)
            if not _placeholder(t):
                out.append("<p>%s</p>" % _inline(t))
            para.clear()
        if items:
            kept = [i for i in items if not _placeholder(i)]
            if kept:
                out.append("<ul>%s</ul>" % "".join("<li>%s</li>" % _inline(i) for i in kept))
            items.clear()

    for ln in lines:
        s = re.sub(r"^\s*>\s?", "", ln.rstrip())  # 引用の印（Googleの書き出しが付ける）を外す
        m = re.match(r"^\s*[-*+]\s+(.*)$", s)
        if not s.strip() or re.match(r"^\s*(-{3,}|\*{3,}|_{3,})\s*$", s):
            flush()
        elif m:
            if para:
                flush()
            items.append(m.group(1))
        elif s.lstrip().startswith("|"):
            flush()  # 表は本文にしない
        else:
            if items:
                flush()
            para.append(s.strip())
    flush()
    return "".join(out)


def parse(md):
    """1本の文章を {state, title, sections, chapters} にする"""
    lines = md.replace("\r\n", "\n").split("\n")
    state = ""
    for ln in lines:
        m = re.match(r"^\s*\|\s*状態\s*\|\s*([^|]*)\|", _clean(ln))
        if m:
            state = _plain(m.group(1))
    cut = next((i for i, ln in enumerate(lines) if CUT in ln), len(lines))
    body = lines[:cut]
    title, sections, chapters = "", OrderedDict(), []
    cur, buf, sub, sbuf = None, [], None, []

    def close_sub():
        if sub is not None:
            chapters.append({"t": sub, "html": _blocks(sbuf)})

    for ln in body:
        h = re.match(r"^(#{1,6})\s+(.*)$", ln)
        if h and len(h.group(1)) == 1 and not title:
            title = _plain(h.group(2))
            continue
        if h and len(h.group(1)) == 2:
            if cur is not None:
                close_sub()
                sections[cur] = _blocks(buf)
            cur, buf, sub, sbuf = _plain(h.group(2)), [], None, []
            continue
        if h and len(h.group(1)) >= 3 and cur == "台本":
            close_sub()
            sub, sbuf = _plain(h.group(2)), []
            continue
        if cur is None:
            continue
        (sbuf if sub is not None else buf).append(ln)
    if cur is not None:
        close_sub()
        sections[cur] = _blocks(buf)
    chapters = [c for c in chapters if not _placeholder(c["t"])]
    return {"state": state, "title": title, "sections": OrderedDict((k, v) for k, v in sections.items() if v), "chapters": chapters}


def load(path):
    if not path or not os.path.exists(path):
        return {}
    raw = json.load(open(path, encoding="utf-8"))
    return {k: parse(v) for k, v in raw.items() if isinstance(v, str)}
