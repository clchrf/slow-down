// Videos stay in this browser. IndexedDB stores the file; object URLs are temporary playback handles.
const videoInput = document.querySelector('#videofiles');
const videoStatus = document.querySelector('#videostatus');
const videoItems = [];
const videoDb = new Promise((resolve, reject) => {
  if (!window.indexedDB) {
    reject(new Error('IndexedDB unavailable'));
    return;
  }
  const request = indexedDB.open('slow-down-videos', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('videos', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('IndexedDB blocked'));
});

async function storedVideos() {
  const db = await videoDb;
  return new Promise((resolve, reject) => {
    const request = db.transaction('videos', 'readonly').objectStore('videos').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.addedAt - b.addedAt));
    request.onerror = () => reject(request.error);
  });
}

async function writeVideo(record) {
  const db = await videoDb;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function eraseVideo(id) {
  const db = await videoDb;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function renderVideos(message) {
  const list = document.querySelector('#videolist');
  list.replaceChildren();
  videoItems.forEach((item, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'video-item';
    const card = document.createElement('button');
    card.className = 'video-card';
    card.setAttribute('aria-label', '放大觀看 ' + item.name);
    const preview = document.createElement('video');
    preview.src = item.url;
    preview.muted = true;
    preview.playsInline = true;
    preview.preload = 'metadata';
    preview.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.textContent = item.name;
    const hint = document.createElement('small');
    hint.textContent = '點開觀看';
    card.append(preview, title, hint);
    card.onclick = () => openVideo(index);
    const remove = document.createElement('button');
    remove.className = 'video-remove';
    remove.type = 'button';
    remove.setAttribute('aria-label', '移除影片 ' + item.name);
    remove.title = '移除影片';
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    remove.onclick = () => removeVideo(item);
    wrapper.append(card, remove);
    list.append(wrapper);
  });
  videoStatus.textContent = message || (videoItems.length
    ? '共 ' + videoItems.length + ' 段 · 已存於這個瀏覽器。左右滑動，點開播放。'
    : '影片儲存在這個瀏覽器，不會上傳。');
}

async function removeVideo(item) {
  if (!confirm('要從這個瀏覽器移除「' + item.name + '」嗎？')) return;
  try {
    if (item.saved) await eraseVideo(item.id);
    const player = document.querySelector('#fullvideo');
    if (player && player.src === item.url) document.querySelector('#modal').close();
    URL.revokeObjectURL(item.url);
    videoItems.splice(videoItems.indexOf(item), 1);
    renderVideos();
  } catch {
    videoStatus.textContent = '無法移除影片，請稍後再試。';
  }
}

videoInput.onchange = async event => {
  let failed = 0;
  for (const file of event.target.files) {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random();
    let saved = false;
    try {
      await writeVideo({ id, name: file.name, file, addedAt: Date.now() });
      saved = true;
    } catch {
      failed++;
    }
    videoItems.push({ id, name: file.name, url: URL.createObjectURL(file), saved });
  }
  renderVideos(failed ? '部分影片未能儲存，可能是瀏覽器空間不足；這些影片僅本次有效。' : undefined);
  event.target.value = '';
};

async function loadStoredVideos() {
  try {
    for (const record of await storedVideos()) {
      if (!videoItems.some(item => item.id === record.id)) {
        videoItems.push({ id: record.id, name: record.name, url: URL.createObjectURL(record.file), saved: true });
      }
    }
    renderVideos();
  } catch {
    renderVideos('這個瀏覽器無法讀取已存影片；新加入的影片僅本次有效。');
  }
}

function openVideo(index) {
  stop();
  const modal = document.querySelector('#modal');
  if (!modal.open) modal.showModal();
  view('影片收藏', '<video id="fullvideo" controls loop muted playsinline style="width:100%;max-height:65vh;background:#111;border-radius:12px"></video><button class="primary" id="fullscreenvideo" style="margin-top:16px">全螢幕觀看</button><p class="notice">預設靜音。可使用播放器開聲音，或將手機轉成橫向。</p>');
  const player = document.querySelector('#fullvideo');
  player.src = videoItems[index].url;
  player.onerror = () => {
    document.querySelector('#body .notice').textContent = '此裝置無法播放這個格式，可以試試 MP4（H.264）版本。';
  };
  document.querySelector('#fullscreenvideo').onclick = async () => {
    try {
      if (player.webkitEnterFullscreen) player.webkitEnterFullscreen();
      else if (player.requestFullscreen) await player.requestFullscreen();
      else document.querySelector('#body .notice').textContent = '請使用播放器內的全螢幕按鈕。';
    } catch {
      document.querySelector('#body .notice').textContent = '請先按播放，再使用播放器內的全螢幕按鈕。';
    }
  };
}

document.querySelector('#modal').addEventListener('close', () => {
  const player = document.querySelector('#fullvideo');
  if (player) {
    player.pause();
    player.removeAttribute('src');
    player.load();
  }
});
window.addEventListener('pagehide', () => videoItems.forEach(item => URL.revokeObjectURL(item.url)));
loadStoredVideos();
