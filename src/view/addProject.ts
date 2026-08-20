// cm:why One dialog, one stream, used by BOTH the hub and a project page. A brand-new user lands on
// the hub with no projects, so a button that only exists on a project page cannot be reached at all.
export const ADD_STYLE = `
.btn { font-size:12.5px; font-weight:600; border:1px solid var(--line); border-radius:8px;
  padding:6px 12px; background:var(--surface); color:var(--ink); cursor:pointer; }
.btn:hover { background:var(--surface-3); }
.btn[disabled] { opacity:.5; cursor:progress; }
.btn.primary { color:#fff; background:var(--brand); border-color:var(--brand); }
.btn.primary:hover { filter:brightness(1.08); }
.scanlog { margin:10px 0 0; padding:10px 12px; border:1px solid var(--line); border-radius:9px;
  background:var(--surface-2); font:11.5px/1.6 ui-monospace,monospace; max-height:220px;
  overflow:auto; white-space:pre-wrap; display:none; }
.scanlog.on { display:block; }
.scanlog .err { color:var(--dead); }
.scanlog .ok { color:var(--exact); }
.dlg { border:1px solid var(--line); border-radius:14px; background:var(--surface); color:var(--ink);
  padding:0; box-shadow:var(--shadow); width:min(520px,94vw); }
.dlg::backdrop { background:rgba(2,6,16,.55); }
.dlg form { padding:18px 20px 16px; }
.dlg h3 { margin:0 0 4px; font-size:16px; }
.dlg .dsub { margin:0 0 14px; font-size:12px; color:var(--muted); }
.dlg .dsub code { font:11.5px ui-monospace,monospace; }
.dlg label { display:block; font-size:11.5px; color:var(--muted); margin:0 0 10px; }
.dlg label .opt { opacity:.8; }
.dlg input { display:block; width:100%; margin-top:4px; font:12.5px ui-monospace,monospace;
  color:var(--ink); background:var(--surface-2); border:1px solid var(--line);
  border-radius:8px; padding:7px 9px; }
.dlg input:focus { outline:2px solid var(--brand); outline-offset:-1px; }
.dlg .dmsg { margin:0; font-size:12px; min-height:1.5em; }
.dlg .dmsg.bad { color:var(--dead); }
.dlg .dmsg.ok { color:var(--exact); }
.dlg .drow { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
`;

// cm:why A native <dialog>: Esc closes it, focus is trapped and the backdrop comes free. A hand-made
// overlay div would need all three written again, and the third one always gets skipped.
export const ADD_DIALOG = `<dialog id="add-dlg" class="dlg">
  <form id="add-form" method="dialog">
    <h3 id="add-title">Thêm project</h3>
    <p class="dsub" id="add-sub">apiflow chỉ ghi vào <code>~/.apiflow</code> — không bao giờ viết gì vào repo được đọc.</p>
    <label>Tên<input name="name" autocomplete="off" required placeholder="Adminhub"></label>
    <label>Thư mục FE<input name="fe" autocomplete="off" placeholder="/home/ban/services/adminhub-ui"></label>
    <label>Thư mục BE<input name="be" autocomplete="off" placeholder="/home/ban/services/adminhub-api"></label>
    <label id="add-idrow">id <span class="opt">(bỏ trống thì rút từ tên)</span><input name="id" autocomplete="off" placeholder="adminhub"></label>
    <label>file hints <span class="opt">(không bắt buộc)</span><input name="hints" autocomplete="off"></label>
    <p class="dmsg" id="add-msg"></p>
    <div class="drow">
      <button class="btn" type="button" id="add-cancel">Đóng</button>
      <button class="btn primary" type="submit" id="add-save">Thêm</button>
    </div>
  </form>
</dialog>`;

