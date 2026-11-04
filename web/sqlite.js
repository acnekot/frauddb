/* SQLiteLite —— 只读 SQLite 解析器
 * 自己走 b-tree，不依赖任何原生库；支持溢出页、UTF-8/UTF-16、
 * 以及「恢复模式」：从空闲页与页内空闲块里捞回已被删除的记录。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SQLiteLite = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function u16(b, p) { return (b[p] << 8) | b[p + 1]; }
  function u32(b, p) { return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0; }
  function i64(b, p) { return u32(b, p) * 4294967296 + u32(b, p + 4); }

  function varint(b, p) {
    var v = 0, i, c;
    for (i = 0; i < 9; i++) {
      c = b[p + i];
      if (c === undefined) throw new Error('varint eof');
      v = v * 128 + (c & 0x7f);
      if (!(c & 0x80)) return [v, p + i + 1];
    }
    throw new Error('varint too long');
  }

  function decodeText(b, start, len, enc) {
    var out = '', i = start, end = start + len, c, c2, cp;
    if (enc === 2 || enc === 3) { // UTF-16 LE / BE
      for (i = start; i + 1 < end; i += 2) {
        c = enc === 2 ? (b[i] | (b[i + 1] << 8)) : ((b[i] << 8) | b[i + 1]);
        out += String.fromCharCode(c);
      }
      return out;
    }
    while (i < end) {
      c = b[i];
      if (c < 0x80) { out += String.fromCharCode(c); i++; }
      else if (c < 0xE0) { out += String.fromCharCode(((c & 0x1F) << 6) | (b[i + 1] & 0x3F)); i += 2; }
      else if (c < 0xF0) {
        out += String.fromCharCode(((c & 0x0F) << 12) | ((b[i + 1] & 0x3F) << 6) | (b[i + 2] & 0x3F)); i += 3;
      } else {
        cp = (((c & 0x07) << 18) | ((b[i + 1] & 0x3F) << 12) | ((b[i + 2] & 0x3F) << 6) | (b[i + 3] & 0x3F)) - 0x10000;
        out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); i += 4;
      }
    }
    return out;
  }

  // 解析一条记录的 payload：返回 {values:[]}
  function parseRecord(pay, enc) {
    if (!pay || pay.length < 1) return null;
    var hlen, p, types = [], t, res;
    res = varint(pay, 0); hlen = res[0];
    if (hlen > pay.length || hlen < 1) return null;
    p = res[1];
    while (p < hlen) {
      res = varint(pay, p); t = res[0]; p = res[1];
      types.push(t);
      if (types.length > 200) return null;
    }
    var values = [], dp = hlen, n, i, v;
    for (i = 0; i < types.length; i++) {
      t = types[i];
      if (t === 0) { values.push(null); continue; }
      if (t >= 1 && t <= 6) {
        n = [1, 2, 3, 4, 6, 8][t - 1];
        if (dp + n > pay.length) return null;
        if (n === 8) v = i64(pay, dp);
        else { v = 0; for (var k = 0; k < n; k++) v = v * 256 + pay[dp + k]; }
        var lim = Math.pow(2, n * 8 - 1);          // 整数是有符号的，做一次符号扩展
        if (v >= lim) v -= lim * 2;
        dp += n; values.push(v); continue;
      }
      if (t === 7) {
        if (dp + 8 > pay.length) return null;
        var dv = new DataView(pay.buffer, pay.byteOffset + dp, 8);
        dp += 8; values.push(dv.getFloat64(0)); continue;
      }
      if (t === 8) { values.push(0); continue; }
      if (t === 9) { values.push(1); continue; }
      if (t >= 12) {
        n = (t % 2 === 0) ? (t - 12) / 2 : (t - 13) / 2;
        if (dp + n > pay.length) return null;
        if (t % 2 === 1) values.push(decodeText(pay, dp, n, enc));
        else values.push({ blob: pay.subarray(dp, dp + n) });
        dp += n; continue;
      }
      return null;
    }
    if (dp > pay.length) return null;
    return { values: values, used: dp };
  }

  function splitColumns(sql) {
    var m = /create\s+table\s+[`"\[]?[\w.]+[`"\]]?\s*\(([\s\S]*)\)\s*$/i.exec(sql || '');
    if (!m) return [];
    var body = m[1], parts = [], depth = 0, cur = '', i, ch;
    for (i = 0; i < body.length; i++) {
      ch = body[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    var cols = [];
    for (i = 0; i < parts.length; i++) {
      var seg = parts[i].trim();
      if (!seg) continue;
      var kw = seg.split(/\s+/)[0].replace(/[`"\[\]]/g, '');
      if (/^(primary|unique|check|foreign|constraint)$/i.test(kw)) continue;
      cols.push(kw);
    }
    return cols;
  }

  function open(input) {
    var b = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (b.length < 100) throw new Error('文件太小，不可能是一个 SQLite 数据库');
    if (!(b[0] === 0x53 && b[1] === 0x51 && b[2] === 0x4C && b[3] === 0x69)) {
      throw new Error('文件头不是 "SQLite format 3"，这不是 SQLite 数据库');
    }
    var pageSize = u16(b, 16);
    if (pageSize === 1) pageSize = 65536;
    if (pageSize < 512) throw new Error('页大小异常：' + pageSize);
    var reserved = b[20];
    var usable = pageSize - reserved;
    var encoding = u32(b, 56) || 1;
    var filePages = Math.floor(b.length / pageSize);
    var declaredPages = u32(b, 28);
    var pageCount = declaredPages && declaredPages <= filePages ? declaredPages : filePages;

    var ctx = {
      bytes: b, pageSize: pageSize, usable: usable, reserved: reserved,
      encoding: encoding, pageCount: pageCount,
      filePages: filePages, declaredPages: declaredPages,
      freeTrunk: u32(b, 32), freeCount: u32(b, 36),
      changeCounter: u32(b, 24), schemaCookie: u32(b, 40)
    };

    function base(page) { return (page - 1) * pageSize; }

    // 取一条表叶子 cell 的完整 payload（含溢出页）
    function payloadOf(cellOff, payloadLen) {
      var maxLocal = usable - 35;
      var minLocal = Math.floor((usable - 12) * 32 / 255) - 23;
      var local = payloadLen <= maxLocal ? payloadLen
        : (function () {
          var l = minLocal + (payloadLen - minLocal) % (usable - 4);
          return l > maxLocal ? minLocal : l;
        })();
      var p = cellOff, out = b.subarray(p, p + local), need = payloadLen - local;
      if (need > 0) {
        var ov = u32(b, p + local), guard = 0;
        var chunks = [out];
        while (ov && need > 0 && guard++ < 10000) {
          var off = base(ov);
          if (off + 4 > b.length) break;
          var take = Math.min(usable - 4, need);
          chunks.push(b.subarray(off + 4, off + 4 + take));
          need -= take; ov = u32(b, off);
        }
        var size = 0, i;
        for (i = 0; i < chunks.length; i++) size += chunks[i].length;
        var merged = new Uint8Array(size), at = 0;
        for (i = 0; i < chunks.length; i++) { merged.set(chunks[i], at); at += chunks[i].length; }
        out = merged;
      }
      return out;
    }

    // 走表 b-tree，回调每行 {rowid, payload}
    // 注意：第 1 页前面还有 100 字节的库头，页头从 +100 开始；
    // 而 cell 指针值始终相对页首。
    function walkTable(page, onRow, onPage, depth) {
      depth = depth || 0;
      if (depth > 40 || page < 1 || page > pageCount) return;
      if (onPage) onPage(page);
      var base0 = base(page), off = page === 1 ? base0 + 100 : base0;
      var type = b[off], n, i;
      if (type === 0x0D) {                       // 表叶子页
        n = u16(b, off + 3);
        for (i = 0; i < n; i++) {
          var cp = base0 + u16(b, off + 8 + i * 2);
          var res = varint(b, cp);
          var plen = res[0], p2 = res[1];
          var r2 = varint(b, p2);
          var rowid = r2[0], p3 = r2[1];
          if (plen <= 0 || plen > 1 << 24) continue;
          onRow(rowid, payloadOf(p3, plen), cp);
        }
      } else if (type === 0x05) {                // 表内部页
        n = u16(b, off + 3);
        for (i = 0; i < n; i++) {
          var cp2 = base0 + u16(b, off + 12 + i * 2);
          walkTable(u32(b, cp2), onRow, onPage, depth + 1);
        }
        walkTable(u32(b, off + 8), onRow, onPage, depth + 1);
      }
    }

    // ---- 读 sqlite_master ----
    var master = [];
    walkTable(1, function (rowid, pay) {
      var rec = parseRecord(pay, encoding);
      if (!rec) return;
      var v = rec.values;
      master.push({ rowid: rowid, type: v[0], name: v[1], tblName: v[2], rootPage: v[3], sql: v[4] });
    });

    var tables = {};
    var order = [];
    master.forEach(function (m) {
      if (m.type !== 'table') return;
      var t = { name: m.name, rootPage: m.rootPage, sql: m.sql, columns: splitColumns(m.sql), rows: [], pages: [] };
      if (m.rootPage >= 1 && m.rootPage <= pageCount) {
        try {
          walkTable(m.rootPage, function (rowid, pay) {
            var rec = parseRecord(pay, encoding);
            if (!rec) return;
            t.rows.push({ rowid: rowid, values: rec.values });
          }, function (pg) { t.pages.push(pg); });
        } catch (e) { t.error = String(e && e.message || e); }
      }
      tables[m.name] = t; order.push(m.name);
    });

    ctx.master = master;
    ctx.tables = tables;
    ctx.tableOrder = order;

    // ---- 恢复模式 ----
    function plausible(schema, values) {
      var cols = schema.columns, i;
      if (values.length !== cols.length) return false;
      for (i = 0; i < cols.length; i++) {
        var nm = String(cols[i] || '').toLowerCase();
        var v = values[i];
        if (/time|_at$|^start|^end/.test(nm)) {
          if (typeof v !== 'number' || v < 1.0e12 || v > 2.5e12) return false;
        }
      }
      return true;
    }

    function tryCellAt(offset, schema, limit) {
      if (offset < 0 || offset + 3 > limit) return null;
      var r1, r2, plen, rowid;
      try { r1 = varint(b, offset); } catch (e) { return null; }
      plen = r1[0];
      if (plen < 2 || plen > 200000) return null;
      try { r2 = varint(b, r1[1]); } catch (e) { return null; }
      rowid = r2[0];
      if (rowid < 1) return null;
      var p = r2[1];
      if (p + plen > b.length) return null;
      var rec = parseRecord(b.subarray(p, p + plen), encoding);
      if (!rec || rec.used !== plen) return null;
      if (!plausible(schema, rec.values)) return null;
      return { rowid: rowid, values: rec.values, end: p + plen };
    }

    var recovered = [];
    var seen = {};
    function addRecovered(tableName, rid, values, from) {
      var key = tableName + '#' + rid;
      if (seen[key]) return;
      seen[key] = 1;
      if (tables[tableName]) {
        for (var i = 0; i < tables[tableName].rows.length; i++) {
          if (tables[tableName].rows[i].rowid === rid) return;
        }
      }
      recovered.push({ table: tableName, rowid: rid, values: values, from: from });
    }

    var schemas = order.filter(function (n) { return n !== 'sqlite_sequence'; })
      .map(function (n) { return tables[n]; });

    // 1) 页内空闲块（已被 row 删除但仍留在本页）
    order.forEach(function (name) {
      var t = tables[name];
      if (!t || name === 'sqlite_sequence') return;
      t.pages.forEach(function (pg) {
        var off = base(pg), fb = u16(b, off + 1), guard = 0;
        while (fb && guard++ < 400) {
          var fbo = off + fb;
          if (fbo + 4 > b.length) break;
          var nextFb = u16(b, fbo), size = u16(b, fbo + 2);
          if (size < 4 || size > usable) break;
          var from = fbo + 4, to = Math.min(fbo + size, b.length), s;
          for (s = from; s < to; s++) {
            var hit = tryCellAt(s, t, to);
            if (hit) { addRecovered(name, hit.rowid, hit.values, 'freeblock'); s = hit.end - 1; }
          }
          fb = nextFb;
        }
      });
    });

    // 2) 空闲页（曾被整页释放，内容大多还在）
    var trunk = ctx.freeTrunk, guard = 0;
    var freedPages = [];
    while (trunk && trunk <= pageCount && guard++ < 10000) {
      var to = base(trunk);
      if (to + 8 > b.length) break;
      var nextTrunk = u32(b, to), cnt = u32(b, to + 4);
      if (cnt > 100000) break;
      for (var i = 0; i < cnt; i++) {
        var pg = u32(b, to + 8 + i * 4);
        if (pg >= 1 && pg <= pageCount) freedPages.push(pg);
      }
      trunk = nextTrunk;
    }
    freedPages.forEach(function (pg) {
      var off = base(pg), type = b[off];
      if (type !== 0x0D) return;
      var n = u16(b, off + 3);
      if (n === 0 || n > usable) return;
      for (var i = 0; i < n; i++) {
        var ptr = off + u16(b, off + 8 + i * 2);
        for (var s = 0; s < schemas.length; s++) {
          var hit = tryCellAt(ptr, schemas[s], b.length);
          if (hit) { addRecovered(schemas[s].name, hit.rowid, hit.values, 'freepage'); break; }
        }
      }
    });

    ctx.recovered = recovered;
    ctx.freedPages = freedPages;
    ctx.stats = {
      pageSize: pageSize, usable: usable, pageCount: pageCount,
      fileSize: b.length, encoding: encoding === 2 ? 'UTF-16LE' : encoding === 3 ? 'UTF-16BE' : 'UTF-8',
      freeTrunk: ctx.freeTrunk, freeCount: ctx.freeCount,
      freedPages: freedPages.length, recovered: recovered.length
    };
    return ctx;
  }

  return { open: open, parseRecord: parseRecord, decodeText: decodeText };
});
