/* 反诈库直查 —— 界面层 */
(function () {
  'use strict';

  var $ = function (q) { return document.querySelector(q); };

  var ICONS = {
    photo: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z',
    screen: 'M20 18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z',
    call: 'M20 15.4c-1.2 0-2.4-.2-3.5-.6-.4-.1-.8 0-1 .3l-1.6 2c-2.8-1.4-5.5-3.9-6.9-6.9l2-1.7c.3-.3.3-.7.2-1-.4-1.1-.6-2.3-.6-3.5 0-.6-.4-1-1-1H4.2C3.6 3 3 3.3 3 4c0 9.3 7.7 17 17 17 .7 0 1-.6 1-1.2v-3.4c0-.6-.5-1-1-1z',
    flight: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
    install: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    link: 'M3.9 12c0-1.7 1.4-3.1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7c-1.7 0-3.1-1.4-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.7 0 3.1 1.4 3.1 3.1s-1.4 3.1-3.1 3.1h-4V17h4a5 5 0 0 0 0-10z',
    headset: 'M12 1a9 9 0 0 0-9 9v7a3 3 0 0 0 3 3h3v-8H5v-2a7 7 0 0 1 14 0v2h-4v8h3a3 3 0 0 0 3-3v-7a9 9 0 0 0-9-9z',
    forward: 'M12 8V4l8 8-8 8v-4H4V8z',
    database: 'M12 2c-4.4 0-8 1.3-8 3v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5c0-1.7-3.6-3-8-3zm0 2c3.9 0 6 .9 6 1s-2.1 1-6 1-6-.9-6-1 2.1-1 6-1zm6 16c0 .1-2.1 1-6 1s-6-.9-6-1v-2.2c1.3.6 3.5 1 6 1s4.7-.4 6-1V20zm0-5c0 .1-2.1 1-6 1s-6-.9-6-1v-2.2c1.3.6 3.5 1 6 1s4.7-.4 6-1V15zm0-5c0 .1-2.1 1-6 1s-6-.9-6-1V7.8c1.3.6 3.5 1 6 1s4.7-.4 6-1V10z',
    folder: 'M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z',
    check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
    download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    chevron: 'M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z',
    scan: 'M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z',
    info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'
  };

  function ic(name) {
    var p = ICONS[name] || ICONS.database;
    return '<span class="ic"><svg viewBox="0 0 24 24"><path d="' + p + '"/></svg></span>';
  }

  var KINDS = {
    shot: { label: '截图', icon: 'photo', tint: 'shot' },
    screen: { label: '录屏', icon: 'screen', tint: 'screen' },
    call: { label: '通话', icon: 'call', tint: 'call' },
    air: { label: '飞行模式', icon: 'flight', tint: 'air' },
    install: { label: '安装', icon: 'install', tint: 'install' },
    url: { label: '涉诈链接', icon: 'link', tint: 'url' },
    voip: { label: 'VoIP', icon: 'headset', tint: 'call' },
    forward: { label: '呼叫转移', icon: 'forward', tint: 'air' }
  };

  var TABLE_KIND = {
    screenshot: 'shot', screen_share: 'screen', fraud_phone: 'call',
    airplane_mode: 'air', install_app: 'install', fraud_url: 'url',
    voip_record: 'voip', call_forwarding: 'forward'
  };

  var s = {
    db: null, name: '', path: '', src: '',
    events: [], recovered: [], images: [], videos: [], showPair: false, thumbsDone: {},
    view: 'timeline', filter: 'all', table: null,
    shown: 240, showDeleted: true, tableShown: 80,
    version: '', update: null, checking: false, downloaded: '',
    perms: null, callIndex: {}, callIndexRaw: {}, callList: [],
    persist: { enabled: false }, lastB64: '',
    reveal: false, contactIndex: {}, contactIndexRaw: {}, bookCount: 0,
    dbs: [], saved: [], savedInfo: {}
  };

  /* ---------- 工具 ---------- */
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dt(ms) { return new Date(ms); }
  function hm(ms) { var x = dt(ms); return pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  function hms(ms) { var x = dt(ms); return pad(x.getHours()) + ':' + pad(x.getMinutes()) + ':' + pad(x.getSeconds()); }
  function md(ms) { var x = dt(ms); return pad(x.getMonth() + 1) + '/' + pad(x.getDate()); }
  function dayKey(ms) { var x = dt(ms); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }
  function dayLabel(ms) {
    var x = dt(ms), wk = '日一二三四五六'[x.getDay()], y = x.getFullYear(), now = new Date().getFullYear();
    return (y !== now ? y + '年' : '') + (x.getMonth() + 1) + '月' + x.getDate() + '日 周' + wk;
  }
  function durText(ms) {
    ms = Number(ms) || 0;
    if (ms <= 0) return '—';
    if (ms < 1000) return ms + ' 毫秒';
    if (ms < 60000) return (ms / 1000).toFixed(1) + ' 秒';
    var m = Math.floor(ms / 60000), sec = Math.round((ms % 60000) / 1000);
    if (m < 60) return m + ' 分 ' + sec + ' 秒';
    return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
  }
  function sizeText(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function b64ToBytes(b64) {
    var bin = atob(b64), n = bin.length, a = new Uint8Array(n);
    for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---------- 模型 ---------- */
  function colIndex(t, name) { return t.columns ? t.columns.indexOf(name) : -1; }
  function cell(t, row, name) { var i = colIndex(t, name); return i < 0 ? null : row.values[i]; }
  function flat(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && v.blob) return '<blob ' + v.blob.length + 'B>';
    return v;
  }

  function parseScreenName(name) {
    var m = /^Screenshot[_-](\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})[-_](\d{1,3})_?(.*)\.(?:jpg|jpeg|png|webp)$/i.exec(name);
    if (!m) return null;
    var ms = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || 0)).getTime();
    return { ms: ms, file: name, pkg: (m[8] || '').replace(/\.(jpg|jpeg|png|webp)$/i, '') };
  }
  function parseVideoName(name) {
    // Screenrecorder-2026-10-28-16-57-25-123.mp4 / 屏幕录制_20261028_165725.mp4
    var m = /(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:-(\d{1,3}))?/.exec(name || '');
    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || 0)).getTime();
    }
    var n = /(\d{4})(\d{2})(\d{2})[_\-](\d{2})(\d{2})(\d{2})/.exec(name || '');
    if (n) {
      return new Date(+n[1], +n[2] - 1, +n[3], +n[4], +n[5], +n[6]).getTime();
    }
    return 0;
  }

  function nearest(list, ms, tol) {
    if (!list || !list.length) return null;
    var lo = 0, hi = list.length - 1, best = null, bd = Infinity;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1, delta = Math.abs(list[mid].ms - ms);
      if (delta < bd) { bd = delta; best = list[mid]; }
      if (list[mid].ms < ms) lo = mid + 1; else hi = mid - 1;
    }
    return best && bd <= tol ? { item: best, delta: bd } : null;
  }

  function pairVideo(ms) {
    var r = nearest(s.videos, ms, 300000);
    return r ? r.item : null;
  }

  function pairScreen(ms) {
    var arr = s.images;
    if (!arr || !arr.length) return null;
    var lo = 0, hi = arr.length - 1, best = null, bd = Infinity;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1, delta = Math.abs(arr[mid].ms - ms);
      if (delta < bd) { bd = delta; best = arr[mid]; }
      if (arr[mid].ms < ms) lo = mid + 1; else hi = mid - 1;
    }
    return best && bd <= 120000 ? { file: best.file, pkg: best.pkg, delta: bd } : null;
  }

  function datasets() {
    if (s.dbs && s.dbs.length) return s.dbs;
    if (s.db) return [{ id: 'cur', meta: { name: s.name, src: s.src }, db: s.db }];
    return [];
  }

  function buildEvents() {
    var ev = [], rec = [], seen = {};
    datasets().forEach(function (ds) {
      var T = ds.db.tables;

      function push(kind, t, obj) {
        if (typeof t !== 'number' || !isFinite(t) || t < 1e11) return;
        var key = kind + '|' + (obj.rowid || 0) + '|' + t;
        if (seen[key]) return;
        seen[key] = 1;
        obj.kind = kind; obj.t = t; obj.ds = ds.id;
        ev.push(obj);
      }

      if (T.screenshot) T.screenshot.rows.forEach(function (r) {
        push('shot', cell(T.screenshot, r, 'screenshot_time'), { table: 'screenshot', rowid: r.rowid, data: {} });
      });
      if (T.screen_share) T.screen_share.rows.forEach(function (r) {
        var t = T.screen_share;
        push('screen', cell(t, r, 'screen_share_start_time'), {
          table: 'screen_share', rowid: r.rowid,
          data: {
            pkg: cell(t, r, 'screen_share_package_name'),
            start: cell(t, r, 'screen_share_start_time'),
            end: cell(t, r, 'screen_share_end_time'),
            dur: cell(t, r, 'duration'), active: cell(t, r, 'is_active')
          }
        });
      });
      if (T.fraud_phone) T.fraud_phone.rows.forEach(function (r) {
        var t = T.fraud_phone;
        push('call', cell(t, r, 'call_start_time'), {
          table: 'fraud_phone', rowid: r.rowid,
          data: {
            start: cell(t, r, 'call_start_time'), end: cell(t, r, 'call_end_time'),
            loc: cell(t, r, 'tel_location'), op: cell(t, r, 'operator'),
            md5: cell(t, r, 'tel_number_md5'), dur: cell(t, r, 'duration'),
            cn: cell(t, r, 'is_chinese_number'), virt: cell(t, r, 'is_virtual_operator'),
            fraud: cell(t, r, 'is_fraud_call')
          }
        });
      });
      if (T.airplane_mode) T.airplane_mode.rows.forEach(function (r) {
        var t = T.airplane_mode;
        push('air', cell(t, r, 'airplane_mode_change_time'), {
          table: 'airplane_mode', rowid: r.rowid, data: { on: cell(t, r, 'airplane_mode_on') }
        });
      });
      if (T.install_app) T.install_app.rows.forEach(function (r) {
        var t = T.install_app;
        push('install', cell(t, r, 'install_finish_time'), {
          table: 'install_app', rowid: r.rowid,
          data: {
            pkg: cell(t, r, 'pkg_name'), name: cell(t, r, 'app_name'),
            src: cell(t, r, 'source'), ver: cell(t, r, 'version_code'),
            md5: cell(t, r, 'md5'), tag: cell(t, r, 'app_tag_id'), sec: cell(t, r, 'security_tag_id')
          }
        });
      });
      if (T.fraud_url) T.fraud_url.rows.forEach(function (r) {
        var t = T.fraud_url;
        push('url', cell(t, r, 'access_time'), { table: 'fraud_url', rowid: r.rowid, data: { type: cell(t, r, 'url_type') } });
      });
      if (T.voip_record) T.voip_record.rows.forEach(function (r) {
        var t = T.voip_record;
        push('voip', cell(t, r, 'voip_record_start_time'), {
          table: 'voip_record', rowid: r.rowid,
          data: {
            pkg: cell(t, r, 'voip_record_package_name'),
            start: cell(t, r, 'voip_record_start_time'), end: cell(t, r, 'voip_record_end_time'),
            dur: cell(t, r, 'duration'), fraud: cell(t, r, 'is_fraud_call')
          }
        });
      });
      if (T.call_forwarding) T.call_forwarding.rows.forEach(function (r) {
        var t = T.call_forwarding;
        push('forward', cell(t, r, 'timestamp'), {
          table: 'call_forwarding', rowid: r.rowid,
          data: { reason: cell(t, r, 'reason'), enabled: cell(t, r, 'enabled') }
        });
      });

      (ds.db.recovered || []).forEach(function (r) {
        var kind = TABLE_KIND[r.table];
        if (!kind) return;
        var t = ds.db.tables[r.table], fake = { rowid: r.rowid, values: r.values };
        var pick = function (n) { return t ? cell(t, fake, n) : null; };
        var ms = 0, o = { table: r.table, rowid: r.rowid, gone: true, from: r.from, data: {}, kind: kind, ds: ds.id };
        if (kind === 'shot') ms = pick('screenshot_time');
        else if (kind === 'screen') { ms = pick('screen_share_start_time'); o.data = { pkg: pick('screen_share_package_name'), start: ms, end: pick('screen_share_end_time'), dur: pick('duration') }; }
        else if (kind === 'call') { ms = pick('call_start_time'); o.data = { loc: pick('tel_location'), op: pick('operator'), md5: pick('tel_number_md5'), dur: pick('duration'), virt: pick('is_virtual_operator'), fraud: pick('is_fraud_call'), start: ms, end: pick('call_end_time') }; }
        else if (kind === 'air') { ms = pick('airplane_mode_change_time'); o.data = { on: pick('airplane_mode_on') }; }
        else if (kind === 'install') { ms = pick('install_finish_time'); o.data = { pkg: pick('pkg_name'), name: pick('app_name'), src: pick('source'), ver: pick('version_code') }; }
        else if (kind === 'url') { ms = pick('access_time'); o.data = { type: pick('url_type') }; }
        else if (kind === 'voip') { ms = pick('voip_record_start_time'); o.data = { pkg: pick('voip_record_package_name'), dur: pick('duration') }; }
        else if (kind === 'forward') { ms = pick('timestamp'); o.data = { reason: pick('reason'), enabled: pick('enabled') }; }
        if (typeof ms !== 'number' || ms < 1e11) return;
        var key2 = kind + '|' + (o.rowid || 0) + '|' + ms + '|r';
        if (seen[key2]) return;
        seen[key2] = 1;
        o.t = ms; rec.push(o);
      });
    });

    ev.sort(function (a, b) { return b.t - a.t; });
    rec.sort(function (a, b) { return b.t - a.t; });
    s.events = ev;
    s.recovered = rec;
  }

  /* ---------- 渲染 ---------- */
  function countBy(kind, withDeleted) {
    var n = 0;
    s.events.forEach(function (e) { if (kind === 'all' || e.kind === kind) n++; });
    if (withDeleted) s.recovered.forEach(function (e) { if (kind === 'all' || e.kind === kind) n++; });
    return n;
  }

  function renderMeta() {
    var box = $('#meta');
    var times = s.events.map(function (e) { return e.t; });
    var span = times.length ? (md(Math.min.apply(null, times)) + '–' + md(Math.max.apply(null, times))) : '—';
    box.innerHTML =
      '<div><b>' + s.events.length + '</b><span>现存记录</span></div>' +
      '<div><b>' + s.recovered.length + '</b><span>可恢复</span></div>' +
      '<div><b style="font-size:15px;line-height:24px">' + span + '</b><span>时间跨度</span></div>';
  }

  function renderChips() {
    var box = $('#chips');
    if (!s.db) { box.innerHTML = ''; return; }
    var html = '';
    if (s.view === 'timeline') {
      var kinds = ['all'].concat(Object.keys(KINDS).filter(function (k) { return countBy(k, s.showDeleted); }));
      kinds.forEach(function (k) {
        var on = s.filter === k;
        var label = k === 'all' ? '全部' : KINDS[k].label;
        html += '<button class="chip' + (on ? ' on' : '') + '" data-act="filter" data-kind="' + k + '">' +
          (on ? ic('check') : '') + label + '<span class="n">' + countBy(k, s.showDeleted) + '</span></button>';
      });
      html += '<button class="chip' + (s.showDeleted ? ' on' : '') + '" data-act="del">' +
        (s.showDeleted ? ic('check') : '') + '含已删除<span class="n">' + s.recovered.length + '</span></button>';
    } else if (s.view === 'tables') {
      Object.keys(s.db.tables).forEach(function (n) {
        var t = s.db.tables[n], on = s.table === n;
        html += '<button class="chip' + (on ? ' on' : '') + '" data-act="table" data-name="' + esc(n) + '">' +
          (on ? ic('check') : '') + esc(n) + '<span class="n">' + t.rows.length + '</span></button>';
      });
    }
    box.innerHTML = html;
  }

  function rowHtml(e) {
    var k = KINDS[e.kind] || { label: e.kind, icon: 'database', tint: null };
    var d0 = e.data || {}, title = k.label, sub = '', extra = '';
    var thumbUri = '', thumbVideo = false;
    switch (e.kind) {
      case 'shot': {
        var p = s.showPair ? pairScreen(e.t) : null;
        title = '截图';
        if (p && p.pkg) { sub = '当时前台 <b>' + esc(p.pkg) + '</b>'; extra = esc(p.file); }
        else if (p) { extra = esc(p.file); }
        else sub = '只记录了时间戳';
        if (p && p.uri) { thumbUri = p.uri; thumbVideo = false; }
        break;
      }
      case 'screen': {
        var v = s.showPair ? pairVideo(d0.start) : null;
        title = '屏幕录制';
        sub = esc(d0.pkg || '未知来源') + ' · ' + durText(d0.dur);
        extra = hms(d0.start) + ' – ' + hms(d0.end || d0.start);
        if (v) {
          var diff = (v.dur || 0) - (d0.dur || 0);
          extra += ' · 文件 ' + esc(v.file) +
            (v.dur ? '（实际 ' + durText(v.dur) + (Math.abs(diff) > 3000 ? '，差 ' + durText(Math.abs(diff)) : '，一致') + '）' : '');
          if (v.uri) { thumbUri = v.uri; thumbVideo = true; }
        } else if (d0.active) {
          extra += ' · 进行中';
        }
        break;
      }
      case 'call': {
        var pc = pairCall(d0);
        title = '通话 · ' + esc(d0.loc || '归属地未知');
        var bits = [d0.op ? esc(d0.op) : '', durText(d0.dur),
          d0.virt ? '虚拟运营商' : '', d0.fraud ? '<b>涉诈标记</b>' : ''].filter(Boolean);
        if (pc && pc.it.number) {
          bits.push('号码 <b>' + esc(pc.it.number) + '</b>' +
            (pc.it.name ? '（' + esc(pc.it.name) + '）' : ''));
        }
        sub = bits.join(' · ');
        var kv2 = [];
        if (d0.md5) kv2.push('号码摘要 ' + esc(String(d0.md5).slice(0, 18)) + '…');
        if (pc) {
          var srcTag = pc.how === 'contact' ? '通讯录'
            : pc.how === 'time' ? '按时间匹配' : '通话记录';
          var bits2 = [srcTag];
          if (pc.it.date) bits2.push(hms(pc.it.date));
          if (pc.it.dur) bits2.push(durText(pc.it.dur * 1000));
          else if (pc.it.date) bits2.push('未接通');
          if (pc.it.geo) bits2.push(esc(pc.it.geo));
          kv2.push(bits2.join(' · '));
        }
        extra = kv2.join('<br>');
        break;
      }
      case 'air':
        title = '飞行模式' + (d0.on ? '开启' : '状态变化');
        sub = '记录值 ' + esc(d0.on);
        break;
      case 'install':
        title = '安装 ' + esc(d0.name || d0.pkg);
        sub = '<span class="mono">' + esc(d0.pkg) + '</span> · v' + esc(d0.ver);
        if (d0.src) extra = '来源 ' + esc(d0.src);
        break;
      case 'url':
        title = '访问涉诈链接';
        sub = '类型码 ' + esc(d0.type);
        break;
      case 'voip':
        title = 'VoIP 通话';
        sub = esc(d0.pkg || '未知') + ' · ' + durText(d0.dur);
        break;
      case 'forward':
        title = '呼叫转移';
        sub = 'reason ' + esc(d0.reason) + ' · ' + (d0.enabled ? '已开启' : '已关闭');
        break;
    }
    var style = k.tint ? ' style="--kc:var(--k-' + k.tint + ');--kb:var(--k-' + k.tint + '-bg)"' : '';
    var head = thumbUri
      ? '<span class="ic thumb"><img data-uri="' + esc(thumbUri) + '" data-video="' + (thumbVideo ? '1' : '0') + '" alt=""></span>'
      : ic(k.icon);
    return '<div class="row' + (e.gone ? ' gone' : '') + '"' + style + '>' +
      head +
      '<div class="body">' +
        '<div class="t1"><span class="txt">' + title + '</span>' + (e.gone ? '<span class="badge">已删除</span>' : '') + '</div>' +
        (sub ? '<div class="t2">' + sub + '</div>' : '') +
        (extra ? '<div class="t3 mono">' + extra + '</div>' : '') +
      '</div>' +
      '<div class="tm">' + hm(e.t) + '</div>' +
    '</div>';
  }

  function renderTimeline() {
    var list;
    if (s.filter === 'all') list = s.events.concat(s.showDeleted ? s.recovered : []);
    else {
      list = s.events.filter(function (e) { return e.kind === s.filter; });
      if (s.showDeleted) list = list.concat(s.recovered.filter(function (e) { return e.kind === s.filter; }));
    }
    list.sort(function (a, b) { return b.t - a.t; });
    if (!list.length) {
      $('#view').innerHTML = '<div class="empty">' + ic('info') + '这一栏没有记录</div>';
      return;
    }
    var out = [], day = null, buf = [], shown = 0, dayCount = {};
    list.forEach(function (x) { var k = dayKey(x.t); dayCount[k] = (dayCount[k] || 0) + 1; });
    function flush() {
      if (!buf.length) return;
      out.push('<div class="group">' + buf.join('') + '</div>');
      buf = [];
    }
    for (var i = 0; i < list.length && shown < s.shown; i++) {
      var e = list[i], dk = dayKey(e.t);
      if (dk !== day) {
        flush();
        out.push('<h3 class="day">' + dayLabel(e.t) + '<span class="n">' + dayCount[dk] + ' 条</span></h3>');
        day = dk;
      }
      buf.push(rowHtml(e));
      shown++;
    }
    flush();
    if (list.length > s.shown) {
      out.push('<div style="padding:12px"><button class="item" data-act="more" style="justify-content:center;background:var(--surface-low);border-radius:20px">还有 ' +
        (list.length - s.shown) + ' 条，点此继续</button></div>');
    }
    $('#view').innerHTML = out.join('');
  }

  function renderTables() {
    var db = s.db;
    if (!s.table || !db.tables[s.table]) s.table = Object.keys(db.tables)[0];
    var t = db.tables[s.table];
    if (!t) { $('#view').innerHTML = '<div class="empty">没有表</div>'; return; }
    var out = [];
    if (!t.rows.length) {
      out.push('<div class="empty">' + ic('database') + esc(t.name) + ' 表里没有现存记录' +
        (t.columns.length ? '<br>列：' + esc(t.columns.join(', ')) : '') + '</div>');
    }
    var timeCol = t.columns.findIndex(function (c) { return /time|_at$/.test(c); });
    var rows = t.rows.slice().sort(function (a, b) { return b.rowid - a.rowid; });
    rows.slice(0, s.tableShown).forEach(function (r) {
      var kv = '';
      t.columns.forEach(function (c, i) {
        if (c === '_id') return;
        kv += '<div class="k">' + esc(c) + '</div><div class="v">' + esc(flat(r.values[i])) + '</div>';
      });
      var head = timeCol >= 0 && typeof r.values[timeCol] === 'number'
        ? dayKey(r.values[timeCol]).slice(5).replace('-', '/') + ' ' + hms(r.values[timeCol]) : '';
      out.push('<div class="tcard"><div class="th"><span>rowid ' + r.rowid + '</span><span>' + head +
        '</span></div><div class="kv">' + kv + '</div></div>');
    });
    if (rows.length > s.tableShown) {
      out.push('<div style="padding:2px 12px 14px"><button class="item" data-act="moreTable" style="justify-content:center;background:var(--surface-low);border-radius:20px">还有 ' +
        (rows.length - s.tableShown) + ' 行，点此继续</button></div>');
    }
    $('#view').innerHTML = out.join('');
  }

  function renderStats() {
    var db = s.db, st = db.stats || {};
    var agg = {};
    datasets().forEach(function (ds) {
      Object.keys(ds.db.tables).forEach(function (n) {
        agg[n] = (agg[n] || 0) + ds.db.tables[n].rows.length;
      });
    });
    var rows = Object.keys(agg).map(function (n) { return { n: n, c: agg[n] }; })
      .sort(function (a, b) { return b.c - a.c; });
    var max = 1, total = 0;
    rows.forEach(function (r) { if (r.c > max) max = r.c; total += r.c; });

    var bars = rows.map(function (r) {
      return '<div class="bar-row"><span class="nm">' + esc(r.n) + '</span>' +
        '<span class="track"><i class="fill" style="display:block;width:' + Math.max(3, Math.round(r.c / max * 100)) + '%"></i></span>' +
        '<span class="num">' + r.c + '</span></div>';
    }).join('');

    var byDay = {};
    s.events.forEach(function (e) {
      if (e.kind !== 'shot') return;
      var k = dayKey(e.t);
      byDay[k] = (byDay[k] || 0) + 1;
    });
    var days = Object.keys(byDay).sort().slice(-14), dmax = 1;
    days.forEach(function (k) { if (byDay[k] > dmax) dmax = byDay[k]; });
    var spark = days.map(function (k) {
      var h = Math.max(6, Math.round(byDay[k] / dmax * 68));
      return '<span class="col"><i style="height:' + h + 'px"></i>' + k.slice(5).replace('-', '/') + '</span>';
    }).join('');

    var seq = '';
    if (db.tables.sqlite_sequence) {
      seq = db.tables.sqlite_sequence.rows.map(function (r) {
        return '<div class="k">' + esc(r.values[0]) + '</div><div class="v">累计 ' + esc(r.values[1]) + ' 条</div>';
      }).join('');
    }

    $('#view').innerHTML =
      '<div class="panel"><h2>数据库</h2><div class="kv">' +
        '<div class="k">文件</div><div class="v">' + esc(s.name || '—') + '</div>' +
        '<div class="k">来源</div><div class="v">' + esc(s.src === 'root' ? '系统路径（root 读取）' : s.src === 'pick' ? '手动选择'
        : s.src === 'stored' ? '上次保存的副本' : '未知') + '</div>' +
        '<div class="k">数据集</div><div class="v">' + datasets().length + ' 份（时间线为合并结果）</div>' +
        '<div class="k">体积</div><div class="v">' + sizeText(st.fileSize || 0) + '，' + (st.pageSize || 0) + ' B/页 × ' + (st.pageCount || 0) + ' 页</div>' +
        '<div class="k">编码</div><div class="v">' + esc(st.encoding || '—') + '</div>' +
        '<div class="k">全部行数</div><div class="v">' + total + ' 条</div>' +
        '<div class="k">可恢复</div><div class="v">' + s.recovered.length + ' 条（空闲页 ' + (st.freedPages || 0) + '）</div>' +
        '<div class="k">locale</div><div class="v">' + esc(db.tables.android_metadata && db.tables.android_metadata.rows[0]
          ? db.tables.android_metadata.rows[0].values[0] : '—') + '</div>' +
      '</div></div>' +
      '<div class="panel"><h2>各表记录数</h2><div class="bars">' + bars + '</div></div>' +
      '<div class="panel"><h2>每天截图数</h2>' + (days.length
        ? '<div class="spark">' + spark + '</div>'
        : '<div style="font-size:13px;color:var(--on-surface-var)">没有截图记录</div>') + '</div>' +
      (seq ? '<div class="panel"><h2>累计写入（sqlite_sequence）</h2><div class="kv">' + seq + '</div></div>' : '');
  }

  function item(act, icon, label, support, disabled) {
    return '<button class="item" data-act="' + act + '"' + (disabled ? ' disabled' : '') + '>' +
      ic(icon) + '<span class="lbl">' + label + (support ? '<small>' + support + '</small>' : '') + '</span>' +
      ic('chevron') + '</button>';
  }

  function versionPanel() {
    var u = s.update;
    var body = '<div class="kv"><div class="k">当前版本</div><div class="v">' + esc(s.version || '未知') + '</div>';
    if (u && u.ok) {
      body += '<div class="k">最新版本</div><div class="v">' + esc(u.latest || '—') +
        (u.hasUpdate ? ' · <b style="color:var(--primary)">有更新</b>' : ' · 已是最新') + '</div>';
    } else if (u && u.error) {
      body += '<div class="k">检查结果</div><div class="v">失败：' + esc(u.error) + '</div>';
    }
    body += '</div>';
    if (u && u.ok && u.hasUpdate) {
      if (u.notes) body += '<div class="notes">' + esc(String(u.notes).slice(0, 800)) + '</div>';
      if (u.apk) body += item('doupdate', 'download', '下载并安装 ' + u.latest, u.size ? sizeText(u.size) : '');
      if (u.page) body += item('openpage', 'link', '在浏览器打开发布页', '');
    }
    body += item('check', 'refresh', s.checking ? '正在检查…' : (u ? '重新检查更新' : '检查更新'),
      s.version ? '当前 ' + s.version : '');
    return '<div class="panel"><h2>版本</h2>' + body + '</div>';
  }

  function permPanel() {
    var p = s.perms || {};
    var mediaOk = !!p.images;
    var callOk = !!p.calllog;
    return '<div class="panel"><h2>权限</h2>' +
      item('permmedia', 'photo',
        mediaOk ? '相册权限已授予' : '授予相册权限',
        mediaOk ? '可配对截图与录屏，显示缩略图并可应用内查看'
                : '不授权也能用，只是没有缩略图和配对') +
      item('permcontacts', 'folder',
        (s.perms && s.perms.contacts) ? '通讯录权限已授予' : '授予通讯录权限',
        (s.perms && s.perms.contacts) ? '可与库里的号码哈希比对' : '不给也能用，只是少一路比对') +
      item('permcall', 'call',
        callOk ? '通话记录权限已授予' : '授予通话记录权限',
        callOk ? '可把库里的号码 md5 还原成明文号码与联系人'
               : '不授权也能用，通话只显示号码摘要') +
      '</div>';
  }

  function renderMore() {
    var hasBridge = !!window.Android;
    s.persist = persistInfo();
    $('#view').innerHTML =
      versionPanel() +
      persistPanel() +
      revealPanel() +
      permPanel() +
      '<div class="panel"><h2>读取</h2>' +
        item('auto', 'folder', '从系统路径读取', hasBridge ? '自动尝试五个常见位置，需要 root' : '需要在 App 内运行', !hasBridge) +
        item('pick', 'download', '选择 db 文件', '系统文件选择器，不需要 root') +
        (hasBridge ? item('screens', 'scan', '扫描相册（图片 + 视频）', '配对真实截图与录屏文件，可点开原文件') : '') +
      '</div>' +
      '<div class="panel"><h2>导出</h2>' +
        item('expTxt', 'download', '时间线 TXT', '按天分组的纯文本') +
        item('expJson', 'download', '全量 JSON', '含所有字段与恢复记录') +
        item('expCsv', 'download', '事件 CSV', '带 BOM，Excel 直接开') +
      '</div>' +
      '<div class="panel"><h2>诊断</h2>' +
        item('selftest', 'scan', '跑一次 root 自检', '依次执行 id / getenforce / su -v / su -c id') +
        item('md5probe', 'link', '探测号码 MD5 算法', '用通话记录反推库里 md5 的归一化方式') +
        item('layout', 'scan', '布局诊断', '找出把页面撑宽的元素并写进日志') +
        item('logs', 'info', '诊断日志', 'su 调用、返回码、SELinux、路径探测') +
        item('logcopy', 'download', '复制全部日志', '直接贴出来就能看') +
      '</div>' +
      '<div class="panel"><h2>说明</h2><div style="font-size:13px;line-height:1.8;color:var(--on-surface-var)">' +
        '只读工具：解析与恢复都在内存里完成，不会写回原始数据库。<br><br>' +
        '截图表只有时间戳。开启相册权限后可按时间配到真实图片与录屏，显示缩略图，点击可在应用内查看或播放。<br><br>' +
        '号码还原与数据库保存都是默认关闭的开关，在「更多」里手动打开，关掉即释放。<br><br>' +
        '「含已删除」依赖空闲页与页内空闲块的残留，系统开启 secure_delete 时基本捞不到。<br><br>' +
        '原始路径通常是 <span class="mono">/data/misc/user/0/securitycenter/fraud_detection_data.db</span>，由手机管家的反诈服务写入。' +
      '</div></div>';
  }

  function logText() {
    if (!window.Android || !Android.logs) return { file: '', lines: [] };
    try { return JSON.parse(Android.logs() || '{}'); } catch (e) { return { file: '', lines: [] }; }
  }

  function renderLogs() {
    var d = logText();
    var lines = (d.lines || []).slice().reverse();
    var body = lines.length
      ? lines.map(function (l) { return esc(l); }).join('\n')
      : '（还没有日志，先跑一次 root 自检）';
    var tip = s.verdict ? '<div class="verdict">' + esc(s.verdict) + '</div>' : '';
    $('#view').innerHTML =
      tip +
      '<div class="panel" style="padding:12px">' +
        '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
          '<button class="chip" data-act="selftest">跑自检</button>' +
          '<button class="chip" data-act="logcopy">复制</button>' +
          '<button class="chip" data-act="logexport">导出</button>' +
          '<button class="chip" data-act="logclear">清空</button>' +
          '<button class="chip" data-act="logs">刷新</button>' +
        '</div>' +
        '<div class="logpath mono">' + esc(d.file || '（日志文件不可用）') + '</div>' +
        '<pre class="logview">' + body + '</pre>' +
      '</div>';
  }

  function doCheck(silent) {
    if (!window.Android || !Android.checkUpdate) { if (!silent) toast('需要在 App 内运行'); return; }
    if (s.checking) return;
    s.checking = true;
    if (!silent) render();
    setTimeout(function () {
      try {
        s.update = JSON.parse(Android.checkUpdate() || '{}');
      } catch (e) {
        s.update = { ok: false, error: String(e) };
      }
      s.checking = false;
      if (s.view === 'more') render();
      if (!silent && s.update && s.update.ok) {
        toast(s.update.hasUpdate ? '发现新版本 ' + s.update.latest : '已经是最新版本');
      }
    }, 20);
  }

  function doDownload() {
    var u = s.update;
    if (!u || !u.apk) { toast('没有可下载的安装包'); return; }
    if (!window.Android || !Android.downloadUpdate) { toast('需要在 App 内运行'); return; }
    toast('开始下载…');
    setTimeout(function () {
      var r;
      try { r = JSON.parse(Android.downloadUpdate(u.apk) || '{}'); }
      catch (e) { r = { ok: false, error: String(e) }; }
      if (r && r.ok) {
        s.downloaded = r.name;
        toast('下载完成，开始安装');
        try { Android.installUpdate(r.name); } catch (e) { toast('安装调用失败'); }
      } else {
        toast('下载失败：' + (r && r.error ? r.error : '未知'));
      }
      if (s.view === 'more') render();
    }, 20);
  }

  function runSelfTest() {
    if (!window.Android || !Android.selfTest) { toast('需要在 App 内运行'); return; }
    toast('正在自检…');
    setTimeout(function () {
      try {
        var r = JSON.parse(Android.selfTest() || '{}');
        s.verdict = r.verdict || '';
        toast('自检完成');
      } catch (e) {
        toast('自检失败：' + e);
      }
      setView('logs');
      render();
    }, 20);
  }

  function getReveal() {
    try { return localStorage.getItem('fkmiui.reveal') === '1'; } catch (e) { return false; }
  }

  function setReveal(v) {
    s.reveal = !!v;
    try { localStorage.setItem('fkmiui.reveal', v ? '1' : '0'); } catch (e) { }
    if (!v) {
      s.callIndex = {}; s.callIndexRaw = {}; s.callList = [];
      s.contactIndex = {}; s.contactIndexRaw = {}; s.bookCount = 0;
    }
  }

  function loadContacts() {
    if (!window.Android || !Android.contacts) return;
    var p = s.perms || {};
    if (!s.reveal || !p.contacts) { s.contactIndex = {}; s.contactIndexRaw = {}; s.bookCount = 0; return; }
    var r;
    try { r = JSON.parse(Android.contacts() || '{}'); } catch (e) { r = { ok: false, error: String(e) }; }
    if (!r.ok) { toast('通讯录读取失败：' + (r.error || '未知')); return; }
    var raw = {}, norm = {};
    (r.items || []).forEach(function (it) {
      if (it.md5Raw) raw[String(it.md5Raw).toLowerCase()] = it;
      if (it.md5) norm[String(it.md5).toLowerCase()] = it;
    });
    s.contactIndexRaw = raw;
    s.contactIndex = norm;
    s.bookCount = (r.items || []).length;
    if (s.bookCount) toast('读到 ' + s.bookCount + ' 个联系人号码');
    if (s.view === 'timeline') render();
  }

  function revealPanel() {
    var p = s.perms || {};
    var on = !!s.reveal;
    var html = '<div class="panel"><h2>号码还原</h2>' +
      '<button class="item" data-act="revealToggle">' +
        ic('call') +
        '<span class="lbl">用通讯录和通话记录还原号码' +
          '<small>' + (on ? '只在本机内存里算 MD5 比对，不写盘不联网' : '默认关闭，开启后才读通讯录与通话记录') + '</small>' +
        '</span>' +
        '<span class="sw' + (on ? ' on' : '') + '"><i></i></span>' +
      '</button>';
    if (on) {
      html += '<div class="kv" style="padding:10px 16px 0">' +
        '<div class="k">通话记录</div><div class="v">' +
          (p.calllog ? s.callList.length + ' 条已载入' : '未授权') + '</div>' +
        '<div class="k">通讯录</div><div class="v">' +
          (p.contacts ? s.bookCount + ' 个号码已载入' : '未授权') + '</div>' +
        '</div>';
      if (!p.calllog) html += item('permcall', 'call', '授予通话记录权限', '还没授权');
      if (!p.contacts) html += item('permcontacts', 'folder', '授予通讯录权限', '还没授权');
      html += item('revealReload', 'refresh', '重新读取', '号码变动后重新比对');
    }
    html += '</div>';
    return html;
  }

  function loadPerms() {
    if (!window.Android || !Android.permsState) return { images: false, video: false, calllog: false };
    try { return JSON.parse(Android.permsState() || '{}'); } catch (e) { return { images: false, video: false, calllog: false }; }
  }

  function loadCallLog() {
    if (!window.Android || !Android.calllog) return;
    var p = s.perms || {};
    if (!s.reveal || !p.calllog) { s.callIndex = {}; s.callIndexRaw = {}; s.callList = []; return; }
    var r;
    try { r = JSON.parse(Android.calllog() || '{}'); } catch (e) { r = { ok: false, error: String(e) }; }
    if (!r.ok) { toast('通话记录读取失败：' + (r.error || '未知')); return; }
    var arr = (r.items || []).slice().sort(function (a, b) { return a.date - b.date; });
    var idx = {}, idxRaw = {};
    arr.forEach(function (it) {
      if (it.md5) idx[String(it.md5).toLowerCase()] = it;
      if (it.md5Raw) idxRaw[String(it.md5Raw).toLowerCase()] = it;
    });
    s.callList = arr;
    s.callIndex = idx;
    s.callIndexRaw = idxRaw;
    if (arr.length) toast('读到 ' + arr.length + ' 条通话记录');
    if (s.view === 'timeline') render();
  }

  function pairCall(d0) {
    if (!d0) return null;
    var k = String(d0.md5 || '').toLowerCase();
    // 先通讯录，再通话记录；每种都先比原样，再比去掉分隔符的重算值
    if (k && s.contactIndexRaw && s.contactIndexRaw[k]) return { it: s.contactIndexRaw[k], how: 'contact' };
    if (k && s.contactIndex && s.contactIndex[k]) return { it: s.contactIndex[k], how: 'contact' };
    if (k && s.callIndexRaw && s.callIndexRaw[k]) return { it: s.callIndexRaw[k], how: 'md5' };
    if (k && s.callIndex && s.callIndex[k]) return { it: s.callIndex[k], how: 'md5-norm' };
    if (s.callList && s.callList.length && d0.start) {
      var wrapped = s.callList.map(function (it) { return { ms: it.date, it: it }; });
      var near = nearest(wrapped, d0.start, 90000);
      if (near) return { it: near.item.it, how: 'time' };
    }
    return null;
  }

  function logToNative(tag, msg) {
    if (window.Android && Android.webLog) {
      try { Android.webLog(tag, msg); } catch (e) { }
    }
  }

  /** 量一下有没有元素超出视口，超了就把具体元素报出来 */
  function measureLayout(always) {
    var vw = window.innerWidth || 0;
    var de = document.documentElement;
    var sw = Math.max(de ? de.scrollWidth : 0, document.body ? document.body.scrollWidth : 0);
    var bad = [];
    if (sw > vw + 1) {
      var els = document.querySelectorAll('body *');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          var cls = (typeof el.className === 'string' ? el.className : '').split(' ')[0];
          bad.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') +
            '[l=' + Math.round(r.left) + ' r=' + Math.round(r.right) + ']');
          if (bad.length >= 12) break;
        }
      }
    }
    if (always || bad.length) {
      logToNative('LAYOUT', 'viewport=' + vw + ' scrollWidth=' + sw +
        (bad.length ? ' 超宽元素: ' + bad.join(' | ') : ' 没有超宽元素'));
    }
    return { vw: vw, sw: sw, bad: bad };
  }

  /** 试几种常见的号码归一化，看哪一种能对上库里的 tel_number_md5 */
  function md5Variants(num) {
    var raw = String(num || '');
    var digits = raw.replace(/\D/g, '');
    var no86 = digits.replace(/^86/, '').replace(/^0/, '');
    return {
      '原样': raw,
      '去分隔符': digits,
      '去分隔符+86': '+86' + no86,
      '86前缀': '86' + no86,
      '去首0': digits.replace(/^0/, '')
    };
  }

  function md5Probe() {
    if (!window.Android || !Android.md5) { toast('需要在 App 内运行'); return; }
    var libs = [];
    s.events.concat(s.recovered).forEach(function (e) {
      if (e.kind !== 'call' || !e.data || !e.data.md5) return;
      libs.push({ md5: String(e.data.md5).toLowerCase(), t: e.t, loc: e.data.loc || '', op: e.data.op || '' });
    });
    if (!libs.length) { toast('库里没有通话记录，无从比对'); return; }

    var calls = (s.callList && s.callList.length) ? s.callList : [];
    if (!calls.length) {
      try {
        var r = JSON.parse(Android.calllog() || '{}');
        if (r.ok) calls = r.items || [];
      } catch (e) { }
    }
    if (!calls.length) { toast('需要先授予通话记录权限'); return; }

    var names = ['原样', '去分隔符', '去分隔符+86', '86前缀', '去首0'];
    var hits = {}, samples = {};
    names.forEach(function (n) { hits[n] = 0; samples[n] = []; });

    calls.forEach(function (c) {
      var vs = md5Variants(c.number);
      names.forEach(function (n) {
        var h = Android.md5(vs[n]);
        for (var i = 0; i < libs.length; i++) {
          if (libs[i].md5 === h) {
            hits[n]++;
            if (samples[n].length < 3) {
              samples[n].push(vs[n] + ' → ' + libs[i].md5.slice(0, 8) + '… (' + libs[i].loc + ' ' + libs[i].op + ')');
            }
            break;
          }
        }
      });
    });

    var best = '', bestN = 0;
    names.forEach(function (n) { if (hits[n] > bestN) { bestN = hits[n]; best = n; } });

    var line = names.map(function (n) { return n + '=' + hits[n]; }).join('  ');
    logToNative('MD5', '命中统计 ' + line);
    samples[best].forEach(function (x) { logToNative('MD5', '样例[' + best + '] ' + x); });

    if (bestN > 0) {
      toast('最可能是「' + best + '」形式（' + bestN + ' 次命中）');
      logToNative('MD5', '结论：算法大概率是 md5(' + best + ')');
    } else {
      toast('五种常见形式都没对上，可能带盐');
      logToNative('MD5', '结论：五种常见形式全部未命中，疑似带盐或另有归一化');
    }
  }

  function layoutCheck() {
    var r = measureLayout(true);
    toast(r.bad.length ? '发现 ' + r.bad.length + ' 个超宽元素，已写进日志' : '布局正常，没有横向溢出');
    if (s.view === 'more') render();
  }

  function hydrateThumbs() {
    if (!window.Android || !Android.thumb) return;
    var imgs = document.querySelectorAll('img[data-uri]:not([data-done])');
    var queue = [];
    for (var i = 0; i < imgs.length && queue.length < 60; i++) queue.push(imgs[i]);
    var at = 0;
    function next() {
      if (at >= queue.length) return;
      var el = queue[at++];
      if (el.getAttribute('data-done')) { next(); return; }
      el.setAttribute('data-done', '1');
      var uri = el.getAttribute('data-uri');
      try {
        var b64 = Android.thumb(uri);
        if (b64) el.src = 'data:image/jpeg;base64,' + b64;
        else el.classList.add('fail');
      } catch (e) { el.classList.add('fail'); }
      setTimeout(next, 16);
    }
    next();
  }

  function render() {
    try {
      var tb = document.querySelector('.topbar');
      if (tb && document.documentElement && document.documentElement.style) {
        document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
      }
    } catch (e) { }
    renderMeta();
    renderChips();
    if (!s.db) {
      if (s.view === 'more') { renderMore(); return; }
      $('#view').innerHTML = '<div class="empty">' + ic('folder') +
        '还没有打开数据库<br>点左上角按钮读系统路径，或到「更多」里选一个文件</div>';
      return;
    }
    if (s.view === 'timeline') renderTimeline();
    else if (s.view === 'tables') renderTables();
    else if (s.view === 'stats') renderStats();
    else if (s.view === 'logs') renderLogs();
    else renderMore();
    setTimeout(function () { measureLayout(false); }, 60);
    setTimeout(hydrateThumbs, 80);
  }

  /* ---------- 载入 ---------- */
  function persistInfo() {
    if (!window.Android || !Android.persistInfo) return { enabled: false };
    try { return JSON.parse(Android.persistInfo() || '{}'); } catch (e) { return { enabled: false }; }
  }

  function loadAllSaved() {
    s.saved = []; s.dbs = [];
    if (!window.Android || !Android.savedList) { buildEvents(); return; }
    var list = {};
    try { list = JSON.parse(Android.savedList() || '{}'); } catch (e) { list = {}; }
    if (!list.enabled) { buildEvents(); return; }
    s.savedInfo = list;
    s.saved = list.items || [];
    s.saved.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    s.saved.forEach(function (it) {
      try {
        var r = JSON.parse(Android.savedLoad(it.id) || '{}');
        if (r.ok && r.b64) {
          s.dbs.push({ id: it.id, meta: it, db: SQLiteLite.open(b64ToBytes(r.b64)) });
        }
      } catch (e) {
        logToNative('SAVE', '数据集解析失败 ' + it.id + ' → ' + e);
      }
    });
    if (s.dbs.length) s.db = s.dbs[0].db;
    buildEvents();
  }

  function persistPanel() {
    var p = s.persist || {};
    var on = !!p.enabled;
    var info = '';
    if (p.exists) {
      info = '已保存 ' + sizeText(p.size || 0) +
        (p.savedAt ? ' · ' + dayKey(p.savedAt) + ' ' + hms(p.savedAt) : '');
    } else {
      info = '还没有保存副本';
    }
    var html = '<div class="panel"><h2>数据库保存</h2>' +
      '<button class="item" data-act="persistToggle">' +
        ic('install') +
        '<span class="lbl">保存上次导入的数据库' +
          '<small>' + (on ? '下次启动自动恢复时间线' : '默认关闭，开启后才会写入副本') + '</small>' +
        '</span>' +
        '<span class="sw' + (on ? ' on' : '') + '"><i></i></span>' +
      '</button>';
    if (on) {
      html += '<div class="kv" style="padding:10px 16px 0">' +
        '<div class="k">存储位置</div><div class="v mono">' + esc(p.path || '—') + '</div>' +
        '<div class="k">状态</div><div class="v">' + esc(info) + '</div>' +
        '</div>';
      html += item('storePick', 'folder', '选择保存目录',
        p.custom ? '当前为自定义目录' : '默认存在应用私有目录，可改成任意目录');
      if (p.custom) html += item('storeReset', 'refresh', '恢复默认位置', '改回应用私有目录');
      html += item('persistSave', 'download', '把当前数据库并入已保存数据集', '相同内容只更新时间戳，不重复存');
      var saved = s.saved || [];
      if (saved.length) {
        html += '<div class="kv" style="padding:10px 16px 0"><div class="k">已保存</div><div class="v">' +
          saved.length + ' 份数据集，时间线为合并结果</div></div>';
        saved.slice(0, 8).forEach(function (it) {
          html += '<button class="item" data-act="dsdel" data-id="' + esc(it.id) + '">' +
            ic('chevron') +
            '<span class="lbl">' + esc(it.name || it.id) +
              '<small>' + sizeText(it.size || 0) +
              (it.savedAt ? ' · ' + dayKey(it.savedAt) + ' ' + hms(it.savedAt) : '') +
              ' · 点此删除</small>' +
            '</span>' + ic('chevron') + '</button>';
        });
        if (saved.length > 8) {
          html += '<div class="kv" style="padding:0 16px"><div class="k"></div><div class="v">还有 ' +
            (saved.length - 8) + ' 份未列出</div></div>';
        }
        html += item('dsclear', 'chevron', '清空全部数据集', '删除所有已保存的副本');
      }
    }
    html += '</div>';
    return html;
  }

  function applyBytes(bytes, name, path, src, b64) {
    try {
      s.db = SQLiteLite.open(bytes);
    } catch (e) {
      toast('解析失败：' + (e && e.message ? e.message : e));
      return;
    }
    s.name = name || 'database.db';
    s.path = path || '';
    s.src = src || '';
    s.filter = 'all'; s.shown = 240; s.tableShown = 80; s.table = null;
    s.lastB64 = b64 || '';
    if (b64 && s.persist && s.persist.enabled && window.Android && Android.savedMerge) {
      try {
        var mr = JSON.parse(Android.savedMerge(name, src, b64) || '{}');
        if (mr.ok) logToNative('SAVE', '合并数据集 ' + mr.id + '，现在共 ' + mr.count + ' 份');
      } catch (e) { }
      s.persist = persistInfo();
      loadAllSaved();
    } else {
      buildEvents();
    }
    setView('timeline');
    render();
    toast('已解析 ' + s.events.length + ' 条现存记录' + (s.recovered.length ? '，可恢复 ' + s.recovered.length + ' 条' : ''));
  }

  function setView(v) {
    s.view = v;
    document.querySelectorAll('#nav button').forEach(function (b) {
      var nav = v === 'logs' ? 'more' : v;
      b.classList.toggle('active', b.getAttribute('data-view') === nav);
    });
  }

  function loadScreens() {
    if (!window.Android) return;
    if (s.images.length || s.videos.length) return;
    var imgs = [], vids = [];
    try {
      if (Android.media) {
        var list = JSON.parse(Android.media() || '[]');
        list.forEach(function (it) {
          var ms = 0, name = it.name || '';
          if (it.kind === 'video') {
            ms = parseVideoName(name) || (it.added ? it.added * 1000 : 0);
            if (ms) vids.push({ ms: ms, file: name, uri: it.uri, dur: it.dur || 0, size: it.size || 0 });
          } else {
            var p = parseScreenName(name);
            ms = p ? p.ms : (it.added ? it.added * 1000 : 0);
            if (ms) imgs.push({ ms: ms, file: name, pkg: p ? p.pkg : '', uri: it.uri, size: it.size || 0 });
          }
        });
      } else if (Android.screenshots) {
        JSON.parse(Android.screenshots() || '[]').forEach(function (it) {
          var p = parseScreenName(it.name || it);
          if (p) imgs.push({ ms: p.ms, file: p.file, pkg: p.pkg, uri: '', size: 0 });
        });
      }
    } catch (e) { toast('扫描相册失败：' + e); }
    imgs.sort(function (a, b) { return a.ms - b.ms; });
    vids.sort(function (a, b) { return a.ms - b.ms; });
    s.images = imgs;
    s.videos = vids;
    s.showPair = imgs.length + vids.length > 0;
    if (s.view === 'timeline') render();
    if (imgs.length || vids.length) toast('配对了 ' + imgs.length + ' 张截图 / ' + vids.length + ' 段录屏');
  }

  function autoLoad() {
    if (!window.Android || !Android.autoLoad) { toast('这里读不到系统路径，请手动选文件'); return; }
    toast('正在读取…');
    setTimeout(function () {
      var r;
      try { r = JSON.parse(Android.autoLoad()); }
      catch (e) { toast('读取出错：' + e); return; }
      if (r && r.ok) {
        applyBytes(b64ToBytes(r.b64), r.name, r.path, 'root', r.b64);
        setTimeout(loadScreens, 60);
      } else {
        toast((r && r.error) || '没找到数据库，试试手动选择');
      }
    }, 30);
  }

  /* ---------- 导出 ---------- */
  function allEvents(withDeleted) {
    var list = s.events.slice();
    if (withDeleted) list = list.concat(s.recovered);
    return list.sort(function (a, b) { return a.t - b.t; });
  }
  function evText(e) {
    var d0 = e.data || {};
    switch (e.kind) {
      case 'shot': { var p = pairScreen(e.t); return '截图' + (p && p.pkg ? ' @' + p.pkg : ''); }
      case 'screen': return '屏幕录制 ' + (d0.pkg || '') + ' ' + durText(d0.dur);
      case 'call': return '通话 ' + (d0.loc || '') + ' ' + (d0.op || '') + ' ' + durText(d0.dur);
      case 'air': return '飞行模式 ' + (d0.on ? '开启' : '变化');
      case 'install': return '安装 ' + (d0.name || '') + ' (' + (d0.pkg || '') + ') v' + d0.ver;
      case 'url': return '涉诈链接 type=' + d0.type;
      case 'voip': return 'VoIP ' + (d0.pkg || '') + ' ' + durText(d0.dur);
      case 'forward': return '呼叫转移 ' + (d0.enabled ? '开启' : '关闭');
      default: return e.kind;
    }
  }
  function exportFile(kind) {
    if (!s.db) { toast('先打开一个数据库'); return; }
    var name, content;
    if (kind === 'txt') {
      var lines = ['# 反诈库直查 导出', '# 文件：' + s.name, '# 时间：' + new Date().toLocaleString(), ''];
      var cur = '';
      allEvents(s.showDeleted).forEach(function (e) {
        var dk = dayKey(e.t);
        if (dk !== cur) { lines.push(''); lines.push('== ' + dayLabel(e.t) + ' =='); cur = dk; }
        lines.push(hms(e.t) + '  ' + (e.gone ? '[已删除] ' : '') + evText(e));
      });
      name = 'frauddb-timeline.txt'; content = lines.join('\n');
    } else if (kind === 'json') {
      var out = { exportedAt: new Date().toISOString(), datasets: [], recovered: [] };
      datasets().forEach(function (ds) {
        var d = {
          id: ds.id,
          name: (ds.meta && ds.meta.name) || ds.id,
          stats: ds.db.stats,
          tables: {}
        };
        Object.keys(ds.db.tables).forEach(function (n) {
          var t = ds.db.tables[n];
          d.tables[n] = t.rows.map(function (r) {
            var o = { rowid: r.rowid };
            t.columns.forEach(function (c, i) { if (c !== '_id') o[c] = flat(r.values[i]); });
            return o;
          });
        });
        out.datasets.push(d);
        (ds.db.recovered || []).forEach(function (r) {
          var t = ds.db.tables[r.table], o = { dataset: ds.id, table: r.table, rowid: r.rowid, from: r.from };
          if (t) t.columns.forEach(function (c, i) { if (c !== '_id') o[c] = flat(r.values[i]); });
          out.recovered.push(o);
        });
      });
      name = 'frauddb.json'; content = JSON.stringify(out, null, 2);
    } else {
      var rows = [['时间', '日期', '类型', '描述', '已删除']];
      allEvents(s.showDeleted).forEach(function (e) {
        rows.push([hms(e.t), dayKey(e.t), KINDS[e.kind] ? KINDS[e.kind].label : e.kind, evText(e), e.gone ? '1' : '']);
      });
      name = 'frauddb-events.csv';
      content = '\ufeff' + rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
    }
    if (window.Android && Android.exportText) Android.exportText(name, content);
    else {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
      a.download = name; a.click();
    }
  }

  /* ---------- 交互 ---------- */
  function bind() {
    document.addEventListener('click', function (ev) {
      var thumb = ev.target.closest('img[data-uri]');
      if (thumb) {
        var uri = thumb.getAttribute('data-uri');
        var isVideo = thumb.getAttribute('data-video') === '1';
        if (window.Android && Android.openMedia) Android.openMedia(uri, isVideo);
        else toast('需要在 App 内运行');
        return;
      }
      var t = ev.target.closest('[data-act],[data-view]');
      if (!t) return;
      if (t.hasAttribute('data-view')) {
        setView(t.getAttribute('data-view'));
        s.shown = 240;
        render();
        return;
      }
      var act = t.getAttribute('data-act');
      if (act === 'filter') { s.filter = t.getAttribute('data-kind'); s.shown = 240; render(); }
      else if (act === 'del') { s.showDeleted = !s.showDeleted; render(); }
      else if (act === 'table') { s.table = t.getAttribute('data-name'); s.tableShown = 80; render(); }
      else if (act === 'more') { s.shown += 240; render(); }
      else if (act === 'moreTable') { s.tableShown += 80; render(); }
      else if (act === 'auto') autoLoad();
      else if (act === 'pick') pick();
      else if (act === 'screens') {
        s.images = []; s.videos = [];
        if (s.perms && !s.perms.images) { toast('先授予相册权限'); requestPerm('media'); return; }
        loadScreens();
      }
      else if (act === 'check') doCheck(false);
      else if (act === 'doupdate') doDownload();
      else if (act === 'openpage') { if (window.Android && Android.openUrl) Android.openUrl(s.update.page); }
      else if (act === 'revealToggle') {
        var nv = !s.reveal;
        setReveal(nv);
        if (nv) {
          var pp = s.perms || {};
          toast('已开启，只在本机内存里比对');
          if (!pp.calllog) requestPerm('calllog');
          else loadCallLog();
          if (!pp.contacts) requestPerm('contacts');
          else loadContacts();
        } else {
          toast('已关闭，已释放已载入的号码');
        }
        render();
      }
      else if (act === 'revealReload') { loadCallLog(); loadContacts(); render(); }
      else if (act === 'dsdel') {
        var did = t.getAttribute('data-id');
        try { Android.savedDelete(did); } catch (e) { }
        toast('已删除该数据集');
        s.persist = persistInfo();
        loadAllSaved();
        render();
      }
      else if (act === 'dsclear') {
        try { Android.savedClear(); } catch (e) { }
        toast('已清空全部数据集');
        s.persist = persistInfo();
        loadAllSaved();
        render();
      }
      else if (act === 'storePick') {
        if (window.Android && Android.pickStoreDir) Android.pickStoreDir();
        else toast('需要在 App 内运行');
      }
      else if (act === 'storeReset') {
        try { s.persist = JSON.parse(Android.resetStoreDir() || '{}'); } catch (e) { }
        toast('已恢复默认位置');
        if (s.lastB64 && s.persist.enabled) {
          try { Android.persistCurrent(s.name, s.src, s.lastB64); } catch (e) { }
          s.persist = persistInfo();
        }
        render();
      }
      else if (act === 'persistToggle') {
        var b = s.persist || {};
        var nxt = !b.enabled;
        try { s.persist = JSON.parse(Android.setPersist(nxt) || '{}'); } catch (e) { s.persist = { enabled: nxt }; }
        if (nxt) {
          toast('已开启，副本会存到 ' + (s.persist.path || '应用私有目录'));
          if (s.lastB64) { try { Android.persistCurrent(s.name, s.src, s.lastB64); } catch (e) { } s.persist = persistInfo(); }
        } else {
          toast('已关闭，本地副本已删除');
          s.lastB64 = s.lastB64 || '';
        }
        render();
      }
      else if (act === 'persistSave') {
        if (!s.lastB64) { toast('当前没有已解析的数据库'); return; }
        try {
          var r2 = JSON.parse(Android.savedMerge(s.name, s.src, s.lastB64) || '{}');
          toast(r2.ok ? (r2.merged ? '已存在，更新时间戳' : '已并入数据集，共 ' + r2.count + ' 份') : '保存失败：' + (r2.error || ''));
          loadAllSaved();
        } catch (e) { toast('保存失败'); }
        s.persist = persistInfo();
        render();
      }
      else if (act === 'persistClear') {
        try { Android.clearPersisted(); } catch (e) { }
        toast('已清除本地副本');
        s.persist = persistInfo();
        render();
      }
      else if (act === 'permmedia') requestPerm('media');
      else if (act === 'permcall') requestPerm('calllog');
      else if (act === 'permcontacts') requestPerm('contacts');
      else if (act === 'loadcalls') loadCallLog();
      else if (act === 'md5probe') md5Probe();
      else if (act === 'layout') layoutCheck();
      else if (act === 'selftest') runSelfTest();
      else if (act === 'logs') { setView('logs'); render(); }
      else if (act === 'logcopy') { if (window.Android && Android.copyText) Android.copyText(logText().lines.join('\n')); else toast('需要在 App 内运行'); }
      else if (act === 'logexport') {
        var d = logText();
        if (window.Android && Android.exportText) Android.exportText('frauddb-log.txt', d.lines.join('\n'));
        else toast('需要在 App 内运行');
      }
      else if (act === 'logclear') { if (window.Android && Android.clearLogs) { Android.clearLogs(); s.verdict = ''; render(); } }
      else if (act === 'expTxt') exportFile('txt');
      else if (act === 'expJson') exportFile('json');
      else if (act === 'expCsv') exportFile('csv');
    });

    var bo = $('#btnOpen'), br = $('#btnReload');
    if (bo) bo.addEventListener('click', pick);
    if (br) br.addEventListener('click', function () { s.db ? render() : autoLoad(); });
    var fi = $('#fileInput');
    if (fi) fi.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { applyBytes(new Uint8Array(fr.result), f.name, '', 'pick'); };
      fr.readAsArrayBuffer(f);
    });
  }

  function requestPerm(which) {
    if (!window.Android || !Android.requestPerm) { toast('需要在 App 内运行'); return; }
    var p = s.perms || {};
    if (which === 'media' && p.images) { toast('相册权限已经有了'); return; }
    if (which === 'calllog' && p.calllog) { toast('通话记录权限已经有了'); return; }
    Android.requestPerm(which);
    toast('请在系统弹窗里选择允许');
  }

  function pick() {
    if (window.Android && Android.pickFile) Android.pickFile();
    else $('#fileInput').click();
  }

  window.onPickedDb = function (name, b64) {
    if (!b64) { toast('读取失败'); return; }
    applyBytes(b64ToBytes(b64), name, '', 'pick', b64);
    setTimeout(loadScreens, 60);
  };
  window.onBridgeError = function (m) { toast(m || '读取失败'); };
  window.appAutoLoad = autoLoad;
  window.appRender = function (v) { if (v) setView(v); render(); };
  window.appLayout = function () { return measureLayout(true); };
  window.appStoreChanged = function () {
    s.persist = persistInfo();
    if (s.lastB64 && s.persist.enabled) {
      try { Android.persistCurrent(s.name, s.src, s.lastB64); } catch (e) { }
      s.persist = persistInfo();
    }
    toast('存储位置已更新');
    render();
  };

  window.appPermChanged = function () {
    s.perms = loadPerms();
    if (s.reveal) { loadCallLog(); loadContacts(); }
    if (s.perms.images) { s.images = []; s.videos = []; loadScreens(); }
    render();
  };

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    if (window.Android && Android.versionInfo) {
      try { s.version = (JSON.parse(Android.versionInfo() || '{}') || {}).name || ''; } catch (e) { }
    }
    s.perms = loadPerms();
    s.persist = persistInfo();
    s.reveal = getReveal();
    if (s.reveal) {
      setTimeout(function () { loadCallLog(); loadContacts(); }, 300);
    }

    if (window.Android && Android.savedList && s.persist && s.persist.enabled) {
      setTimeout(function () {
        loadAllSaved();
        if (s.dbs.length) {
          s.name = (s.saved[0] && s.saved[0].name) || s.name;
          s.src = 'stored';
          render();
          toast('已载入 ' + s.dbs.length + ' 份数据集，时间线为合并结果');
          setTimeout(loadScreens, 60);
        } else if (window.Android && Android.autoLoad) {
          autoLoad();
        }
      }, 120);
    } else if (window.Android && Android.autoLoad) {
      setTimeout(autoLoad, 150);
    } else {
      render();
    }
  });
})();
