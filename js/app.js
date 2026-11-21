/* ===== Tổ sách – trang dành cho độc giả ===== */
(function () {
  var $view = document.getElementById('view');
  var state = { dm: null, loc: 'Tất cả', tu: '', soHien: 30, dangNhap: null, dangTai: false };

  // ---------- Tiện ích ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function boDau(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function luu(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function doc(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function chuaCauHinh() { return !CONFIG.API_URL || CONFIG.API_URL.indexOf('DAN_DUONG_DAN') === 0; }

  function api(action, data) {
    if (chuaCauHinh()) return Promise.reject(new Error('Trang web chưa được nối với sổ quản lý.'));
    var body = JSON.stringify(Object.assign({ action: action }, data || {}));
    return fetch(CONFIG.API_URL, { method: 'POST', body: body })
      .catch(function () { throw new Error('Không kết nối được. Bạn kiểm tra mạng rồi thử lại nhé.'); })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Có lỗi xảy ra.'); return j.data; });
  }
  function nutCho(btn, cho, chu) { btn.disabled = cho; if (cho) { btn.dataset.chu = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span> ' + (chu || 'Đang gửi...'); } else if (btn.dataset.chu) btn.innerHTML = btn.dataset.chu; }
  function thongBao(el, loai, msg) { el.innerHTML = '<div class="notice ' + loai + '">' + msg + '</div>'; }
  function loiO(id, msg) { var e = document.getElementById('e-' + id); if (e) e.textContent = msg || ''; }
  function gt(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  // ---------- Danh mục sách ----------
  function taiDanhMuc(ep) {
    if (!ep && state.dm) return Promise.resolve(state.dm);
    var cu = doc('tosach_dm');
    if (cu && !state.dm) { try { state.dm = JSON.parse(cu); } catch (e) {} }
    var p = api('danhMuc').then(function (d) { state.dm = d; luu('tosach_dm', JSON.stringify(d)); return d; });
    if (state.dm && !ep) { p.then(function () { if (hienTai() === 'tim') veTimSach(); }).catch(function () {}); return Promise.resolve(state.dm); }
    return p;
  }

  // ---------- Định tuyến ----------
  function hienTai() { var h = location.hash.replace(/^#\/?/, ''); return h.split('/')[0] || 'tim'; }
  function dinhTuyen() {
    var q = new URLSearchParams(location.search).get('s');
    if (q) { history.replaceState(null, '', location.pathname + '#/sach/' + encodeURIComponent(q)); }
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var trang = parts[0] || 'tim';
    document.querySelectorAll('nav.bottom a').forEach(function (a) {
      var n = a.getAttribute('data-nav');
      a.classList.toggle('on', n === trang || (trang === 'sach' && n === 'tim') || (trang === 'dang-ky' && n === 'cua-toi'));
    });
    window.scrollTo(0, 0);
    if (chuaCauHinh()) { $view.innerHTML = '<div class="notice warn">Trang web đang được hoàn thiện và chưa nối với sổ quản lý. Bạn quay lại sau nhé.</div>'; return; }
    if (trang === 'sach') return veSach(decodeURIComponent(parts[1] || ''));
    if (trang === 'dang-ky') return veDangKy();
    if (trang === 'cua-toi') return veCuaToi();
    if (trang === 'tang-sach') return veTangSach();
    if (trang === 'quy-dinh') return veQuyDinh();
    return veTimSach();
  }
  window.addEventListener('hashchange', dinhTuyen);

  // ---------- Trang: Tìm sách ----------
  function veTimSach() {
    $view.innerHTML = '<div class="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A08C7A" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input id="q" type="text" placeholder="Tên sách, tác giả..." autocomplete="off" value="' + esc(state.tu) + '"></div>' +
      '<div class="chips" id="chips"></div><p class="small muted" id="dem"></p><div id="ds"><div class="loading"><span class="spinner"></span> Đang tải danh mục sách...</div></div>';
    var q = document.getElementById('q');
    q.addEventListener('input', function () { state.tu = q.value; state.soHien = 30; loc(); });
    taiDanhMuc().then(function () { veChips(); loc(); })
      .catch(function (e) { thongBao(document.getElementById('ds'), 'err', esc(e.message)); });
  }
  function veChips() {
    var tl = {}; state.dm.sach.forEach(function (s) { if (s.theLoai) tl[s.theLoai] = (tl[s.theLoai] || 0) + 1; });
    var ds = ['Tất cả'].concat(Object.keys(tl).sort(function (a, b) { return a.localeCompare(b, 'vi'); }));
    var el = document.getElementById('chips');
    el.innerHTML = ds.map(function (t) { return '<button class="chip' + (t === state.loc ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>'; }).join('');
    el.querySelectorAll('.chip').forEach(function (b) { b.onclick = function () { state.loc = b.getAttribute('data-t'); state.soHien = 30; veChips(); loc(); }; });
  }
  function loc() {
    var tu = boDau(state.tu).split(/\s+/).filter(Boolean);
    var kq = state.dm.sach.filter(function (s) {
      if (state.loc !== 'Tất cả' && s.theLoai !== state.loc) return false;
      if (!tu.length) return true;
      var h = boDau(s.ten + ' ' + s.tacGia + ' ' + s.theLoai + ' ' + s.ma + ' ' + s.nxb);
      return tu.every(function (w) { return h.indexOf(w) >= 0; });
    });
    document.getElementById('dem').textContent = kq.length ? 'Tìm thấy ' + kq.length + ' đầu sách' : '';
    var ds = document.getElementById('ds');
    if (!kq.length) { ds.innerHTML = '<div class="notice info">Không tìm thấy sách phù hợp. Bạn thử gõ từ khóa khác (gõ không dấu cũng được).</div>'; return; }
    ds.innerHTML = kq.slice(0, state.soHien).map(theSach).join('') +
      (kq.length > state.soHien ? '<button class="btn block" id="them">Xem thêm (' + (kq.length - state.soHien) + ' đầu sách)</button>' : '');
    ds.querySelectorAll('.card.click').forEach(function (c) { c.onclick = function () { location.hash = '#/sach/' + encodeURIComponent(c.getAttribute('data-ma')); }; });
    var t = document.getElementById('them'); if (t) t.onclick = function () { state.soHien += 30; loc(); };
  }
  function theSach(s) {
    var tt = s.con > 0 ? '<span class="pill ok">Còn ' + s.con + '/' + s.tong + ' bản</span>' : '<span class="pill no">Đang được mượn hết</span>';
    return '<div class="card click" data-ma="' + esc(s.ma) + '"><p class="book-title">' + esc(s.ten) + '</p><p class="meta">' +
      [s.tacGia, s.theLoai, s.ke ? 'Kệ ' + s.ke : ''].filter(Boolean).map(esc).join(' · ') + '</p>' + tt + '</div>';
  }

  // ---------- Trang: Chi tiết sách (từ QR hoặc danh mục) ----------
  function veSach(ma) {
    $view.innerHTML = '<button class="back" onclick="history.length>1?history.back():location.hash=\'#/\'">‹ Quay lại</button><div id="sach"><div class="loading"><span class="spinner"></span> Đang tải thông tin sách...</div></div>';
    api('sach', { ma: ma }).then(function (s) {
      var dangCam = null;
      s.ban.forEach(function (b) { if (b.maBan.toUpperCase() === String(s.maQuet).toUpperCase()) dangCam = b; });
      var coSan = s.ban.filter(function (b) { return b.trangThai === 'Có sẵn'; }).length;
      var h = '<div class="card"><p class="book-title" style="font-size:21px">' + esc(s.ten) + '</p>' +
        '<p class="meta">' + [s.tacGia, [s.nxb, s.nam].filter(Boolean).join(', ')].filter(Boolean).map(esc).join(' · ') + '</p>' +
        '<p class="meta">' + [s.theLoai ? 'Thể loại: ' + s.theLoai : '', s.ke ? 'Vị trí: Kệ ' + s.ke : ''].filter(Boolean).map(esc).join(' · ') + '</p>' +
        (s.tang.length ? '<p class="meta" style="color:var(--brown)">♥ Sách do ' + s.tang.map(esc).join(', ') + ' tặng</p>' : '');
      if (dangCam) {
        h += '<div class="holding">Bạn đang cầm bản <b>' + esc(dangCam.maBan) + '</b> · ' + nhanTT(dangCam.trangThai) + '</div>';
      }
      h += '<p class="small muted" style="margin:10px 0 0">Các bản của sách này (' + coSan + '/' + s.ban.length + ' có sẵn):</p><div class="copy-list">' +
        s.ban.map(function (b) { return '<span class="' + (b.trangThai === 'Có sẵn' ? 'ok' : '') + '">' + esc(b.maBan) + ': ' + esc(b.trangThai) + '</span>'; }).join('') + '</div></div>';
      var muonDuoc = dangCam ? dangCam.trangThai === 'Có sẵn' : coSan > 0;
      if (muonDuoc) {
        var sdt = doc('tosach_sdt') || '';
        h += '<div class="card"><h3>Mượn ' + (dangCam ? 'cuốn này' : 'sách này') + '</h3>' +
          '<div class="field"><label>Số điện thoại</label><input id="m-sdt" type="tel" inputmode="numeric" placeholder="0901234567" value="' + esc(sdt) + '"></div>' +
          '<div class="field"><label>Mã PIN 4 số</label><input id="m-pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>' +
          '<button class="btn primary block" id="m-gui">Gửi yêu cầu mượn</button><div id="m-kq"></div>' +
          '<p class="small muted" style="margin:10px 0 0;text-align:center">Chưa có tài khoản? <a href="#/dang-ky">Đăng ký làm độc giả</a></p></div>';
      } else {
        h += '<div class="notice info">' + (dangCam ? 'Bản này hiện ' + esc(dangCam.trangThai.toLowerCase()) + ', chưa mượn được.' : 'Hiện chưa có bản nào trên kệ. Bạn quay lại sau nhé.') + '</div>';
      }
      document.getElementById('sach').innerHTML = h;
      var nut = document.getElementById('m-gui');
      if (nut) nut.onclick = function () {
        var sdt = gt('m-sdt').replace(/\D/g, ''), pin = gt('m-pin'), kq = document.getElementById('m-kq');
        if (!/^0\d{9}$/.test(sdt)) return thongBao(kq, 'err', 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.');
        if (!/^\d{4}$/.test(pin)) return thongBao(kq, 'err', 'Mã PIN gồm 4 chữ số.');
        nutCho(nut, true);
        api('muon', { sdt: sdt, pin: pin, ma: dangCam ? dangCam.maBan : s.ma }).then(function (r) {
          luu('tosach_sdt', sdt);
          nut.classList.add('hidden');
          thongBao(kq, 'ok', '<b>Đã gửi yêu cầu mượn</b> (phiếu ' + esc(r.maPhieu) + ', bản ' + esc(r.maBan) + ').<br>Chủ thư viện sẽ duyệt và gửi Gmail cho bạn. Bạn chờ nhận email báo đã duyệt rồi mới mang sách về nhé.');
          state.dm = null;
        }).catch(function (e) { nutCho(nut, false); thongBao(kq, 'err', esc(e.message)); });
      };
    }).catch(function (e) { thongBao(document.getElementById('sach'), 'err', esc(e.message)); });
  }
  function nhanTT(tt) {
    var c = tt === 'Có sẵn' ? 'ok' : tt === 'Mất/Hỏng' ? 'err' : 'warn';
    return '<span class="pill ' + c + '" style="margin:0">' + esc(tt) + '</span>';
  }

  // ---------- Trang: Đăng ký ----------
  function veDangKy() {
    var tuoi = (state.dm && state.dm.tuoiPhuHuynh) || 14;
    $view.innerHTML = '<h2>Đăng ký làm độc giả</h2><p class="muted small">Sau khi chủ thư viện duyệt, bạn sẽ nhận Gmail thông báo kèm quy định mượn sách.</p>' +
      '<div class="card">' +
      '<div class="field"><label>Họ và tên <span class="req">*</span></label><input id="hoten" type="text" placeholder="Nguyễn Văn An"><div class="err-msg" id="e-hoten"></div></div>' +
      '<div class="grid2"><div class="field"><label>Số điện thoại <span class="req">*</span></label><input id="sdt" type="tel" inputmode="numeric" placeholder="0901234567"><div class="err-msg" id="e-sdt"></div></div>' +
      '<div class="field"><label>Gmail <span class="req">*</span></label><input id="gmail" type="email" inputmode="email" placeholder="nguyenvanan@gmail.com" autocapitalize="off"><div class="err-msg" id="e-gmail"></div></div></div>' +
      '<p class="hint" style="margin:-8px 0 14px">Tổ sách gửi thông báo duyệt mượn, nhắc hạn trả và quy định mượn sách qua Gmail này.</p>' +
      '<div class="grid2"><div class="field"><label>Năm sinh <span class="req">*</span></label><input id="namsinh" type="text" inputmode="numeric" maxlength="4" placeholder="1990"><div class="err-msg" id="e-namsinh"></div></div>' +
      '<div class="field"><label>Địa chỉ <span class="req">*</span></label><input id="diachi" type="text" placeholder="Số nhà, tổ, khu phố"><div class="err-msg" id="e-diachi"></div></div></div>' +
      '<div class="parent-box hidden" id="phuhuynh"><p class="small" style="color:var(--warn)">Độc giả dưới ' + tuoi + ' tuổi cần thông tin phụ huynh. Có thể dùng Gmail của phụ huynh ở ô Gmail bên trên.</p>' +
      '<div class="grid2"><div class="field"><label>Họ tên phụ huynh <span class="req">*</span></label><input id="phten" type="text" placeholder="Lê Thị Hoa"><div class="err-msg" id="e-phten"></div></div>' +
      '<div class="field"><label>SĐT phụ huynh <span class="req">*</span></label><input id="phsdt" type="tel" inputmode="numeric" placeholder="0911222333"><div class="err-msg" id="e-phsdt"></div></div></div></div>' +
      '<div class="field"><label>Facebook (không bắt buộc)</label><input id="fb" type="text" placeholder="facebook.com/ten-cua-ban"></div>' +
      '<div class="grid2"><div class="field"><label>Mã PIN 4 số <span class="req">*</span></label><input id="pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••"><div class="err-msg" id="e-pin"></div></div>' +
      '<div class="field"><label>Nhập lại mã PIN <span class="req">*</span></label><input id="pin2" type="password" inputmode="numeric" maxlength="4" placeholder="••••"><div class="err-msg" id="e-pin2"></div></div></div>' +
      '<p class="hint" style="margin:-8px 0 14px">Bạn dùng số điện thoại và mã PIN này mỗi lần mượn sách.</p>' +
      '<div class="field"><label>Ghi chú (không bắt buộc)</label><textarea id="ghichu" rows="2" placeholder="Thể loại sách bạn thích, thời gian tiện đến thư viện..."></textarea></div>' +
      '<label class="check"><input type="checkbox" id="dongy"><span>Tôi đồng ý cho Tổ sách lưu và sử dụng thông tin trên chỉ để quản lý việc mượn trả sách và gửi thông báo qua Gmail. Tôi có thể yêu cầu sửa hoặc xóa thông tin bất cứ lúc nào. <span class="req">*</span></span></label>' +
      '<div class="err-msg" id="e-dongy" style="margin-bottom:10px"></div>' +
      '<button class="btn primary block" id="gui">Gửi đăng ký</button><div id="kq"></div></div>';
    var Y = new Date().getFullYear();
    function treEm() { var n = Number(gt('namsinh')); return n > 1900 && Y - n < tuoi; }
    ['hoten', 'sdt', 'gmail', 'namsinh', 'diachi', 'phten', 'phsdt', 'pin', 'pin2'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () { loiO(id); if (id === 'namsinh') document.getElementById('phuhuynh').classList.toggle('hidden', !treEm()); });
    });
    document.getElementById('dongy').addEventListener('change', function () { loiO('dongy'); });
    var nut = document.getElementById('gui');
    nut.onclick = function () {
      var ok = true;
      function sai(id, m) { loiO(id, m); ok = false; }
      var sdt = gt('sdt').replace(/\D/g, ''), n = Number(gt('namsinh'));
      if (!gt('hoten')) sai('hoten', 'Nhập họ và tên');
      if (!/^0\d{9}$/.test(sdt)) sai('sdt', 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0');
      if (!/^[a-z0-9.+_-]+@gmail\.com$/i.test(gt('gmail'))) sai('gmail', 'Nhập địa chỉ có đuôi @gmail.com');
      if (!(n > 1900 && n <= Y)) sai('namsinh', 'Năm sinh chưa đúng');
      if (!gt('diachi')) sai('diachi', 'Nhập địa chỉ');
      if (treEm()) { if (!gt('phten')) sai('phten', 'Nhập họ tên phụ huynh'); if (!/^0\d{9}$/.test(gt('phsdt').replace(/\D/g, ''))) sai('phsdt', 'Số điện thoại gồm 10 chữ số'); }
      if (!/^\d{4}$/.test(gt('pin'))) sai('pin', 'Mã PIN gồm 4 chữ số'); else if (gt('pin') !== gt('pin2')) sai('pin2', 'Hai mã PIN chưa khớp');
      if (!document.getElementById('dongy').checked) sai('dongy', 'Bạn cần đồng ý để đăng ký');
      var kq = document.getElementById('kq');
      if (!ok) return thongBao(kq, 'err', 'Bạn kiểm tra lại các ô báo đỏ nhé.');
      kq.innerHTML = '';
      nutCho(nut, true);
      api('dangKy', { hoTen: gt('hoten'), sdt: sdt, gmail: gt('gmail'), namSinh: n, diaChi: gt('diachi'), phTen: gt('phten'), phSdt: gt('phsdt').replace(/\D/g, ''),
        facebook: gt('fb'), pin: gt('pin'), ghiChu: gt('ghichu'), dongY: true })
        .then(function (r) {
          luu('tosach_sdt', sdt);
          document.querySelector('#view .card').innerHTML = '<div class="notice ok" style="margin:0"><b>Đã gửi đăng ký!</b> Mã độc giả của bạn: <b>' + esc(r.ma) + '</b>.<br>Chủ thư viện sẽ duyệt và gửi Gmail cho bạn. Sau đó bạn có thể mượn sách bằng số điện thoại và mã PIN vừa đặt.</div>' +
            '<a class="btn block" href="#/" style="margin-top:12px">Tìm sách</a>';
        }).catch(function (e) { nutCho(nut, false); thongBao(kq, 'err', esc(e.message)); });
    };
  }

  // ---------- Trang: Sách của tôi ----------
  function veCuaToi() {
    if (state.dangNhap) return taiCuaToi();
    $view.innerHTML = '<h2>Sách của tôi</h2><div class="card">' +
      '<div class="field"><label>Số điện thoại</label><input id="c-sdt" type="tel" inputmode="numeric" placeholder="0901234567" value="' + esc(doc('tosach_sdt') || '') + '"></div>' +
      '<div class="field"><label>Mã PIN 4 số</label><input id="c-pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>' +
      '<button class="btn primary block" id="c-vao">Xem sách của tôi</button><div id="c-kq"></div>' +
      '<p class="small muted" style="margin:12px 0 0;text-align:center">Chưa có tài khoản? <a href="#/dang-ky">Đăng ký làm độc giả</a><br>Quên mã PIN? Liên hệ chủ thư viện qua <a href="' + esc(CONFIG.FANPAGE) + '" target="_blank" rel="noopener">fanpage</a> để đặt lại.</p></div>';
    var nut = document.getElementById('c-vao');
    nut.onclick = function () {
      var sdt = gt('c-sdt').replace(/\D/g, ''), pin = gt('c-pin'), kq = document.getElementById('c-kq');
      if (!/^0\d{9}$/.test(sdt) || !/^\d{4}$/.test(pin)) return thongBao(kq, 'err', 'Nhập số điện thoại (10 số) và mã PIN (4 số).');
      nutCho(nut, true, 'Đang tải...');
      api('cuaToi', { sdt: sdt, pin: pin }).then(function (d) { state.dangNhap = { sdt: sdt, pin: pin }; luu('tosach_sdt', sdt); veDanhSachCuaToi(d); })
        .catch(function (e) { nutCho(nut, false); thongBao(kq, 'err', esc(e.message)); });
    };
  }
  function taiCuaToi() {
    $view.innerHTML = '<div class="loading"><span class="spinner"></span> Đang tải...</div>';
    api('cuaToi', state.dangNhap).then(veDanhSachCuaToi).catch(function (e) { state.dangNhap = null; veCuaToi(); thongBao(document.getElementById('c-kq'), 'err', esc(e.message)); });
  }
  function veDanhSachCuaToi(d) {
    var dangGiu = d.phieu.filter(function (p) { return ['Chờ duyệt', 'Đang mượn', 'Chờ xác nhận trả'].indexOf(p.trangThai) >= 0; });
    var cu = d.phieu.filter(function (p) { return dangGiu.indexOf(p) < 0; });
    var dangMuon = d.phieu.filter(function (p) { return p.trangThai === 'Đang mượn' || p.trangThai === 'Chờ xác nhận trả'; }).length;
    var h = '<div style="display:flex;align-items:baseline;gap:8px"><h2 style="flex:1">Sách của tôi</h2><span class="small muted">Đang mượn ' + dangMuon + '/' + d.toiDa + '</span></div>' +
      '<p class="small muted">Chào <b>' + esc(d.ten) + '</b> (' + esc(d.ma) + ') · <a href="#" id="thoat">Thoát</a></p><div id="ct-kq"></div>';
    if (!dangGiu.length) h += '<div class="notice info">Bạn chưa mượn cuốn nào. <a href="#/">Tìm sách để mượn</a></div>';
    dangGiu.forEach(function (p) {
      var tt;
      if (p.trangThai === 'Chờ duyệt') tt = '<span class="pill warn">Chờ chủ thư viện duyệt</span>';
      else if (p.trangThai === 'Chờ xác nhận trả') tt = '<span class="pill warn">Đã báo trả · chờ xác nhận</span>';
      else if (p.quaHan) tt = '<span class="pill err">Quá hạn trả</span>';
      else tt = '<span class="pill ok">Đang mượn</span>';
      h += '<div class="card"><p class="book-title">' + esc(p.ten) + '</p><p class="meta">' + esc(p.maBan) +
        (p.hanTra ? ' · Hạn trả <b>' + esc(p.hanTra) + '</b>' : ' · Gửi yêu cầu ' + esc(p.ngayYeuCau)) + '</p>' + tt +
        ((p.coTheGiaHan || p.coTheBaoTra) ? '<div class="row-btns">' + (p.coTheGiaHan ? '<button class="btn small" data-gh="' + esc(p.maPhieu) + '">Gia hạn</button>' : '') +
          (p.coTheBaoTra ? '<button class="btn small" data-bt="' + esc(p.maPhieu) + '">Báo trả</button>' : '') + '</div>' : '') +
        '<div data-xn="' + esc(p.maPhieu) + '"></div></div>';
    });
    if (cu.length) {
      h += '<p class="small muted" style="margin-top:18px">Lịch sử</p>';
      cu.slice(0, 10).forEach(function (p) {
        h += '<div class="card" style="padding:10px 14px"><p class="meta" style="margin:0;color:var(--text)">' + esc(p.ten) + '</p><p class="meta">' +
          (p.trangThai === 'Đã trả' ? 'Đã trả ngày ' + esc(p.ngayTra) : 'Yêu cầu ' + esc(p.ngayYeuCau) + ' · ' + esc(p.trangThai)) + '</p></div>';
      });
    }
    $view.innerHTML = h;
    document.getElementById('thoat').onclick = function (e) { e.preventDefault(); state.dangNhap = null; veCuaToi(); };
    $view.querySelectorAll('[data-gh]').forEach(function (b) {
      b.onclick = function () {
        var ma = b.getAttribute('data-gh'), box = $view.querySelector('[data-xn="' + ma + '"]');
        box.innerHTML = '<div class="notice info">Gia hạn thêm <b>' + esc(d.ngayGiaHan) + ' ngày</b>? Mỗi phiếu chỉ gia hạn được 1 lần.<div class="row-btns"><button class="btn small" data-huy>Thôi</button><button class="btn small primary" data-ok>Gia hạn</button></div></div>';
        box.querySelector('[data-huy]').onclick = function () { box.innerHTML = ''; };
        var ok = box.querySelector('[data-ok]');
        ok.onclick = function () { nutCho(ok, true); api('giaHan', Object.assign({ maPhieu: ma }, state.dangNhap)).then(function (r) { taiCuaToi(); setTimeout(function () { var k = document.getElementById('ct-kq'); if (k) thongBao(k, 'ok', 'Đã gia hạn. Hạn trả mới: <b>' + esc(r.hanTra) + '</b>.'); }, 900); }).catch(function (e) { nutCho(ok, false); thongBao(box, 'err', esc(e.message)); }); };
      };
    });
    $view.querySelectorAll('[data-bt]').forEach(function (b) {
      b.onclick = function () {
        var ma = b.getAttribute('data-bt'), box = $view.querySelector('[data-xn="' + ma + '"]');
        box.innerHTML = '<div class="notice info"><b>Cách trả sách:</b> đặt sách vào <b>hộp trả sách</b> ở thư viện, kèm tờ giấy ghi <b>họ tên và số điện thoại</b> của bạn. Đã để sách vào hộp rồi thì bấm "Tôi đã trả".' +
          '<div class="row-btns"><button class="btn small" data-huy>Thôi</button><button class="btn small primary" data-ok>Tôi đã trả</button></div></div>';
        box.querySelector('[data-huy]').onclick = function () { box.innerHTML = ''; };
        var ok = box.querySelector('[data-ok]');
        ok.onclick = function () { nutCho(ok, true); api('baoTra', Object.assign({ maPhieu: ma }, state.dangNhap)).then(function () { taiCuaToi(); }).catch(function (e) { nutCho(ok, false); thongBao(box, 'err', esc(e.message)); }); };
      };
    });
  }

  // ---------- Trang: Tặng sách ----------
  function veTangSach() {
    $view.innerHTML = '<h2>Tặng sách cho Tổ sách</h2><p class="muted small">Cảm ơn bạn muốn chia sẻ sách! Để lại thông tin, chủ thư viện sẽ liên hệ để nhận sách.</p><div class="card">' +
      '<div class="field"><label>Họ và tên <span class="req">*</span></label><input id="t-ten" type="text" placeholder="Trần Thị Bình"></div>' +
      '<div class="field"><label>Số điện thoại <span class="req">*</span></label><input id="t-sdt" type="tel" inputmode="numeric" placeholder="0912345678"></div>' +
      '<div class="field"><label>Địa chỉ hoặc cách liên hệ</label><input id="t-lh" type="text" placeholder="Tổ 5, khu phố 2 · Zalo cùng số"></div>' +
      '<div class="field"><label>Sách bạn muốn tặng <span class="req">*</span></label><textarea id="t-mt" rows="3" placeholder="Khoảng 20 cuốn truyện thiếu nhi, vài cuốn tiểu thuyết..."></textarea></div>' +
      '<div class="field"><label>Ghi chú (không bắt buộc)</label><input id="t-gc" type="text" placeholder="Thời gian tiện để nhận sách..."></div>' +
      '<label class="check" style="margin-bottom:10px"><input type="checkbox" id="t-ck"><span>Đồng ý hiện tên tôi trên trang của những cuốn sách tôi tặng (ví dụ: "Sách do chị Bình tặng").</span></label>' +
      '<label class="check"><input type="checkbox" id="t-dy"><span>Tôi đồng ý cho Tổ sách lưu thông tin trên để liên hệ nhận sách. <span class="req">*</span></span></label>' +
      '<button class="btn orange block" id="t-gui" style="margin-top:14px">Gửi đăng ký tặng sách</button><div id="t-kq"></div></div>';
    var nut = document.getElementById('t-gui');
    nut.onclick = function () {
      var kq = document.getElementById('t-kq'), sdt = gt('t-sdt').replace(/\D/g, '');
      if (!gt('t-ten')) return thongBao(kq, 'err', 'Nhập họ và tên.');
      if (!/^0\d{9}$/.test(sdt)) return thongBao(kq, 'err', 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.');
      if (!gt('t-mt')) return thongBao(kq, 'err', 'Mô tả sách bạn muốn tặng.');
      if (!document.getElementById('t-dy').checked) return thongBao(kq, 'err', 'Bạn cần đồng ý để gửi đăng ký.');
      nutCho(nut, true);
      api('tangSach', { hoTen: gt('t-ten'), sdt: sdt, lienHe: gt('t-lh'), moTa: gt('t-mt'), ghiChu: gt('t-gc'), congKhai: document.getElementById('t-ck').checked })
        .then(function () { document.querySelector('#view .card').innerHTML = '<div class="notice ok" style="margin:0"><b>Cảm ơn bạn rất nhiều!</b> Chủ thư viện sẽ sớm liên hệ để nhận sách.</div>'; })
        .catch(function (e) { nutCho(nut, false); thongBao(kq, 'err', esc(e.message)); });
    };
  }

  // ---------- Trang: Quy định ----------
  function veQuyDinh() {
    $view.innerHTML = '<h2>Quy định mượn sách</h2><div class="card" id="qd"><div class="loading"><span class="spinner"></span></div></div>';
    taiDanhMuc().then(function (d) {
      document.getElementById('qd').innerHTML = '<ol class="rules">' + d.quyDinh.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        '<div class="row-btns"><a class="btn primary" href="#/dang-ky">Đăng ký làm độc giả</a></div>';
    }).catch(function (e) { thongBao(document.getElementById('qd'), 'err', esc(e.message)); });
  }

  // ---------- Chân trang ----------
  document.getElementById('foot').innerHTML = '<a href="' + esc(CONFIG.FANPAGE) + '" target="_blank" rel="noopener">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>' +
    'Fanpage Tổ sách</a>';

  dinhTuyen();
})();
