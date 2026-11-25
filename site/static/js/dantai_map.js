/* 大学の防災学生団体の地図（Leaflet＋地理院タイル） 2026-11-25 刷新
   ・点の決まり：防災が主目的・活動の一部＝濃い青の点／関連のみ＝青の輪／団体なし＝小さい灰色（3つとも表示を切り替えられる）
   ・右の一覧と地図が連動する：全国→都道府県（団体のある学校と団体）→学校（ピンクの輪で示す）
   ・ピンクは「選んでいるもの」だけに使う */
(function () {
  var wrap = document.querySelector('[data-dmap-wrap]');
  if (!wrap) return;
  var box = wrap.querySelector('[data-dmap]');
  var side = wrap.querySelector('[data-side-list]');
  var hK = wrap.querySelector('[data-side-k]'), hT = wrap.querySelector('[data-side-t]'), hS = wrap.querySelector('[data-side-s]');
  var sel = wrap.querySelector('[data-pref-select]'), reset = wrap.querySelector('[data-reset]');
  var fix = wrap.getAttribute('data-fix') || '';
  var PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
  var STYLE = {
    drr: { radius: 6, color: '#FFFFFF', weight: 1.5, fillColor: '#2B3F51', fillOpacity: 1 },
    rel: { radius: 5, color: '#3D5A73', weight: 2.5, fillColor: '#FFFFFF', fillOpacity: 1 },
    none: { radius: 3, color: '#FFFFFF', weight: 0, fillColor: '#9E9C96', fillOpacity: .75 }
  };
  var ROLE = { '主目的': 0, '活動の一部': 1, '関連': 2 };
  function rk(r) { return ROLE[r] != null ? ROLE[r] : 3; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function start() {
    if (!window.L) { setTimeout(start, 50); return; }
    var JAPAN = [[30.5, 128.5], [45.6, 146.0]];
    var map = L.map(box, { preferCanvas: true, scrollWheelZoom: false, zoomControl: false, zoomSnap: 0.25 }).fitBounds(JAPAN);
    L.control.zoom({ position: 'bottomright', zoomInTitle: '拡大', zoomOutTitle: '縮小' }).addTo(map);
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">出典：国土地理院（地理院タイル）</a>'
    }).addTo(map);
    box.addEventListener('click', function () { map.scrollWheelZoom.enable(); }, { once: true });

    fetch(wrap.getAttribute('data-src')).then(function (r) { return r.json(); }).then(function (D) {
      var layers = { none: L.layerGroup(), rel: L.layerGroup(), drr: L.layerGroup() };
      var byPref = {}, bounds = {}, markers = [];
      D.schools.forEach(function (s, i) {
        (byPref[s[1]] = byPref[s[1]] || []).push(i);
        (bounds[s[1]] = bounds[s[1]] || L.latLngBounds([])).extend([s[3], s[4]]);
        var m = L.circleMarker([s[3], s[4]], STYLE[s[5]]);
        m.on('click', function () { pickSchool(i, false); });
        m.bindTooltip(s[0], { direction: 'top', offset: [0, -6] });
        markers[i] = m; layers[s[5]].addLayer(m);
      });
      ['none', 'rel', 'drr'].forEach(function (k) { layers[k].addTo(map); });

      // 凡例＝表示の切り替え
      wrap.querySelectorAll('[data-layer]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-layer'), on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          if (on) { layers[k].addTo(map); if (k !== 'drr') layers.drr.eachLayer(function (m) { m.bringToFront(); }); } else map.removeLayer(layers[k]);
        });
      });

      var ring = null, cur = { pref: '', school: -1 };
      function setRing(i) {
        if (ring) { map.removeLayer(ring); ring = null; }
        if (i < 0) return;
        var s = D.schools[i];
        ring = L.circleMarker([s[3], s[4]], { radius: 12, color: '#C2306F', weight: 3, fill: false, interactive: false, className: 'selring' }).addTo(map);
        ring.bindTooltip(s[0], { permanent: true, direction: 'right', offset: [12, 0] }).openTooltip();
      }
      function head(k, t, s) { hK.textContent = k; hT.textContent = t; hS.textContent = s; }
      function hasOrgs(i) { return D.schools[i][7].length > 0; }

      function showNation() {
        cur = { pref: '', school: -1 }; setRing(-1); if (sel) sel.value = ''; if (reset) reset.hidden = true;
        head('全国', '都道府県を選ぶ', '地図の点か、下の一覧を押すと拡大します');
        clear(side);
        var ul = el('ul'); ul.style.cssText = 'margin:0;padding:0;list-style:none';
        PREFS.forEach(function (p) {
          var list = byPref[p] || []; if (!list.length) return;
          var w = list.filter(hasOrgs).length;
          var li = el('li'), b = el('button', 'prow'); b.type = 'button';
          b.appendChild(el('span', 'prow__n', p.replace(/(都|府|県)$/, '').replace('北海道', '北海道')));
          var bar = el('span', 'prow__bar'); var fillB = el('i'); fillB.style.width = Math.round(w / list.length * 100) + '%'; bar.appendChild(fillB); b.appendChild(bar);
          b.appendChild(el('span', 'prow__c', w + '/' + list.length + '校'));
          b.setAttribute('aria-label', p + '：防災に関わる学生団体のある学校 ' + w + '／' + list.length + '校');
          b.addEventListener('click', function () { showPref(p, true); });
          li.appendChild(b); ul.appendChild(li);
        });
        side.appendChild(ul);
      }

      function orgList(i) {
        var ul = el('ul', 'dorgs');
        D.schools[i][7].map(function (k) { return D.orgs[k]; }).sort(function (a, b) { return rk(a[2]) - rk(b[2]); }).forEach(function (o) {
          var li = el('li'), top = el('span'), u = safeUrl(o[5]);
          var a = u ? el('a', null, o[0]) : el('b', null, o[0]);
          if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener nofollow'; }
          top.appendChild(a);
          top.appendChild(el('span', 'dtag dtag--' + (ROLE[o[2]] != null ? ROLE[o[2]] : 2), o[2]));
          if (o[1] === '複数校の連合組織') top.appendChild(el('span', 'dtag', '連合'));
          li.appendChild(top);
          var st = (o[4] || '').replace(/（.*）/, '');
          li.appendChild(el('span', 'small', (o[3] || '') + (st && st !== '不明' ? '・' + st : '')));
          ul.appendChild(li);
        });
        return ul;
      }

      function showPref(p, zoom) {
        cur.pref = p; if (sel) sel.value = p; if (reset) reset.hidden = false;
        if (zoom && bounds[p]) map.fitBounds(bounds[p], { padding: [36, 36], maxZoom: 11 });
        var list = byPref[p] || [], withO = list.filter(hasOrgs);
        head('都道府県', p, '防災に関わる学生団体のある学校 ' + withO.length + ' / ' + list.length + '校');
        clear(side);
        var ul = el('ul'); ul.style.cssText = 'margin:0;padding:0;list-style:none';
        withO.sort(function (a, b) { return (D.schools[a][5] === 'drr' ? 0 : 1) - (D.schools[b][5] === 'drr' ? 0 : 1); }).forEach(function (i) {
          var s = D.schools[i], li = el('li', 'srow' + (i === cur.school ? ' on' : '')); li.setAttribute('data-i', i);
          var b = el('button', 'srow__b'); b.type = 'button';
          b.appendChild(el('span', 'srow__n', s[0])); b.appendChild(el('span', 'srow__w', s[2] + (s[6] ? '' : '・位置は市区町村役所（仮）')));
          b.addEventListener('click', function () { pickSchool(i, true); });
          li.appendChild(b); li.appendChild(orgList(i)); ul.appendChild(li);
        });
        side.appendChild(ul);
        var n = list.length - withO.length;
        if (n) side.appendChild(el('p', 'small mute', 'ほかの' + n + '校は、Webで確認できる団体なし（2026年11月時点）。')).style.cssText = 'margin:0;padding:14px 20px';
        if (fix) { var a = el('a', null, 'この県の、載っていない団体を知らせる →'); a.href = fix + '&area=' + encodeURIComponent(p); a.style.cssText = 'display:block;padding:0 20px 18px;font-size:13px;font-weight:700;color:#1C1C21'; side.appendChild(a); }
      }

      function pickSchool(i, pan) {
        var s = D.schools[i];
        if (cur.pref !== s[1]) { cur.school = i; showPref(s[1], false); }
        cur.school = i; setRing(i);
        if (pan) map.setView([s[3], s[4]], Math.max(map.getZoom(), 12));
        side.querySelectorAll('.srow').forEach(function (r) { r.classList.toggle('on', +r.getAttribute('data-i') === i); });
        var row = side.querySelector('.srow[data-i="' + i + '"]');
        if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        else if (!s[7].length) { head('学校', s[0], s[1] + ' ' + s[2] + '・Webで確認できる団体なし（2026年11月時点）'); }
      }

      if (sel) {
        PREFS.forEach(function (p) { if (byPref[p]) { var o = el('option', null, p); o.value = p; sel.appendChild(o); } });
        sel.addEventListener('change', function () { if (sel.value) showPref(sel.value, true); else { map.fitBounds(JAPAN); showNation(); } });
      }
      if (reset) reset.addEventListener('click', function () { map.fitBounds(JAPAN); showNation(); });
      var q = wrap.querySelector('[data-school-search]');
      if (q) q.addEventListener('input', function () {
        var v = q.value.trim(); if (!v) { if (cur.pref) showPref(cur.pref, false); else showNation(); return; }
        var hits = []; D.schools.forEach(function (s, i) { if ((s[0] + s[1] + s[2]).indexOf(v) >= 0) hits.push(i); });
        head('さがした結果', '「' + v + '」', hits.length + '校');
        clear(side);
        var ul = el('ul'); ul.style.cssText = 'margin:0;padding:0;list-style:none';
        hits.slice(0, 60).forEach(function (i) {
          var s = D.schools[i], li = el('li', 'srow'); li.setAttribute('data-i', i);
          var b = el('button', 'srow__b'); b.type = 'button';
          b.appendChild(el('span', 'srow__n', s[0])); b.appendChild(el('span', 'srow__w', s[1] + ' ' + s[2] + (s[7].length ? '' : '・団体なし')));
          b.addEventListener('click', function () { q.value = ''; pickSchool(i, true); });
          li.appendChild(b); if (s[7].length) li.appendChild(orgList(i)); ul.appendChild(li);
        });
        side.appendChild(ul);
      });
      showNation();
    }).catch(function () { box.innerHTML = '<p class="small" style="padding:12px">地図のデータを読みこめませんでした。下の一覧をご覧ください。</p>'; });
  }
  start();
})();
