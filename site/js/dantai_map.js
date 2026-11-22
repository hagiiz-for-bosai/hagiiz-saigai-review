/* 大学の防災学生団体の地図（Leaflet＋地理院タイル） */
(function () {
  var box = document.querySelector('[data-dmap]');
  if (!box) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  var COLOR = { drr: '#E24F93', rel: '#F2B705', none: '#A9A9B3' };
  function start() {
    if (!window.L) { setTimeout(start, 50); return; }
    var map = L.map(box, { preferCanvas: true, scrollWheelZoom: false }).fitBounds([[30.5, 128.5], [45.6, 146.0]]);
    L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">出典：国土地理院（地理院タイル）</a>'
    }).addTo(map);
    box.addEventListener('click', function () { map.scrollWheelZoom.enable(); }, { once: true });
    fetch(box.getAttribute('data-src')).then(function (r) { return r.json(); }).then(function (D) {
      var fix = box.getAttribute('data-fix');
      // 灰色→黄→ピンクの順に描いて、団体のある学校を上に
      ['none', 'rel', 'drr'].forEach(function (cls) {
        D.schools.forEach(function (s) {
          if (s[5] !== cls) return;
          var m = L.circleMarker([s[3], s[4]], {
            radius: cls === 'none' ? 4 : 6, color: '#0E0E10', weight: 1, fillColor: COLOR[cls], fillOpacity: cls === 'none' ? 0.55 : 0.95
          }).addTo(map);
          m.bindPopup(function () {
            var h = '<div class="dpop"><b>' + esc(s[0]) + '</b><br><span class="dpop__m">' + esc(s[1]) + ' ' + esc(s[2]) + '</span>';
            if (!s[6]) h += '<br><span class="dpop__m">※位置は市区町村役所の位置（仮）</span>';
            if (!s[7].length) {
              h += '<p>Webで確認できる団体はありませんでした（2026年11月時点）。</p>';
            } else {
              h += '<ul>';
              s[7].forEach(function (i) {
                var o = D.orgs[i], u = safeUrl(o[5]);
                h += '<li>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener nofollow">' + esc(o[0]) + '</a>' : esc(o[0])) +
                  ' <span class="dpop__t">' + esc(o[2]) + (o[1] === '複数校の連合組織' ? '・連合' : '') + '</span>' +
                  (o[3] ? '<br><span class="dpop__m">' + esc(o[3]) + '</span>' : '') +
                  '<br><span class="dpop__m">活動の状態：' + esc((o[4] || '').replace(/（.*）/, '')) + '　確認日：' + esc(o[6]) + '</span></li>';
              });
              h += '</ul>';
            }
            h += '<a class="dpop__fix" href="' + esc(fix) + '&area=' + encodeURIComponent(s[1] + s[2]) + '&ref=' + encodeURIComponent(s[0]) + '">載っていない団体・誤りを知らせる</a></div>';
            return h;
          }, { maxWidth: 320 });
        });
      });
    }).catch(function () { box.innerHTML = '<p class="small" style="padding:12px">地図のデータを読みこめませんでした。下の一覧をご覧ください。</p>'; });
  }
  start();
})();
