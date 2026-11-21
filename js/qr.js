/*
 * Bộ tạo mã QR nhỏ gọn cho Tổ sách (chế độ byte, phiên bản 1–10, mức sửa lỗi M).
 * Viết dựa theo thuật toán chuẩn ISO/IEC 18004 (tham khảo cách làm của thư viện qrcodegen - Nayuki, giấy phép MIT).
 * Cách dùng: QR.svg("https://tosach.vn/?s=TS0001-1") → chuỗi <svg>.
 */
var QR = (function () {
  // [bit định dạng, số mã sửa lỗi mỗi khối, số khối] theo phiên bản 1..10
  var ECC = {
    L: [1, [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4]],
    M: [0, [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]]
  };
  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v, e) { return Math.floor(rawModules(v) / 8) - ECC[e][1][v] * ECC[e][2][v]; }
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function divisor(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (var i = 0; i < deg; i++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 0x02);
    }
    return r;
  }
  function remainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= mul(c, f); });
    });
    return r;
  }
  function utf8(s) { var u = unescape(encodeURIComponent(s)), a = []; for (var i = 0; i < u.length; i++) a.push(u.charCodeAt(i)); return a; }
  function alignPos(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
    var step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, res = [6];
    for (var pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
    return res;
  }

  function encode(text, e) {
    e = e || 'M';
    var bytes = utf8(text), v, cap;
    for (v = 1; v <= 10; v++) { cap = dataCodewords(v, e) * 8; if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap) break; }
    if (v > 10) throw new Error('Nội dung QR quá dài');
    var bb = [];
    function app(val, n) { for (var i = n - 1; i >= 0; i--) bb.push((val >>> i) & 1); }
    app(4, 4); app(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { app(b, 8); });
    app(0, Math.min(4, cap - bb.length));
    app(0, (8 - bb.length % 8) % 8);
    for (var pad = 0xEC; bb.length < cap; pad ^= 0xEC ^ 0x11) app(pad, 8);
    var dc = [];
    for (var i = 0; i < bb.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bb[i + j]; dc.push(x); }

    // Thêm mã sửa lỗi và xen kẽ các khối
    var nb = ECC[e][2][v], eb = ECC[e][1][v], raw = Math.floor(rawModules(v) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = divisor(eb), blocks = [];
    for (var i = 0, k = 0; i < nb; i++) {
      var dat = dc.slice(k, k + shortLen - eb + (i < nShort ? 0 : 1));
      k += dat.length;
      var ecc = remainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (var i = 0; i < blocks[0].length; i++)
      for (var j = 0; j < blocks.length; j++)
        if (i !== shortLen - eb || j >= nShort) all.push(blocks[j][i]);

    // Vẽ ma trận
    var size = v * 4 + 17, mod = [], fn = [];
    for (var y = 0; y < size; y++) { mod.push([]); fn.push([]); for (var x = 0; x < size; x++) { mod[y].push(false); fn[y].push(false); } }
    function set(x, y, d) { mod[y][x] = d; fn[y][x] = true; }
    for (var i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPos(v), na = ap.length;
    for (var i = 0; i < na; i++) for (var j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function drawFormat(mask) {
      var data = (ECC[e][0] << 3) | mask, rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      function b(i) { return ((bits >>> i) & 1) !== 0; }
      for (var i = 0; i <= 5; i++) set(8, i, b(i));
      set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
      for (var i = 9; i < 15; i++) set(14 - i, 8, b(i));
      for (var i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
      for (var i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
      set(8, size - 8, true);
    }
    drawFormat(0);
    if (v >= 7) {
      var rem = v;
      for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bits = (v << 12) | rem;
      for (var i = 0; i < 18; i++) {
        var bt = ((bits >>> i) & 1) !== 0, a = size - 11 + i % 3, bq = Math.floor(i / 3);
        set(a, bq, bt); set(bq, a, bt);
      }
    }
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && n < all.length * 8) { mod[y][x] = ((all[n >>> 3] >>> (7 - (n & 7))) & 1) !== 0; n++; }
      }
    }
    function applyMask(m) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        if (fn[y][x]) continue;
        var inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (inv) mod[y][x] = !mod[y][x];
      }
    }
    function penalty() {
      var p = 0, dark = 0;
      for (var y = 0; y < size; y++) {
        var runX = 1, runY = 1;
        for (var x = 0; x < size; x++) {
          if (mod[y][x]) dark++;
          if (x > 0) {
            if (mod[y][x] === mod[y][x - 1]) { runX++; if (runX === 5) p += 3; else if (runX > 5) p++; } else runX = 1;
            if (mod[x][y] === mod[x - 1][y]) { runY++; if (runY === 5) p += 3; else if (runY > 5) p++; } else runY = 1;
          }
          if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
        }
      }
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    }
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) {
      applyMask(m); drawFormat(m);
      var pp = penalty();
      if (pp < bestP) { bestP = pp; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return mod;
  }

  /** Trả về chuỗi SVG (có viền trắng 4 ô). */
  function svg(text) {
    var m = encode(text), n = m.length, q = 4, d = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += 'M' + (x + q) + ',' + (y + q) + 'h1v1h-1z';
    var s = n + q * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  return { encode: encode, svg: svg };
})();
if (typeof module !== 'undefined') module.exports = QR;
