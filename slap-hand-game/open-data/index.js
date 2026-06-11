const DEFAULT_RANK_KEY = "slap_best_time_seconds";

let canvasWidth = 640;
let canvasHeight = 760;
let sharedRankCanvas = null;
let rankCtx = null;
let cachedEntries = [];

function getCanvasContext() {
  if (!sharedRankCanvas) {
    sharedRankCanvas = wx.getSharedCanvas ? wx.getSharedCanvas() : sharedCanvas;
  }
  sharedRankCanvas.width = canvasWidth;
  sharedRankCanvas.height = canvasHeight;
  rankCtx = sharedRankCanvas.getContext("2d");
  return rankCtx;
}

function clearCanvas() {
  const ctx = getCanvasContext();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}

function drawPanelBase(title, subtitle) {
  const ctx = getCanvasContext();
  const centerX = canvasWidth / 2;
  const borderInset = 18;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.save();
  ctx.fillStyle = "rgba(17,24,39,0.88)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.strokeStyle = "rgba(250,204,21,0.95)";
  ctx.lineWidth = 8;
  ctx.strokeRect(borderInset, borderInset, canvasWidth - borderInset * 2, canvasHeight - borderInset * 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 42px sans-serif";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = "#facc15";
  ctx.strokeText(title, centerX, 64);
  ctx.fillText(title, centerX, 64);

  if (subtitle) {
    ctx.font = "700 22px sans-serif";
    ctx.lineWidth = 4;
    ctx.fillStyle = "#ffffff";
    ctx.strokeText(subtitle, centerX, 112);
    ctx.fillText(subtitle, centerX, 112);
  }
  ctx.restore();
}

function getScore(player, key) {
  const list = player.KVDataList || [];
  const scoreData = list.find((item) => item.key === key);
  if (!scoreData) return null;
  const seconds = Number(scoreData.value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

function drawAvatar(url, x, y, size, fallbackText) {
  const ctx = getCanvasContext();
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.font = "900 24px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((fallbackText || "?").slice(0, 1), x + size / 2, y + size / 2);
  ctx.restore();

  if (!url || !wx.createImage) return;
  const image = wx.createImage();
  image.onload = function () {
    const ctx = getCanvasContext();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, x, y, size, size);
    ctx.restore();
  };
  image.src = url;
}

function renderLoading() {
  drawPanelBase("好友排行", "正在读取微信好友成绩...");
}

function renderError(text) {
  drawPanelBase("好友排行", text || "好友排行榜暂不可用");
}

function toRankEntry(player, key, isSelf) {
  const seconds = getScore(player, key);
  if (seconds === null) return null;
  return {
    nickname: isSelf ? "我" : (player.nickname || "微信好友"),
    avatarUrl: player.avatarUrl || "",
    seconds,
    isSelf
  };
}

function makeSelfPlayer(seconds, key) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    nickname: "我",
    avatarUrl: "",
    KVDataList: [{ key, value: String(value) }],
    isSelf: true
  };
}

function renderRank(players, key, selfPlayer) {
  const entries = []
    .concat(selfPlayer ? [selfPlayer] : [])
    .concat(players || [])
    .map((player) => ({
      nickname: player.isSelf ? "我" : (player.nickname || "微信好友"),
      avatarUrl: player.avatarUrl || "",
      seconds: getScore(player, key),
      isSelf: !!player.isSelf
    }))
    .filter((player) => player.seconds !== null)
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, 10);

  drawPanelBase("好友排行", "通关越快排名越靠前");
  const ctx = getCanvasContext();
  const displayEntries = (entries.length > 0 ? entries : cachedEntries)
    .slice()
    .sort((a, b) => a.seconds - b.seconds);
  if (entries.length > 0) {
    cachedEntries = displayEntries;
  }

  if (displayEntries.length === 0) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 28px sans-serif";
    ctx.fillText("暂无好友成绩", canvasWidth / 2, canvasHeight / 2 - 16);
    ctx.font = "600 20px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText("先通关一次，再邀请好友来比速度", canvasWidth / 2, canvasHeight / 2 + 28);
    ctx.restore();
    return;
  }

  const rowTop = 148;
  const rowH = 66;
  displayEntries.forEach((entry, index) => {
    const y = rowTop + index * rowH;
    ctx.save();
    ctx.fillStyle = entry.isSelf
      ? "rgba(250,204,21,0.18)"
      : (index % 2 === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)");
    ctx.fillRect(28, y - 5, canvasWidth - 56, rowH - 10);

    ctx.fillStyle = index < 3 ? "#facc15" : "rgba(255,255,255,0.92)";
    ctx.strokeStyle = index < 3 ? "#111111" : "rgba(250,204,21,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(60, y + 22, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = "900 22px sans-serif";
    ctx.fillStyle = index < 3 ? "#111111" : "#111827";
    ctx.fillText(String(index + 1), 60, y + 23);
    ctx.restore();

    drawAvatar(entry.avatarUrl, 86, y, 44, entry.nickname);

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "800 24px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(entry.nickname, 144, y + 22, 220);

    ctx.textAlign = "right";
    ctx.font = "900 25px sans-serif";
    ctx.fillStyle = "#f97316";
    ctx.fillText(`${entry.seconds}秒`, canvasWidth - 48, y + 22);
    ctx.restore();
  });
}

function loadAndRenderRank(key, fallbackSelfSeconds) {
  let friendDone = false;
  let selfDone = false;
  let friends = [];
  let selfPlayer = makeSelfPlayer(fallbackSelfSeconds, key);

  function tryRender() {
    if (!friendDone || !selfDone) return;
    renderRank(friends, key, selfPlayer);
  }

  wx.getFriendCloudStorage({
    keyList: [key],
    success(res) {
      friends = res.data || [];
      friendDone = true;
      tryRender();
    },
    fail() {
      friends = [];
      friendDone = true;
      tryRender();
    }
  });

  if (!wx.getUserCloudStorage) {
    selfDone = true;
    tryRender();
    return;
  }

  wx.getUserCloudStorage({
    keyList: [key],
    success(res) {
      const player = {
        nickname: "我",
        avatarUrl: "",
        KVDataList: res.KVDataList || [],
        isSelf: true
      };
      selfPlayer = toRankEntry(player, key, true) ? player : selfPlayer;
      selfDone = true;
      tryRender();
    },
    fail() {
      selfPlayer = null;
      selfDone = true;
      tryRender();
    }
  });
}

wx.onMessage(function (message) {
  const data = message || {};
  canvasWidth = data.width || canvasWidth;
  canvasHeight = data.height || canvasHeight;

  if (data.type === "hideFriendRank") {
    clearCanvas();
    return;
  }

  if (data.type !== "showFriendRank") return;

  const key = data.key || DEFAULT_RANK_KEY;
  renderLoading();
  loadAndRenderRank(key, data.selfSeconds);
});