// cm:guard No backticks and no ${} below — this is embedded inside a String.raw literal, so either
// one ends the literal early and the page ships a syntax error instead of a script.
// cm:edge contract -> src/server/index.ts — POST /api/projects and /api/projects/:id/scan, including
// the `message` field this renders verbatim and the SSE shape it reads line by line.
export const ADD_SCRIPT = String.raw`
const $id = (id) => document.getElementById(id);
let openEdit = () => undefined;
const HERE = JSON.parse(($id('project') || { textContent: 'null' }).textContent);

// cm:why Reads the stream line by line and never reloads on its own: a scan can fail halfway, and a
// page that refreshed itself would replace the error text with a map that did not change.
function streamScan(kind, id) {
  const target = id || HERE;
  const box = $id('scanlog');
  box.classList.add('on');
  box.textContent = 'đang scan ' + kind.toUpperCase() + ' cho ' + target + '…\n';
  for (const b of document.querySelectorAll('.btn')) b.disabled = true;
  const add = (text, cls) => {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    box.appendChild(span);
    box.scrollTop = box.scrollHeight;
  };
  const release = () => { for (const b of document.querySelectorAll('.btn')) b.disabled = false; };

  fetch('/api/projects/' + target + '/scan?kind=' + kind, { method: 'POST' })
    .then((res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const pump = () => reader.read().then((chunk) => {
        if (chunk.done) return undefined;
        buffer += decoder.decode(chunk.value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.replace(/^data: /, '');
          if (!line) continue;
          let event;
          try { event = JSON.parse(line); } catch (err) { continue; }
          add(event.text + '\n', event.kind === 'error' ? 'err' : event.kind === 'done' ? 'ok' : '');
          if (event.kind === 'done') {
            // cm:why Links instead of telling you to reload when the scan was for ANOTHER project:
            // this page still shows a map the scan did not touch, so a reload would look like a no-op.
            if (target === HERE) add('Tải lại trang để xem bản đồ mới.\n', 'ok');
            else {
              add('Xong. ', 'ok');
              const link = document.createElement('a');
              link.href = '/p/' + target;
              link.className = 'ok';
              link.textContent = 'mở ' + target + ' →';
              box.appendChild(link);
              // cm:why Offers the reload as a LINK instead of doing it: the list on this page is now
              // stale, but reloading by itself would wipe the log that just explained what happened.
              if (HERE === null) {
                add('   ');
                const again = document.createElement('a');
                again.href = location.pathname;
                again.className = 'ok';
                again.textContent = 'tải lại danh sách →';
                box.appendChild(again);
              }
              add('\n');
              box.scrollTop = box.scrollHeight;
            }
          }
          if (event.kind !== 'log') release();
        }
        return pump();
      });
      return pump();
    })
    .catch((err) => { add('không gọi được scan: ' + err.message + '\n', 'err'); release(); });
}

if ($id('scan-fe')) $id('scan-fe').onclick = () => streamScan('fe');
if ($id('scan-be')) $id('scan-be').onclick = () => streamScan('be');

// cm:why Delegated, not bound per card: the hub redraws its list on reload and a per-button listener
// would have to be re-attached; one listener on the document survives every redraw.
document.addEventListener('click', (ev) => {
  const scan = ev.target.closest && ev.target.closest('[data-scan]');
  if (scan) { streamScan(scan.dataset.scan, scan.dataset.id); return; }

  const edit = ev.target.closest && ev.target.closest('[data-edit]');
  if (edit) {
    openEdit({
      id: edit.dataset.edit, name: edit.dataset.name,
      fe: edit.dataset.fe, be: edit.dataset.be, hints: edit.dataset.hints,
    });
    return;
  }

  const rm = ev.target.closest && ev.target.closest('[data-rm]');
  if (!rm) return;
  const id = rm.dataset.rm;
  // cm:guard Says what is NOT deleted before asking: the maps stay on disk, so this is undoable by
  // adding the project again — a confirm that implies data loss would be a lie in the other direction.
  const sure = window.confirm('Bỏ ' + (rm.dataset.name || id) + ' khỏi workspace?\n\n'
    + 'Chỉ xoá khai báo trong ~/.apiflow/workspace.json. Map đã scan vẫn còn trên đĩa, '
    + 'và repo được đọc không bị chạm tới.');
  if (!sure) return;
  rm.disabled = true;
  fetch('/api/projects/' + id, { method: 'DELETE' })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then((result) => {
      if (!result.ok) {
        rm.disabled = false;
        window.alert(result.data.message || 'không bỏ được');
        return;
      }
      const card = rm.closest('.card');
      if (card) card.remove();
    })
    .catch((err) => { rm.disabled = false; window.alert('không gọi được server: ' + err.message); });
});

const addDlg = $id('add-dlg');
if (addDlg) {
  const msg = $id('add-msg');
  const form = $id('add-form');
  const say = (text, cls) => { msg.className = 'dmsg ' + (cls || ''); msg.textContent = text; };

  let editing = null;

  // cm:why One dialog for both jobs: the fields are identical, and a second copy of a five-field form
  // is a second place for the FE/BE validation wording to drift.
  const open = (entry) => {
    editing = entry || null;
    for (const field of ['name', 'fe', 'be', 'id', 'hints']) form.elements[field].value = '';
    $id('add-title').textContent = editing ? 'Sửa gốc — ' + editing.id : 'Thêm project';
    $id('add-idrow').style.display = editing ? 'none' : '';
    // cm:guard Says the id cannot change and WHY: the id is the directory the maps live in, so
    // renaming it here would leave every scanned map behind under a name nothing points at.
    $id('add-sub').textContent = editing
      ? 'id giữ nguyên (' + editing.id + ') vì map đã scan nằm trong thư mục mang tên đó. Bỏ trống một ô thư mục là xoá phía đó.'
      : 'apiflow chỉ ghi vào ~/.apiflow — không bao giờ viết gì vào repo được đọc.';
    $id('add-save').textContent = editing ? 'Lưu' : 'Thêm';
    if (editing) {
      form.elements.name.value = editing.name || '';
      form.elements.fe.value = editing.fe || '';
      form.elements.be.value = editing.be || '';
      form.elements.hints.value = editing.hints || '';
    }
    say('');
    addDlg.showModal();
  };
  if ($id('add-open')) $id('add-open').onclick = () => open(null);
  if ($id('add-open-2')) $id('add-open-2').onclick = () => open(null);
  openEdit = open;
  $id('add-cancel').onclick = () => addDlg.close();

  // cm:guard Shows the server's own message verbatim and never invents one: the refusals that matter
  // are "không phải một thư mục đang tồn tại" and "project đã tồn tại", and a generic
  // "thêm thất bại" would send the reader looking in the wrong place.
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const body = {};
    for (const field of ['name', 'fe', 'be', 'id', 'hints']) {
      const value = form.elements[field].value.trim();
      if (value !== '') body[field] = value;
    }
    // cm:guard On edit, sends every root field even when empty — the server reads an empty string as
    // "clear this side", and omitting it would make clearing a BE root impossible from this form.
    if (editing) for (const field of ['fe', 'be', 'hints']) body[field] = form.elements[field].value.trim();

    say(editing ? 'đang lưu…' : 'đang thêm…');
    $id('add-save').disabled = true;
    fetch(editing ? '/api/projects/' + editing.id : '/api/projects', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then((result) => {
        $id('add-save').disabled = false;
        if (!result.ok) { say(result.data.message || 'không lưu được', 'bad'); return; }
        const entry = result.data.project;
        addDlg.close();
        say('');
        // cm:why Scans right away instead of linking to the new project: /p/<id> has no map yet and
        // would answer with a bare "chưa có map nào", which reads as a failed add. On an edit the map
        // that exists was scanned from the OLD directory, so the same scan is what makes it true again.
        streamScan(entry.fe ? 'fe' : 'be', entry.id);
      })
      .catch((err) => {
        $id('add-save').disabled = false;
        say('không gọi được server: ' + err.message, 'bad');
      });
  };
}
`;
