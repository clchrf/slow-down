(() => {
  const fields = ['journaltext', 'comfort', 'person'];

  function showStatus(message, success = false) {
    const status = document.querySelector('#backup-status');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('backup-success');
    if (success) {
      void status.offsetWidth;
      status.classList.add('backup-success');
    }
  }

  function exportNotes() {
    const notes = Object.fromEntries(fields.map(key => [key, document.getElementById(key).value]));
    const backup = { app: 'slow-down', version: 1, exportedAt: new Date().toISOString(), notes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `slow-down-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    showStatus('已下載筆記與備忘的備份檔。影片不包含在內。', true);
  }

  async function importNotes(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showStatus('檔案太大，請選擇筆記與備忘的備份檔。');
      return;
    }
    let notes;
    try {
      const data = JSON.parse(await file.text());
      notes = data.notes;
      if (data.app !== 'slow-down' || data.version !== 1 || !notes ||
          fields.some(key => typeof notes[key] !== 'string')) throw new Error('Invalid backup');
    } catch {
      showStatus('無法讀取這個檔案，請選擇從本站匯出的備份檔。');
      return;
    }
    if (!confirm('匯入會取代目前的筆記與備忘。確定繼續嗎？')) return;

    try {
      const previous = Object.fromEntries(fields.map(key => [key, localStorage.getItem(key)]));
      try {
        fields.forEach(key => localStorage.setItem(key, notes[key]));
      } catch (error) {
        fields.forEach(key => {
          if (previous[key] === null) localStorage.removeItem(key);
          else localStorage.setItem(key, previous[key]);
        });
        throw error;
      }
      fields.forEach(key => { document.getElementById(key).value = notes[key]; });
      showStatus('已匯入筆記與備忘。', true);
      document.querySelector('#saved').textContent = '已從備份檔還原。';
      document.querySelector('#boxstatus').textContent = '已從備份檔還原。';
    } catch {
      showStatus('無法儲存匯入內容，原本的筆記與備忘已盡量保留。');
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#backup-export')) exportNotes();
    if (event.target.closest('#backup-import')) document.querySelector('#backup-file')?.click();
  });
  document.addEventListener('change', event => {
    if (event.target.id !== 'backup-file') return;
    const file = event.target.files[0];
    event.target.value = '';
    importNotes(file);
  });
})();
