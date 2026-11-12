/**
 * HagiiZ 災害レビュー：台帳のメニュー（Googleスプレッドシート「台帳」に貼る）
 *
 * メニュー「サイト」
 *  - 新しい行        … 今のシートの最後に、次のIDを付けた行を足す
 *  - 文章をつくる    … 選んだ行のドキュメントを、ひな形から作ってURLを入れる（災害・法律・レッスン・未来への問い）
 *  - 根拠カード確認表を差し込む … 選んだ災害のドキュメントに、根拠カードの確認表を入れ直す
 *  - 文章の状態を取りこむ … 全ドキュメントの「管理」表と確認表を読み、台帳に写す
 *  - サイトに反映する … 台帳（Excel）と文章（Markdown）をGitHubに送る → Cloudflareが自動でページを作り直す
 *
 * 最初に1回：「プロジェクトの設定 → スクリプト プロパティ」に次を入れる
 *  GITHUB_TOKEN … GitHubの細かい権限のトークン（このリポジトリだけ、Contents：読み書き）
 *  GITHUB_REPO  … ikemotoatsuya-business/hagiiz-saigai-review
 *  ROOT_FOLDER  … 「HagiiZ 災害レビュー」フォルダのID（省略可。省略すると名前で探す）
 */

var PREFIX = { '災害': 'D', '法律': 'L', '改正': 'A', '科学': 'P', '資料': 'S', '数字': 'N', '未来への問い': 'T', '根拠カード': 'E', 'レッスン': 'R', '動画': 'V', '団体': 'G' };
var DOC_KIND = {
  '災害': { folder: '災害の説明', template: 'ひな形_災害の説明', name: '災害名' },
  '法律': { folder: '法律の説明', template: 'ひな形_法律の説明', name: '法律名' },
  'レッスン': { folder: 'レッスンの台本', template: 'ひな形_レッスンの台本', name: '見出し' },
  '未来への問い': { folder: '問いの背景', template: 'ひな形_問いの背景', name: '見出し' }
};
var DOC_COL = '文章（ドキュメントのURL）';
var STATE_COL = '文章の状態';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('サイト')
    .addItem('新しい行', 'newRow')
    .addItem('文章をつくる', 'makeDoc')
    .addItem('根拠カード確認表を差し込む', 'insertCardTable')
    .addSeparator()
    .addItem('文章の状態を取りこむ', 'pullDocStates')
    .addItem('サイトに反映する', 'publishSite')
    .addToUi();
}

