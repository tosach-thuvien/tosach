/* ===== Tổ sách – trang quản lý ===== */
(function () {
  var $v = document.getElementById('view'), $top = document.getElementById('top-acts');
  var token = null, data = null, tab = 'choDuyet';
  try { token = sessionStorage.getItem('tosach_tok'); } catch (e) {}

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function api(action, d) {
    if (!CONFIG.API_URL || CONFIG.API_URL.indexOf('DAN_DUONG_DAN') === 0) return Promise.reject(new Error('Trang web chưa được nối với sổ quản lý (chưa điền API_URL trong js/config.js).'));
    return fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(Object.assign({ action: action, token: token }, d || {})) })
      .catch(function () { throw new Error('Không kết nối được. Kiểm tra mạng rồi thử lại.'); })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) { if (/hết hạn/.test(j.error || '')) { dangXuat(); } throw new Error(j.error); }
        return j.data;
      });
  }
  function luuTok(t) { token = t; try { t ? sessionStorage.setItem('tosach_tok', t) : sessionStorage.removeItem('tosach_tok'); } catch (e) {} }
  function dangXuat() { luuTok(null); veDangNhap(); }
  function nutCho(b, on) { b.disabled = on; if (on) { b.dataset.c = b.innerHTML; b.innerHTML = '<span class="spinner"></span>'; } else if (b.dataset.c) b.innerHTML = b.dataset.c; }

  // ---------- Đăng nhập ----------
  function veDangNhap() {
    $top.innerHTML = '';
    $v.innerHTML = '<div class="card" style="max-width:420px;margin:30px auto"><h2>Đăng nhập quản lý</h2>' +
      '<div class="field"><label>Mật khẩu</label><input id="mk" type="password" autocomplete="current-password"></div>' +
      '<button class="btn primary block" id="vao">Đăng nhập</button><div id="kq"></div>' +
      '<p class="hint" style="margin-top:12px">Mật khẩu được đặt trong Google Sheets: menu Tổ sách → Đặt mật khẩu trang quản lý.</p></div>';
    var b = document.getElementById('vao'), mk = document.getElementById('mk');
    function vao() {
      nutCho(b, true);
      api('dangNhap', { matKhau: mk.value }).then(function (r) { luuTok(r.token); tai(); })
        .catch(function (e) { nutCho(b, false); document.getElementById('kq').innerHTML = '<div class="notice err">' + esc(e.message) + '</div>'; });
    }
    b.onclick = vao; mk.onkeydown = function (e) { if (e.key === 'Enter') vao(); };
  }

  // ---------- Tải dữ liệu ----------
  function tai() {
    $top.innerHTML = '<button class="btn small" id="tl" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.5)">Tải lại</button> ' +
      '<button class="btn small" id="dx" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.5)">Đăng xuất</button>';
    document.getElementById('tl').onclick = tai;
    document.getElementById('dx').onclick = dangXuat;
    if (!data) $v.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải...</div>';
    api('quanLy').then(function (d) { data = d; ve(); }).catch(function (e) { if (token) $v.innerHTML = '<div class="notice err">' + esc(e.message) + '</div>'; });
  }

  var TABS = [
    ['choDuyet', 'Chờ duyệt mượn'], ['hopTra', 'Hộp trả sách'], ['quaHan', 'Quá hạn'], ['docGiaMoi', 'Độc giả mới'],
    ['dangMuon', 'Đang mượn'], ['docGia', 'Độc giả'], ['nguoiTang', 'Người tặng'], ['inQR', 'In mã QR']
  ];
  function soLuong(k) {
    if (k === 'choDuyet') return data.phieu.choDuyet.length;
    if (k === 'hopTra') return data.phieu.choTra.length;
    if (k === 'quaHan') return data.phieu.quaHan.length;
    if (k === 'docGiaMoi') return data.docGiaCho.length;
    if (k === 'nguoiTang') return data.tangCho.length;
    return 0;
  }
  function ve() {
    var t = data.thongKe, dangMuon = data.phieu.dangMuon.length + data.phieu.quaHan.length + data.phieu.choTra.length;
    var h = '<div class="stats"><div class="stat"><b>' + t.dauSach + '</b><span>Đầu sách</span></div><div class="stat"><b>' + t.banSach + '</b><span>Bản sách</span></div>' +
      '<div class="stat"><b>' + t.coSan + '</b><span>Bản có sẵn</span></div><div class="stat"><b>' + t.docGia + '</b><span>Độc giả</span></div><div class="stat"><b>' + dangMuon + '</b><span>Đang mượn</span></div></div>';
    h += '<div class="tabs">' + TABS.map(function (x) { var n = soLuong(x[0]); return '<button class="tab' + (x[0] === tab ? ' on' : '') + '" data-tab="' + x[0] + '">' + x[1] + (n ? '<span class="n">' + n + '</span>' : '') + '</button>'; }).join('') + '</div>';
    h += '<div id="noidung"></div>';
    $v.innerHTML = h;
    $v.querySelectorAll('.tab').forEach(function (b) { b.onclick = function () { tab = b.getAttribute('data-tab'); ve(); }; });
    var nd = document.getElementById('noidung');
    ({ choDuyet: veChoDuyet, hopTra: veHopTra, quaHan: veQuaHan, docGiaMoi: veDocGiaMoi, dangMuon: veDangMuon, docGia: veDocGia, nguoiTang: veNguoiTang, inQR: veInQR })[tab](nd);
  }
  function trong(nd, msg) { nd.innerHTML = '<div class="notice info">' + msg + '</div>'; }
  function thaoTac(btn, loai, ma, them, xong) {
    nutCho(btn, true);
    return api('thaoTac', Object.assign({ loai: loai, ma: ma }, them || {})).then(function (r) { if (xong) xong(r); tai(); })
      .catch(function (e) { nutCho(btn, false); alert(e.message); });
  }
  function phieuHtml(p, acts, them) {
    return '<div class="card"><div class="item"><div class="info"><p class="book-title" style="font-size:16px">' + esc(p.ten || p.maBan) + '</p>' +
      '<p class="kv">Bản <b>' + esc(p.maBan) + '</b>' + (p.ke ? ' · Kệ ' + esc(p.ke) : '') + ' · Phiếu ' + esc(p.maPhieu) + '</p>' +
      '<p class="kv">Độc giả: <b>' + esc(p.docGia) + '</b></p>' + (them || '') + '</div><div class="acts">' + acts + '</div></div><div class="xtra"></div></div>';
  }

  // ---------- Thẻ: Chờ duyệt mượn ----------
  function veChoDuyet(nd) {
    var ds = data.phieu.choDuyet;
    if (!ds.length) return trong(nd, 'Không có yêu cầu mượn nào đang chờ duyệt.');
    nd.innerHTML = ds.map(function (p) {
      return phieuHtml(p, '<button class="btn small" data-tc="' + esc(p.maPhieu) + '">Từ chối</button><button class="btn small primary" data-dm="' + esc(p.maPhieu) + '">Duyệt</button>', '<p class="kv">Gửi yêu cầu: ' + esc(p.ngayYeuCau) + '</p>');
    }).join('');
    nd.querySelectorAll('[data-dm]').forEach(function (b) { b.onclick = function () { thaoTac(b, 'duyetMuon', b.getAttribute('data-dm')); }; });
    nd.querySelectorAll('[data-tc]').forEach(function (b) {
      b.onclick = function () {
        var box = b.closest('.card').querySelector('.xtra');
        box.innerHTML = '<div class="inline-form"><input type="text" placeholder="Lý do (không bắt buộc), sẽ gửi kèm email cho độc giả"><button class="btn small">Thôi</button><button class="btn small primary">Xác nhận từ chối</button></div>';
        var bs = box.querySelectorAll('button');
        bs[0].onclick = function () { box.innerHTML = ''; };
        bs[1].onclick = function () { thaoTac(bs[1], 'tuChoiMuon', b.getAttribute('data-tc'), { lyDo: box.querySelector('input').value }); };
      };
    });
  }
  // ---------- Thẻ: Hộp trả sách ----------
  function veHopTra(nd) {
    var ds = data.phieu.choTra;
    if (!ds.length) return trong(nd, 'Không có sách nào đang chờ xác nhận trả. Nếu trong hộp có sách mà độc giả quên bấm "Báo trả", tìm phiếu ở thẻ <b>Đang mượn</b> hoặc <b>Quá hạn</b>.');
    nd.innerHTML = '<p class="small muted">Kiểm tra sách trong hộp trả (đối chiếu tờ giấy ghi tên và số điện thoại), rồi bấm xác nhận.</p>' + ds.map(function (p) {
      return phieuHtml(p, '<button class="btn small primary" data-xt="' + esc(p.maPhieu) + '">Xác nhận đã trả</button>', '<p class="kv">Báo trả: ' + esc(p.ngayBaoTra) + ' · Hạn trả: ' + esc(p.hanTra) + '</p>');
    }).join('');
    ganXacNhanTra(nd);
  }
  function ganXacNhanTra(nd) {
    nd.querySelectorAll('[data-xt]').forEach(function (b) {
      b.onclick = function () {
        if (!b.dataset.chac) { b.dataset.chac = 1; b.textContent = 'Bấm lần nữa để xác nhận'; return; }
        thaoTac(b, 'xacNhanTra', b.getAttribute('data-xt'));
      };
    });
  }
  // ---------- Thẻ: Quá hạn / Đang mượn ----------
  function veQuaHan(nd) {
    var ds = data.phieu.quaHan;
    if (!ds.length) return trong(nd, 'Không có sách nào quá hạn. 🎉');
    nd.innerHTML = '<p class="small muted">Độc giả quá hạn được tự động nhắc qua Gmail vào ngày quá hạn thứ 1, 4, 7...</p>' + ds.map(function (p) {
      return phieuHtml(p, '<button class="btn small" data-xt="' + esc(p.maPhieu) + '">Xác nhận đã trả</button>', '<p class="kv" style="color:var(--err)">Hạn trả ' + esc(p.hanTra) + ' · quá hạn <b style="color:var(--err)">' + (-p.conNgay) + ' ngày</b></p>');
    }).join('');
    ganXacNhanTra(nd);
  }
  function veDangMuon(nd) {
    var ds = data.phieu.dangMuon;
    if (!ds.length) return trong(nd, 'Chưa có sách nào đang được mượn (ngoài các sách ở thẻ Quá hạn).');
    nd.innerHTML = '<div class="field"><input type="text" id="locdm" placeholder="Lọc theo tên sách, mã bản, tên hoặc số điện thoại độc giả..."></div><div id="dsdm"></div>';
    function veDs() {
      var q = document.getElementById('locdm').value.toLowerCase();
      var kq = ds.filter(function (p) { return !q || (p.ten + ' ' + p.maBan + ' ' + p.docGia).toLowerCase().indexOf(q) >= 0; });
      document.getElementById('dsdm').innerHTML = kq.map(function (p) {
        return phieuHtml(p, '<button class="btn small" data-xt="' + esc(p.maPhieu) + '">Xác nhận đã trả</button>', '<p class="kv">Hạn trả ' + esc(p.hanTra) + ' · còn ' + p.conNgay + ' ngày</p>');
      }).join('') || '<div class="notice info">Không có phiếu phù hợp.</div>';
      ganXacNhanTra(document.getElementById('dsdm'));
    }
    document.getElementById('locdm').oninput = veDs; veDs();
  }
  // ---------- Thẻ: Độc giả mới ----------
  function veDocGiaMoi(nd) {
    var ds = data.docGiaCho;
    if (!ds.length) return trong(nd, 'Không có độc giả mới chờ duyệt.');
    nd.innerHTML = ds.map(function (d) {
      return '<div class="card"><div class="item"><div class="info"><p class="book-title" style="font-size:16px">' + esc(d.hoTen) + ' <span class="kv">(' + esc(d.ma) + ')</span></p>' +
        '<p class="kv">SĐT: <b>' + esc(d.sdt) + '</b> · Gmail: <b>' + esc(d.gmail) + '</b></p>' +
        '<p class="kv">Năm sinh: <b>' + esc(d.namSinh) + '</b> · Địa chỉ: <b>' + esc(d.diaChi) + '</b></p>' +
        (d.phuHuynh ? '<p class="kv">Phụ huynh: <b>' + esc(d.phuHuynh) + '</b></p>' : '') +
        (d.facebook ? '<p class="kv">Facebook: <b>' + esc(d.facebook) + '</b></p>' : '') +
        (d.ghiChu ? '<p class="kv">Ghi chú: ' + esc(d.ghiChu) + '</p>' : '') + '<p class="kv">Đăng ký: ' + esc(d.ngay) + '</p></div>' +
        '<div class="acts"><button class="btn small" data-k="' + esc(d.ma) + '">Khóa</button><button class="btn small primary" data-d="' + esc(d.ma) + '">Duyệt</button></div></div></div>';
    }).join('');
    nd.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { thaoTac(b, 'duyetDocGia', b.getAttribute('data-d')); }; });
    nd.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { thaoTac(b, 'khoaDocGia', b.getAttribute('data-k')); }; });
  }
  // ---------- Thẻ: Độc giả (tất cả) ----------
  function veDocGia(nd) {
    nd.innerHTML = '<div class="field"><input type="text" id="locdg" placeholder="Tìm theo tên, số điện thoại, mã độc giả..."></div><div id="dsdg"></div>';
    function veDs() {
      var q = document.getElementById('locdg').value.toLowerCase();
      var kq = data.docGia.filter(function (d) { return !q || (d.hoTen + ' ' + d.sdt + ' ' + d.ma + ' ' + d.gmail).toLowerCase().indexOf(q) >= 0; });
      document.getElementById('dsdg').innerHTML = kq.slice(0, 50).map(function (d) {
        var tt = d.trangThai === 'Đã duyệt' ? 'ok' : d.trangThai === 'Bị khóa' ? 'err' : 'warn';
        return '<div class="card"><div class="item"><div class="info"><p style="margin:0"><b>' + esc(d.hoTen) + '</b> <span class="kv">(' + esc(d.ma) + ')</span> <span class="pill ' + tt + '" style="margin:0 0 0 6px">' + esc(d.trangThai) + '</span></p>' +
          '<p class="kv">' + esc(d.sdt) + ' · ' + esc(d.gmail) + '</p></div><div class="acts">' +
          (d.trangThai === 'Bị khóa' ? '<button class="btn small" data-mk="' + esc(d.ma) + '">Mở khóa</button>' : '<button class="btn small" data-kh="' + esc(d.ma) + '">Khóa</button>') +
          '<button class="btn small" data-pin="' + esc(d.ma) + '">Đặt lại PIN</button></div></div><div class="xtra"></div></div>';
      }).join('') || '<div class="notice info">Không tìm thấy độc giả.</div>';
      var box = document.getElementById('dsdg');
      box.querySelectorAll('[data-kh]').forEach(function (b) { b.onclick = function () { thaoTac(b, 'khoaDocGia', b.getAttribute('data-kh')); }; });
      box.querySelectorAll('[data-mk]').forEach(function (b) { b.onclick = function () { thaoTac(b, 'moKhoaDocGia', b.getAttribute('data-mk')); }; });
      box.querySelectorAll('[data-pin]').forEach(function (b) {
        b.onclick = function () {
          var x = b.closest('.card').querySelector('.xtra');
          x.innerHTML = '<div class="inline-form"><input type="text" inputmode="numeric" maxlength="4" placeholder="Mã PIN mới (4 số)"><button class="btn small primary">Lưu PIN mới</button></div><div class="r"></div>';
          var bt = x.querySelector('button');
          bt.onclick = function () {
            var pin = x.querySelector('input').value.trim();
            if (!/^\d{4}$/.test(pin)) { x.querySelector('.r').innerHTML = '<div class="notice err">Mã PIN gồm 4 chữ số.</div>'; return; }
            nutCho(bt, true);
            api('thaoTac', { loai: 'datLaiPin', ma: b.getAttribute('data-pin'), pin: pin }).then(function () {
              x.innerHTML = '<div class="notice ok">Đã đặt lại PIN thành <b>' + esc(pin) + '</b>. Hãy báo cho độc giả.</div>';
            }).catch(function (e) { nutCho(bt, false); x.querySelector('.r').innerHTML = '<div class="notice err">' + esc(e.message) + '</div>'; });
          };
        };
      });
    }
    document.getElementById('locdg').oninput = veDs; veDs();
  }
  // ---------- Thẻ: Người tặng ----------
  function veNguoiTang(nd) {
    var ds = data.tangCho;
    if (!ds.length) return trong(nd, 'Không có đăng ký tặng sách nào đang chờ liên hệ.');
    nd.innerHTML = ds.map(function (t) {
      return '<div class="card"><div class="item"><div class="info"><p style="margin:0"><b>' + esc(t.hoTen) + '</b> <span class="kv">(' + esc(t.ma) + ')</span></p>' +
        '<p class="kv">SĐT: <b>' + esc(t.sdt) + '</b>' + (t.lienHe ? ' · ' + esc(t.lienHe) : '') + '</p><p class="kv">Sách: ' + esc(t.moTa) + '</p><p class="kv">Đăng ký: ' + esc(t.ngay) + '</p></div>' +
        '<div class="acts"><button class="btn small" data-h="' + esc(t.ma) + '">Hủy</button><button class="btn small primary" data-n="' + esc(t.ma) + '">Đã nhận sách</button></div></div></div>';
    }).join('') + '<p class="hint">Sau khi nhận sách: nhập sách vào tab Sách, ghi mã người tặng (ví dụ NT001) ở cột "Mã người tặng", rồi bấm Tổ sách → Tạo mã sách.</p>';
    nd.querySelectorAll('[data-n]').forEach(function (b) { b.onclick = function () { thaoTac(b, 'daNhanTang', b.getAttribute('data-n')); }; });
    nd.querySelectorAll('[data-h]').forEach(function (b) { b.onclick = function () { thaoTac(b, 'huyTang', b.getAttribute('data-h')); }; });
  }
  // ---------- Thẻ: In mã QR ----------
  function veInQR(nd) {
    nd.innerHTML = '<div class="card"><h3>In nhãn mã QR (2,5 × 3 cm, 40 nhãn/tờ A4)</h3>' +
      '<p class="small muted">Nhập khoảng mã đầu sách. Ví dụ từ <b>TS0001</b> đến <b>TS0100</b>, hoặc gõ số 1 và 100. Mỗi bản sách có một nhãn riêng.</p>' +
      '<div class="grid2"><div class="field"><label>Từ mã</label><input id="tu" type="text" placeholder="TS0001"></div><div class="field"><label>Đến mã</label><input id="den" type="text" placeholder="TS0100"></div></div>' +
      '<button class="btn primary" id="tao">Tạo nhãn</button> <button class="btn hidden" id="in">In nhãn</button><div id="qkq"></div>' +
      '<p class="hint" style="margin-top:10px">Khi in: chọn khổ giấy <b>A4</b>, tỷ lệ <b>100%</b> (hoặc "Kích thước thực"), bỏ chọn "Vừa với trang", lề <b>Không</b>. Nên in thử 1 tờ giấy thường trước khi in giấy decal.</p></div>' +
      '<div class="preview-box hidden" id="pv"><div id="in-nhan"></div></div>';
    var bTao = document.getElementById('tao'), bIn = document.getElementById('in');
    bTao.onclick = function () {
      var kq = document.getElementById('qkq');
      kq.innerHTML = ''; nutCho(bTao, true);
      api('dsBan', { tu: document.getElementById('tu').value, den: document.getElementById('den').value }).then(function (ds) {
        nutCho(bTao, false);
        if (!ds.length) { kq.innerHTML = '<div class="notice info">Không có bản sách nào trong khoảng mã này.</div>'; return; }
        var trang = [];
        for (var i = 0; i < ds.length; i += 40) trang.push(ds.slice(i, i + 40));
        document.getElementById('in-nhan').innerHTML = trang.map(function (tr) {
          return '<div class="sheet">' + tr.map(function (b) {
            return '<div class="label"><div class="q">' + QR.svg(CONFIG.WEB_URL + '/?s=' + b.maBan) + '</div><div class="c">' + esc(b.maBan) + '</div><div class="t">' + esc(b.ten) + '</div></div>';
          }).join('') + '</div>';
        }).join('');
        document.getElementById('pv').classList.remove('hidden');
        bIn.classList.remove('hidden');
        kq.innerHTML = '<div class="notice ok">Đã tạo <b>' + ds.length + '</b> nhãn trên <b>' + trang.length + '</b> tờ A4. Bấm "In nhãn" để in.</div>';
      }).catch(function (e) { nutCho(bTao, false); kq.innerHTML = '<div class="notice err">' + esc(e.message) + '</div>'; });
    };
    bIn.onclick = function () { window.print(); };
  }

  if (token) tai(); else veDangNhap();
})();