// ---------- 小物 ----------
function headers_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; }
function col_(sh, name) { var i = headers_(sh).indexOf(name); if (i < 0) throw new Error('「' + sh.getName() + '」に「' + name + '」の列がありません'); return i + 1; }
function rootFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER');
  if (id) return DriveApp.getFolderById(id);
  var it = DriveApp.getFoldersByName('HagiiZ 災害レビュー');
  if (!it.hasNext()) throw new Error('「HagiiZ 災害レビュー」フォルダが見つかりません');
  return it.next();
}
function sub_(parent, name) { var it = parent.getFoldersByName(name); if (!it.hasNext()) throw new Error('フォルダ「' + name + '」がありません'); return it.next(); }
function docId_(url) { var m = String(url || '').match(/\/d\/([\w-]+)/); return m ? m[1] : ''; }
function log_(kind, text) {
  var sh = SpreadsheetApp.getActive().getSheetByName('更新の記録');
  if (sh) sh.appendRow([Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'), kind, text, Session.getActiveUser().getEmail() || '', '']);
}

// ---------- 新しい行 ----------
function newRow() {
  var sh = SpreadsheetApp.getActiveSheet(), p = PREFIX[sh.getName()];
  if (!p) { SpreadsheetApp.getUi().alert('このシートでは使えません（IDを自動で付けるシート：' + Object.keys(PREFIX).join('、') + '）'); return; }
  var ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var max = 0, width = 3;
  ids.forEach(function (s) { var m = s.match(new RegExp('^' + p + '(\\d+)$')); if (m) { max = Math.max(max, Number(m[1])); width = Math.max(width, m[1].length); } });
  var id = p + ('000000' + (max + 1)).slice(-width);
  sh.appendRow([id]);
  sh.setActiveRange(sh.getRange(sh.getLastRow(), 2));
  SpreadsheetApp.getActive().toast(id + ' を足しました');
}

// ---------- 文章をつくる ----------
function makeDoc() {
  var sh = SpreadsheetApp.getActiveSheet(), kind = DOC_KIND[sh.getName()];
  if (!kind) { SpreadsheetApp.getUi().alert('災害・法律・レッスン・未来への問いのシートで、行を選んでから押してください'); return; }
  var row = sh.getActiveRange().getRow();
  if (row < 2) { SpreadsheetApp.getUi().alert('見出しではなく、行を選んでください'); return; }
  var h = headers_(sh), v = sh.getRange(row, 1, 1, h.length).getValues()[0];
  var id = String(v[0]), name = String(v[h.indexOf(kind.name)] || '');
  if (v[h.indexOf(DOC_COL)]) { SpreadsheetApp.getUi().alert(id + ' にはもう文章があります'); return; }
  var root = rootFolder_(), words = sub_(root, '文章');
  var tpl = sub_(words, 'ひな形').getFilesByName(kind.template);
  if (!tpl.hasNext()) throw new Error('ひな形「' + kind.template + '」がありません');
  var file = tpl.next().makeCopy(id + '_' + name, sub_(words, kind.folder));
  var doc = DocumentApp.openById(file.getId());
  doc.getBody().replaceText('（[A-Z]000）', id);
  if (name) doc.getBody().getParagraphs()[0].setText(name);
  doc.saveAndClose();
  sh.getRange(row, col_(sh, DOC_COL)).setValue(file.getUrl());
  if (h.indexOf(STATE_COL) >= 0) sh.getRange(row, col_(sh, STATE_COL)).setValue('下書き');
  log_(id, '文章をつくった');
  SpreadsheetApp.getActive().toast(id + ' の文章をつくりました');
}

// ---------- 根拠カード確認表 ----------
function insertCardTable() {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== '災害') { SpreadsheetApp.getUi().alert('「災害」シートで、災害の行を選んでから押してください'); return; }
  var row = sh.getActiveRange().getRow(), h = headers_(sh), v = sh.getRange(row, 1, 1, h.length).getValues()[0];
  var did = String(v[0]), id = docId_(v[h.indexOf(DOC_COL)]);
  if (!id) { SpreadsheetApp.getUi().alert('先に「文章をつくる」を押してください'); return; }
  var cs = SpreadsheetApp.getActive().getSheetByName('根拠カード'), ch = headers_(cs);
  var cards = cs.getRange(2, 1, Math.max(cs.getLastRow() - 1, 1), ch.length).getValues()
    .filter(function (r) { return String(r[ch.indexOf('災害ID')]) === did; });
  var body = DocumentApp.openById(id).getBody();
  // 前の確認表（1行目の1列目が「カードID」の表）を消す
  body.getTables().forEach(function (t) { if (t.getCell(0, 0).getText() === 'カードID') t.removeFromParent(); });
  var rows = [['カードID', '1文', '出典', '確認']].concat(cards.map(function (r) {
    return [String(r[0]), String(r[ch.indexOf('1文')]), String(r[ch.indexOf('資料ID')] || r[ch.indexOf('改正ID')] || ''), ''];
  }));
  body.appendTable(rows);
  SpreadsheetApp.getActive().toast('根拠カード ' + cards.length + '枚の確認表を入れました');
}

// ---------- 文章の状態を取りこむ ----------
function pullDocStates() {
  var ss = SpreadsheetApp.getActive(), n = 0, ok = 0, fix = [];
  Object.keys(DOC_KIND).forEach(function (name) {
    var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
    var h = headers_(sh), data = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues();
    data.forEach(function (r, i) {
      var id = docId_(r[h.indexOf(DOC_COL)]); if (!id) return;
      var tables = DocumentApp.openById(id).getBody().getTables();
      tables.forEach(function (t) {
        var first = t.getCell(0, 0).getText();
        if (first === '台帳のID') {
          var m = {}; for (var k = 0; k < t.getNumRows(); k++) m[t.getCell(k, 0).getText()] = t.getCell(k, 1).getText().trim();
          if (m['状態']) { sh.getRange(i + 2, col_(sh, STATE_COL)).setValue(m['状態']); n++; }
        }
        if (first === 'カードID') ok += readCardTable_(t, fix);
      });
    });
  });
  SpreadsheetApp.getUi().alert('文章の状態：' + n + '件を写しました\n根拠カード：○ ' + ok + '件を「防災士確認済み」にしました' + (fix.length ? '\n\n直す案があります（台帳に写してください）：\n' + fix.join('\n') : ''));
}
function readCardTable_(t, fix) {
  var cs = SpreadsheetApp.getActive().getSheetByName('根拠カード'), ch = headers_(cs);
  var ids = cs.getRange(2, 1, cs.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); });
  var stCol = ch.indexOf('確認の状態') + 1, today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'), ok = 0;
  for (var k = 1; k < t.getNumRows(); k++) {
    var cid = t.getCell(k, 0).getText().trim(), mark = t.getCell(k, 3).getText().trim(), at = ids.indexOf(cid);
    if (!mark || at < 0) continue;
    if (mark === '○' || mark === '〇') { cs.getRange(at + 2, stCol).setValue('防災士確認済み（' + today + '）'); ok++; }
    else fix.push(cid + '：' + mark);
  }
  return ok;
}

// ---------- サイトに反映する ----------
// 台帳（Excelにして daicho_v2.xlsx）と、全ドキュメント（Markdownにして bunsho.json）を、
// GitHubに1回のコミットで送る。Cloudflareがそれを見て、ページを作り直す。
function publishSite() {
  var p = PropertiesService.getScriptProperties(), token = p.getProperty('GITHUB_TOKEN'), repo = p.getProperty('GITHUB_REPO');
  var branch = p.getProperty('GITHUB_BRANCH') || 'main';
  if (!token || !repo) { SpreadsheetApp.getUi().alert('スクリプト プロパティに GITHUB_TOKEN と GITHUB_REPO を入れてください'); return; }
  var ss = SpreadsheetApp.getActive(), log = ss.getSheetByName('反映の記録'), now = new Date(), who = Session.getActiveUser().getEmail() || '';
  try {
    var need = ['災害', '法律', '改正', '資料', '未来への問い', '根拠カード', 'レッスン', '自治体'];
    var miss = need.filter(function (n) { return !ss.getSheetByName(n); });
    if (miss.length) throw new Error('シートがありません：' + miss.join('、'));
    var g = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
    // 1) 台帳をExcelに
    var xlsx = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', { headers: g }).getBlob();
    // 2) 文章をMarkdownに
    var bunsho = {}, n = 0, bad = [];
    Object.keys(DOC_KIND).forEach(function (name) {
      var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
      var h = headers_(sh), data = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues();
      data.forEach(function (r) {
        var id = docId_(r[h.indexOf(DOC_COL)]); if (!id) return;
        var res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=text%2Fmarkdown', { headers: g, muteHttpExceptions: true });
        if (res.getResponseCode() === 200) { bunsho[String(r[0])] = res.getContentText('UTF-8'); n++; } else bad.push(String(r[0]));
      });
    });
    // 3) GitHubへ1回のコミットで送る
    var base = 'https://api.github.com/repos/' + repo + '/git/';
    var gh = function (method, path, body) {
      var o = { method: method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true };
      if (body) { o.contentType = 'application/json'; o.payload = JSON.stringify(body); }
      var res = UrlFetchApp.fetch(base + path, o);
      if (res.getResponseCode() >= 300) throw new Error('GitHub ' + path + '：' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
      return JSON.parse(res.getContentText());
    };
    var head = gh('get', 'ref/heads/' + branch).object.sha;
    var tree = gh('get', 'commits/' + head).tree.sha;
    var b1 = gh('post', 'blobs', { content: Utilities.base64Encode(xlsx.getBytes()), encoding: 'base64' }).sha;
    var b2 = gh('post', 'blobs', { content: JSON.stringify(bunsho, null, 1), encoding: 'utf-8' }).sha;
    var t = gh('post', 'trees', { base_tree: tree, tree: [
      { path: 'daicho_v2.xlsx', mode: '100644', type: 'blob', sha: b1 },
      { path: 'bunsho.json', mode: '100644', type: 'blob', sha: b2 }] }).sha;
    var c = gh('post', 'commits', { message: '台帳と文章から反映（' + Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm') + '）', tree: t, parents: [head] }).sha;
    gh('patch', 'refs/heads/' + branch, { sha: c });
    if (log) log.appendRow([now, '送った', '文章 ' + n + '本', bad.length ? '読めなかった文章：' + bad.join('、') : '', who]);
    SpreadsheetApp.getUi().alert('GitHubに送りました（文章 ' + n + '本）。1〜3分でサイトに反映されます。\nサイトに出る文章は、ドキュメントの「状態」が「確認済み」のものだけです。' + (bad.length ? '\n\n読めなかった文章：' + bad.join('、') : ''));
  } catch (e) {
    if (log) log.appendRow([now, '失敗', '', String(e.message || e), who]);
    SpreadsheetApp.getUi().alert('反映できませんでした：' + (e.message || e));
  }
}
