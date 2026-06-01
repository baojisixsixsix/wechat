const canvas = wx.createCanvas();
const ctx = canvas.getContext("2d");

const ASSETS = {
  faceNormal: "assets/cutout/face-normal.png",
  faceLeft: "assets/cutout/face-hit-left.png",
  faceRight: "assets/cutout/face-hit-right.png",
  facePowerLeft: "assets/cutout/face-power-left.png",
  facePowerRight: "assets/cutout/face-power-right.png",
  faceGameOver: "assets/cutout/face-game-over-beg.png",
  handPalm: "assets/cutout/hand-palm-wind.png",
  handBack: "assets/cutout/hand-back-wind.png",
  keyLeft: "assets/cutout/key-left.png",
  keyRight: "assets/cutout/key-right.png"
};

const images = {};
const audio = {
  palm: null,
  back: null,
  bgm: null,
  bgmStarted: false
};

const state = {
  screen: "login",
  width: 0,
  height: 0,
  pixelRatio: 1,
  safeTop: 0,
  loaded: 0,
  total: Object.keys(ASSETS).length,
  face: "faceNormal",
  action: null,
  actionStart: 0,
  leftCount: 0,
  rightCount: 0,
  energyScore: 0,
  lastEnergyDirection: null,
  lastEnergyGain: 0,
  lastEnergyGainAt: 0,
  fullEnergyAt: 0,
  chargedStrike: null,
  powerHitUntil: 0,
  powerHitAt: 0,
  powerHitDirection: null,
  energyClearCount: 0,
  gameStartedAt: 0,
  gameEnded: false,
  gameEndedAt: 0,
  finalSeconds: 0,
  paused: false,
  pausedAt: 0,
  message: "",
  loginButtons: {},
  loginNotice: "",
  loginNoticeAt: 0,
  restartButton: null,
  pauseButton: null,
  returnButton: null,
  resumeButton: null,
  leftButton: null,
  rightButton: null,
  pendingMessageAfterAction: null
};

const ACTION_DURATION = 760;
const ENERGY_MAX = 333;
const HAND_GROW_HITS = 33;
const HAND_GROW_RATE = 0.1;
const CHARGED_WAIT_DURATION = 2000;
const CHARGED_WINDUP_DURATION = 1000;
const POWER_FACE_DURATION = 2200;
const GAME_OVER_ENERGY_CLEARS = 3;
const IDLE_TAUNTS = [
  "就这？",
  "啊？你说啥？",
  "没吃饭？",
  "再用点劲",
  "多喝热水呗？",
  "笑死我了",
  "你行不行",
  "继续啊"
];

function getTotalHits() {
  return state.leftCount + state.rightCount;
}

function getIdleMessage() {
  return IDLE_TAUNTS[Math.floor(Math.random() * IDLE_TAUNTS.length)];
}

function getEnergyGain(direction) {
  return state.lastEnergyDirection && state.lastEnergyDirection !== direction ? 3 : 1;
}

function addEnergy(direction) {
  if (state.gameEnded || state.chargedStrike || state.powerHitUntil > Date.now()) {
    return 0;
  }

  const gain = getEnergyGain(direction);
  const wasFull = state.energyScore >= ENERGY_MAX;
  state.energyScore = Math.min(state.energyScore + gain, ENERGY_MAX);
  state.lastEnergyDirection = direction;
  state.lastEnergyGain = gain;
  state.lastEnergyGainAt = Date.now();
  if (!wasFull && state.energyScore >= ENERGY_MAX) {
    state.fullEnergyAt = Date.now();
  }
  return gain;
}

function resetEnergy() {
  state.energyScore = 0;
  state.fullEnergyAt = 0;
  state.lastEnergyDirection = null;
  state.lastEnergyGain = 0;
}

function resetSinglePlayerGame() {
  state.face = "faceNormal";
  state.action = null;
  state.actionStart = 0;
  state.leftCount = 0;
  state.rightCount = 0;
  state.chargedStrike = null;
  state.powerHitUntil = 0;
  state.powerHitAt = 0;
  state.powerHitDirection = null;
  state.energyClearCount = 0;
  state.gameStartedAt = 0;
  state.gameEnded = false;
  state.gameEndedAt = 0;
  state.finalSeconds = 0;
  state.paused = false;
  state.pausedAt = 0;
  state.restartButton = null;
  state.pauseButton = null;
  state.returnButton = null;
  state.resumeButton = null;
  state.pendingMessageAfterAction = null;
  state.message = getIdleMessage();
  resetEnergy();
}

function returnToLogin() {
  state.screen = "login";
  state.paused = false;
  state.pausedAt = 0;
  state.action = null;
  state.chargedStrike = null;
  state.powerHitUntil = 0;
  state.powerHitAt = 0;
  state.powerHitDirection = null;
  state.face = "faceNormal";
}

function pauseGame(now) {
  if (state.gameEnded || state.paused) {
    return;
  }

  state.paused = true;
  state.pausedAt = now;
}

function resumeGame(now) {
  if (!state.paused) {
    return;
  }

  const pausedDuration = now - state.pausedAt;
  if (state.gameStartedAt > 0) {
    state.gameStartedAt += pausedDuration;
  }
  if (state.fullEnergyAt > 0) {
    state.fullEnergyAt += pausedDuration;
  }
  if (state.actionStart > 0) {
    state.actionStart += pausedDuration;
  }
  if (state.lastEnergyGainAt > 0) {
    state.lastEnergyGainAt += pausedDuration;
  }
  if (state.powerHitAt > 0) {
    state.powerHitAt += pausedDuration;
  }
  if (state.powerHitUntil > 0) {
    state.powerHitUntil += pausedDuration;
  }
  if (state.chargedStrike) {
    state.chargedStrike.startAt += pausedDuration;
  }
  state.paused = false;
  state.pausedAt = 0;
}

function markGameStarted(now) {
  if (state.gameStartedAt <= 0) {
    state.gameStartedAt = now;
  }
}

function endGame(now) {
  state.gameEnded = true;
  state.gameEndedAt = now;
  state.finalSeconds = Math.max(0, Math.ceil((now - state.gameStartedAt) / 1000));
  state.face = "faceGameOver";
  state.action = null;
  state.chargedStrike = null;
  state.powerHitUntil = 0;
  state.powerHitAt = 0;
  state.powerHitDirection = null;
  state.message = "别打了，别打了";
}

function getHandScale(direction) {
  const count = direction === "left" ? state.leftCount : state.rightCount;
  return 1 + Math.floor(count / HAND_GROW_HITS) * HAND_GROW_RATE;
}

function getLargestHandDirection() {
  const leftScale = getHandScale("left");
  const rightScale = getHandScale("right");
  if (leftScale > rightScale) {
    return "left";
  }
  if (rightScale > leftScale) {
    return "right";
  }
  return state.lastEnergyDirection || "left";
}

function startChargedStrike(now) {
  state.chargedStrike = {
    direction: getLargestHandDirection(),
    startAt: now,
    impacted: false
  };
  state.action = null;
  state.pendingMessageAfterAction = null;
  state.message = "蓄力中...";
}

function triggerChargedImpact(now) {
  const strike = state.chargedStrike;
  if (!strike || strike.impacted) {
    return;
  }

  strike.impacted = true;
  state.powerHitAt = now;
  state.powerHitUntil = now + POWER_FACE_DURATION;
  state.powerHitDirection = strike.direction;
  state.face = strike.direction === "left" ? "facePowerLeft" : "facePowerRight";
  state.message = "这一巴掌够狠！";
  resetEnergy();
  state.energyClearCount += 1;
  playSlapSound(strike.direction);
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: "heavy" });
  }
  if (state.energyClearCount >= GAME_OVER_ENERGY_CLEARS) {
    endGame(now);
    return;
  }
}

function updateChargedStrike(now) {
  if (state.gameEnded) {
    return;
  }

  if (!state.chargedStrike && state.energyScore >= ENERGY_MAX && state.fullEnergyAt > 0) {
    if (now - state.fullEnergyAt >= CHARGED_WAIT_DURATION) {
      startChargedStrike(now);
    }
  }

  if (state.chargedStrike) {
    const elapsed = now - state.chargedStrike.startAt;
    if (elapsed >= CHARGED_WINDUP_DURATION) {
      triggerChargedImpact(now);
    }
    if (elapsed >= CHARGED_WINDUP_DURATION + 340) {
      state.chargedStrike = null;
    }
  }

  if (!state.chargedStrike && state.powerHitUntil > 0 && now >= state.powerHitUntil) {
    state.face = "faceNormal";
    state.powerHitUntil = 0;
    state.powerHitAt = 0;
    state.powerHitDirection = null;
    state.message = getIdleMessage();
  }
}

function getWindowSize() {
  if (wx.getWindowInfo) {
    const info = wx.getWindowInfo();
    return {
      width: info.windowWidth,
      height: info.windowHeight,
      pixelRatio: info.pixelRatio || 1,
      safeTop: info.safeArea ? info.safeArea.top : 0
    };
  }

  const info = wx.getSystemInfoSync();
  return {
    width: info.windowWidth,
    height: info.windowHeight,
    pixelRatio: info.pixelRatio || 1,
    safeTop: info.safeArea ? info.safeArea.top : 0
  };
}

function resizeCanvas() {
  const size = getWindowSize();
  state.width = size.width;
  state.height = size.height;
  state.pixelRatio = size.pixelRatio;
  state.safeTop = size.safeTop || 0;
  canvas.width = Math.floor(size.width * size.pixelRatio);
  canvas.height = Math.floor(size.height * size.pixelRatio);
  ctx.setTransform(state.pixelRatio, 0, 0, state.pixelRatio, 0, 0);
}

function loadImages() {
  Object.keys(ASSETS).forEach((key) => {
    const image = wx.createImage();
    image.onload = () => {
      state.loaded += 1;
    };
    image.src = ASSETS[key];
    images[key] = image;
  });
}

function initAudio() {
  if (!wx.createInnerAudioContext) {
    return;
  }

  audio.palm = wx.createInnerAudioContext();
  audio.palm.src = "assets/audio/slap-palm.wav";
  audio.palm.volume = 0.92;
  audio.palm.obeyMuteSwitch = false;

  audio.back = wx.createInnerAudioContext();
  audio.back.src = "assets/audio/slap-back.wav";
  audio.back.volume = 0.95;
  audio.back.obeyMuteSwitch = false;

  audio.bgm = wx.createInnerAudioContext();
  audio.bgm.src = "assets/audio/bgm-slap-game-loop-30s.wav";
  audio.bgm.loop = true;
  audio.bgm.volume = 0.42;
  audio.bgm.obeyMuteSwitch = false;
}

function startBgm() {
  if (!audio.bgm || audio.bgmStarted) {
    return;
  }

  audio.bgmStarted = true;
  audio.bgm.play();
}

function pauseBgm() {
  if (audio.bgm && audio.bgmStarted) {
    audio.bgm.pause();
  }
}

function resumeBgm() {
  if (audio.bgm && audio.bgmStarted) {
    audio.bgm.play();
  }
}

function playSlapSound(direction) {
  const sound = direction === "left" ? audio.palm : audio.back;
  if (!sound) {
    return;
  }

  sound.stop();
  sound.play();
}

function vibrateOnSlap() {
  if (!wx.vibrateShort) {
    return;
  }

  wx.vibrateShort({ type: "light" });
}

function drawRoundRect(x, y, width, height, radius, fillStyle) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawImageCover(image, x, y, width, height) {
  if (!image || !image.width || !image.height) {
    return;
  }

  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawImageContain(image, x, y, width, height) {
  if (!image || !image.width || !image.height) {
    return;
  }

  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  if (sourceRatio > targetRatio) {
    drawHeight = width / sourceRatio;
  } else {
    drawWidth = height * sourceRatio;
  }

  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#f7fbff");
  gradient.addColorStop(1, "#edf2f7");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.beginPath();
  ctx.arc(state.width / 2, state.height * 0.25, state.width * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.fill();
}

function drawLoginComicText(text, x, y, size, fillStyle, rotate) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${size}px sans-serif`;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(7, size * 0.22);
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 5;
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = fillStyle;
  ctx.strokeText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.strokeText(text, 0, -2);
  ctx.restore();

}

function drawComicButton(label, x, y, width, height, fillStyle, rotate) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotate || 0);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 5;
  ctx.shadowColor = "rgba(15,23,42,0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  ctx.moveTo(-width / 2 + 12, -height / 2);
  ctx.lineTo(width / 2 - 8, -height / 2 + 3);
  ctx.lineTo(width / 2, height / 2 - 12);
  ctx.lineTo(-width / 2 + 8, height / 2);
  ctx.lineTo(-width / 2, -height / 2 + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 20px sans-serif";
  ctx.lineWidth = 5;
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 5;
  ctx.strokeStyle = "#111111";
  ctx.fillStyle = fillStyle;
  ctx.strokeText(label, 0, 1);
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function drawLoginEntry(key, text, x, y, rotate, fillStyle) {
  const width = Math.min(190, Math.max(128, state.width * 0.42));
  const height = 58;
  state.loginButtons[key] = {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-width / 2 + 18, -height / 2);
  ctx.lineTo(width / 2 - 12, -height / 2 + 4);
  ctx.lineTo(width / 2, height / 2 - 14);
  ctx.lineTo(-width / 2 + 8, height / 2);
  ctx.lineTo(-width / 2, -height / 2 + 12);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  drawLoginComicText(text, x, y, 28, fillStyle, rotate);
}

function drawLoginScreen(now) {
  drawImageCover(images.faceNormal, 0, 0, state.width, state.height);

  const vignette = ctx.createRadialGradient(
    state.width / 2,
    state.height * 0.46,
    state.width * 0.16,
    state.width / 2,
    state.height * 0.48,
    Math.max(state.width, state.height) * 0.72
  );
  vignette.addColorStop(0, "rgba(255,255,255,0.04)");
  vignette.addColorStop(1, "rgba(0,0,0,0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, state.width, state.height);

  const jointX = state.width / 2;
  const jointY = state.height * 0.5;
  const topX = state.width / 2;
  const topY = Math.max(26, state.safeTop + 8);
  const leftX = -state.width * 0.08;
  const rightX = state.width * 1.08;
  const bottomY = state.height + 30;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.96)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(jointX, jointY);
  ctx.lineTo(leftX, bottomY);
  ctx.moveTo(jointX, jointY);
  ctx.lineTo(rightX, bottomY);
  ctx.stroke();

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(jointX, jointY);
  ctx.lineTo(leftX, bottomY);
  ctx.moveTo(jointX, jointY);
  ctx.lineTo(rightX, bottomY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(250,204,21,0.9)";
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 14]);
  ctx.lineDashOffset = -(now * 0.06) % 32;
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.lineTo(jointX, jointY);
  ctx.lineTo(leftX, bottomY);
  ctx.moveTo(jointX, jointY);
  ctx.lineTo(rightX, bottomY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(topX, topY);
  ctx.lineTo(jointX, jointY);
  ctx.lineTo(0, state.height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.moveTo(state.width, 0);
  ctx.lineTo(topX, topY);
  ctx.lineTo(jointX, jointY);
  ctx.lineTo(state.width, state.height);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(0, state.height);
  ctx.lineTo(jointX, jointY);
  ctx.lineTo(state.width, state.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  state.loginButtons = {};
  drawLoginEntry("duel", "双人对线", state.width * 0.28, state.height * 0.48, -0.18, "#60a5fa");
  drawLoginEntry("fight", "双人格斗", state.width * 0.72, state.height * 0.48, 0.18, "#fb7185");
  drawLoginEntry("single", "3巴掌", state.width / 2, state.height * 0.8, -0.04, "#facc15");

  if (state.loginNotice && now - state.loginNoticeAt < 980) {
    const age = now - state.loginNoticeAt;
    ctx.save();
    ctx.globalAlpha = 1 - age / 980;
    drawLoginComicText(state.loginNotice, state.width / 2, state.height * 0.62 - age * 0.03, 24, "#ffffff", 0);
    ctx.restore();
  }
}

function drawEnergyBar(now) {
  const top = Math.max(54, state.safeTop + 12);
  const barW = Math.min(326, state.width - 34);
  const barH = 34;
  const centerX = state.width / 2;
  const centerY = top + barH / 2;
  const fillRatio = Math.min(state.energyScore / ENERGY_MAX, 1);
  const isFull = state.energyScore >= ENERGY_MAX;
  const x = centerX - barW / 2;
  const y = centerY - barH / 2;
  const fillW = Math.max(0, barW * fillRatio);

  ctx.save();
  if (fillW <= 0) {
    ctx.restore();
    return;
  }

  ctx.shadowColor = isFull
    ? "rgba(250,204,21,0.64)"
    : `rgba(234,179,8,${0.28 + fillRatio * 0.2})`;
  ctx.shadowBlur = isFull ? 24 : 12 + fillRatio * 12;
  ctx.shadowOffsetY = 5;

  const bodyGradient = ctx.createLinearGradient(x, y, x, y + barH);
  bodyGradient.addColorStop(0, "#fff7ad");
  bodyGradient.addColorStop(0.16, "#fde047");
  bodyGradient.addColorStop(0.42, "#facc15");
  bodyGradient.addColorStop(0.68, "#eab308");
  bodyGradient.addColorStop(0.88, "#ca8a04");
  bodyGradient.addColorStop(1, "#854d0e");
  drawRoundRect(x, y, fillW, barH, 17, bodyGradient);
  ctx.shadowColor = "transparent";

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, fillW, barH);
  ctx.clip();

  const shineGradient = ctx.createLinearGradient(x, y, x, y + barH);
  shineGradient.addColorStop(0, "rgba(255,255,255,0.9)");
  shineGradient.addColorStop(0.4, "rgba(255,251,235,0.42)");
  shineGradient.addColorStop(0.44, "rgba(255,251,235,0)");
  shineGradient.addColorStop(1, "rgba(255,251,235,0)");
  drawRoundRect(x + 3, y + 3, Math.max(0, fillW - 6), Math.max(8, barH * 0.34), 8, shineGradient);

  ctx.globalAlpha = isFull ? 0.9 : 0.46 + fillRatio * 0.34;
  ctx.strokeStyle = isFull ? "rgba(255,255,255,0.78)" : "rgba(255,251,235,0.62)";
  ctx.lineWidth = 4;
  const stripeOffset = (now * (0.18 + fillRatio * 0.16)) % 26;
  for (let stripeX = x - barH + stripeOffset; stripeX < x + barW + barH; stripeX += 26) {
    ctx.beginPath();
    ctx.moveTo(stripeX, y + barH);
    ctx.lineTo(stripeX + barH, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.42 + fillRatio * 0.28 + Math.sin(now * 0.012) * 0.1;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (let i = 0; i < 4; i += 1) {
    const sparkleX = x + 22 + ((now * 0.035 + i * 73) % Math.max(1, barW - 44));
    const sparkleY = y + 10 + (i % 2) * 12;
    ctx.beginPath();
    ctx.arc(sparkleX, sparkleY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = isFull ? "rgba(254,240,138,0.96)" : "rgba(254,249,195,0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 2);
  ctx.lineTo(x + Math.max(12, fillW - 12), y + 2);
  ctx.stroke();
  ctx.restore();

  if (state.lastEnergyGain > 0) {
    const age = now - state.lastEnergyGainAt;
    if (age < 760) {
      const progress = age / 760;
      const popY = centerY - 1 - progress * 24;
      const scale = 1.08 + Math.sin(progress * Math.PI) * 0.46;

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.translate(centerX, popY);
      ctx.scale(scale, scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 24px sans-serif";
      ctx.lineWidth = 5;
      ctx.strokeStyle = state.lastEnergyGain >= 3 ? "rgba(127,29,29,0.82)" : "rgba(120,53,15,0.78)";
      ctx.fillStyle = state.lastEnergyGain >= 3 ? "#ffedd5" : "#fffbeb";
      ctx.strokeText(`+${state.lastEnergyGain}`, 0, 0);
      ctx.fillText(`+${state.lastEnergyGain}`, 0, 0);
      ctx.restore();
    }
  }
}

function getActionProgress(now) {
  if (!state.action) {
    return 1;
  }
  return Math.min(Math.max((now - state.actionStart) / ACTION_DURATION, 0), 1);
}

function drawFace(now) {
  const side = Math.min(state.width * 0.88, state.height * 0.52, 360);
  const x = (state.width - side) / 2;
  const y = Math.max(84, state.height * 0.12);
  const progress = getActionProgress(now);
  const push = state.action === "left" ? 1 : state.action === "right" ? -1 : 0;
  const hitPulse = progress > 0.16 && progress < 0.46 ? 1 : 0;
  const powerAge = state.powerHitAt > 0 ? now - state.powerHitAt : 9999;
  const powerPush = state.powerHitDirection === "left" ? 1 : state.powerHitDirection === "right" ? -1 : 0;
  const powerShake = powerAge < 520 ? Math.sin(powerAge * 0.12) * (1 - powerAge / 520) * 34 * powerPush : 0;
  const powerRotate = powerAge < 680 ? Math.sin(powerAge * 0.07) * (1 - powerAge / 680) * 0.16 * powerPush : 0;
  const shake = (progress < 0.66 ? Math.sin(progress * Math.PI * 9) * (1 - progress) * 22 * push : 0) + powerShake;
  const rotate = (progress < 0.66 ? Math.sin(progress * Math.PI * 7) * (1 - progress) * 0.09 * push : 0) + powerRotate;
  const squashX = hitPulse ? 1.04 : 1;
  const squashY = hitPulse ? 0.97 : 1;

  ctx.save();
  ctx.translate(state.width / 2 + shake, y + side * 0.55);
  ctx.rotate(rotate);
  ctx.scale(squashX, squashY);
  ctx.shadowColor = "rgba(15,23,42,0.18)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 10;
  drawImageCover(images[state.face], -side / 2, -side * 0.55, side, side);
  ctx.restore();

  return { x, y, side };
}

function drawHand(now, faceBox) {
  if (!state.action) {
    return;
  }

  const progress = getActionProgress(now);
  if (progress >= 1) {
    state.action = null;
    state.face = "faceNormal";
    state.message = state.pendingMessageAfterAction || getIdleMessage();
    state.pendingMessageAfterAction = null;
    return;
  }

  const handImage = state.action === "left" ? images.handPalm : images.handBack;
  const handSide = faceBox.side * 0.62 * getHandScale(state.action);
  const fromLeft = state.action === "left";
  const startX = fromLeft ? -handSide : state.width;
  const hitX = fromLeft ? faceBox.x + faceBox.side * 0.06 : faceBox.x + faceBox.side * 0.54;
  const endX = fromLeft ? faceBox.x + faceBox.side * 0.48 : faceBox.x - handSide * 0.18;
  const inProgress = Math.min(progress / 0.32, 1);
  const outProgress = Math.min(Math.max((progress - 0.32) / 0.68, 0), 1);
  const easeIn = 1 - Math.pow(1 - inProgress, 3);
  const easeOut = outProgress * outProgress;
  const x = progress < 0.32 ? startX + (hitX - startX) * easeIn : hitX + (endX - hitX) * easeOut;
  const y = faceBox.y + faceBox.side * 0.35 - handSide * 0.25 - progress * 20;

  ctx.save();
  ctx.globalAlpha = progress < 0.78 ? 1 : Math.max(1 - (progress - 0.78) / 0.22, 0);
  ctx.shadowColor = "rgba(15,23,42,0.18)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 8;
  ctx.translate(x + handSide / 2, y + handSide / 2);
  ctx.rotate((fromLeft ? 1 : -1) * (0.28 - progress * 0.36));
  drawImageCover(handImage, -handSide / 2, -handSide / 2, handSide, handSide);
  ctx.restore();

  if (progress > 0.14 && progress < 0.52) {
    const impactX = fromLeft ? faceBox.x + faceBox.side * 0.25 : faceBox.x + faceBox.side * 0.66;
    const impactY = faceBox.y + faceBox.side * 0.48;
    ctx.save();
    ctx.globalAlpha = Math.max(1 - Math.abs(progress - 0.32) / 0.2, 0);
    ctx.strokeStyle = "rgba(59,130,246,0.28)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(impactX, impactY, 28 + progress * 32, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(75,85,99,0.45)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const lineY = impactY - 44 + i * 20;
      const lineStart = fromLeft ? impactX - 150 : impactX + 150;
      const lineEnd = fromLeft ? impactX - 34 : impactX + 34;
      ctx.beginPath();
      ctx.moveTo(lineStart, lineY);
      ctx.lineTo(lineEnd, lineY + (fromLeft ? 8 : -8));
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawChargedStrike(now, faceBox) {
  const strike = state.chargedStrike;
  if (!strike) {
    return;
  }

  const direction = strike.direction;
  const fromLeft = direction === "left";
  const elapsed = now - strike.startAt;
  const windupProgress = Math.min(elapsed / CHARGED_WINDUP_DURATION, 1);
  const impactProgress = Math.min(Math.max((elapsed - CHARGED_WINDUP_DURATION) / 260, 0), 1);
  const baseScale = Math.max(getHandScale(direction), 1.25);
  const handImage = fromLeft ? images.handPalm : images.handBack;
  const handSide = faceBox.side * 0.76 * baseScale * (1.08 + windupProgress * 0.18);
  const tremble = elapsed < CHARGED_WINDUP_DURATION
    ? Math.sin(now * 0.12) * (4 + windupProgress * 14)
    : Math.sin(now * 0.22) * 4 * (1 - impactProgress);
  const startX = fromLeft ? -handSide * 0.2 : state.width - handSide * 0.8;
  const pulledX = fromLeft ? faceBox.x - handSide * 0.22 : faceBox.x + faceBox.side - handSide * 0.78;
  const hitX = fromLeft ? faceBox.x + faceBox.side * 0.06 : faceBox.x + faceBox.side * 0.46;
  const x = elapsed < CHARGED_WINDUP_DURATION
    ? startX + (pulledX - startX) * windupProgress + tremble
    : pulledX + (hitX - pulledX) * (1 - Math.pow(1 - impactProgress, 4));
  const y = faceBox.y + faceBox.side * 0.22 - handSide * 0.2 + Math.sin(now * 0.1) * 5;

  ctx.save();
  ctx.globalAlpha = elapsed < CHARGED_WINDUP_DURATION ? 0.96 : Math.max(1 - impactProgress * 0.15, 0.78);
  ctx.shadowColor = "rgba(127,29,29,0.42)";
  ctx.shadowBlur = 20 + windupProgress * 24;
  ctx.shadowOffsetY = 12;
  ctx.translate(x + handSide / 2, y + handSide / 2);
  ctx.rotate((fromLeft ? 1 : -1) * (0.42 - windupProgress * 0.22 - impactProgress * 0.38));
  drawImageCover(handImage, -handSide / 2, -handSide / 2, handSide, handSide);
  ctx.restore();

  if (elapsed < CHARGED_WINDUP_DURATION) {
    ctx.save();
    ctx.globalAlpha = 0.2 + windupProgress * 0.48;
    ctx.strokeStyle = "rgba(250,204,21,0.9)";
    ctx.lineWidth = 3 + windupProgress * 3;
    const cx = fromLeft ? faceBox.x + faceBox.side * 0.12 : faceBox.x + faceBox.side * 0.88;
    const cy = faceBox.y + faceBox.side * 0.44;
    for (let i = 0; i < 9; i += 1) {
      const angle = i * Math.PI * 2 / 9 + now * 0.012;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 36, cy + Math.sin(angle) * 24);
      ctx.lineTo(cx + Math.cos(angle) * (78 + windupProgress * 28), cy + Math.sin(angle) * (54 + windupProgress * 18));
      ctx.stroke();
    }
    ctx.restore();
  }

  if (impactProgress > 0) {
    const impactX = fromLeft ? faceBox.x + faceBox.side * 0.34 : faceBox.x + faceBox.side * 0.66;
    const impactY = faceBox.y + faceBox.side * 0.45;
    ctx.save();
    ctx.globalAlpha = Math.max(1 - impactProgress, 0);
    ctx.strokeStyle = "rgba(127,29,29,0.72)";
    ctx.lineWidth = 7;
    for (let i = 0; i < 11; i += 1) {
      const lineY = impactY - 92 + i * 18;
      const lineStart = fromLeft ? impactX - 230 : impactX + 230;
      const lineEnd = fromLeft ? impactX - 22 : impactX + 22;
      ctx.beginPath();
      ctx.moveTo(lineStart, lineY);
      ctx.lineTo(lineEnd, lineY + (fromLeft ? 16 : -16));
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(impactX, impactY, 42 + impactProgress * 96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPowerImpactOverlay(now) {
  if (state.powerHitAt <= 0) {
    return;
  }

  const age = now - state.powerHitAt;
  if (age > 520) {
    return;
  }

  const progress = age / 520;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 0.62 - progress * 0.62);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = Math.max(0, 0.9 - progress);
  ctx.strokeStyle = "rgba(15,23,42,0.36)";
  ctx.lineWidth = 5;
  const cx = state.width / 2;
  const cy = state.height * 0.36;
  for (let i = 0; i < 18; i += 1) {
    const angle = i * Math.PI * 2 / 18;
    const inner = 54 + progress * 20;
    const outer = Math.max(state.width, state.height) * (0.42 + progress * 0.24);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawControls() {
  const buttonSize = Math.min(128, state.width * 0.35);
  const gap = Math.min(34, state.width * 0.08);
  const y = state.height - buttonSize - 28;
  const leftX = (state.width - buttonSize * 2 - gap) / 2;
  const rightX = leftX + buttonSize + gap;

  state.leftButton = { x: leftX, y, width: buttonSize, height: buttonSize };
  state.rightButton = { x: rightX, y, width: buttonSize, height: buttonSize };

  ctx.shadowColor = "rgba(15,23,42,0.18)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 8;
  drawImageCover(images.keyLeft, leftX, y, buttonSize, buttonSize);
  drawImageCover(images.keyRight, rightX, y, buttonSize, buttonSize);
  ctx.shadowColor = "transparent";
}

function drawGameMenuButtons() {
  const top = Math.max(96, state.safeTop + 54);
  const buttonW = Math.min(124, state.width * 0.34);
  const buttonH = 42;
  const gap = Math.min(38, state.width * 0.1);
  const leftX = state.width / 2 - gap / 2 - buttonW;
  const rightX = state.width / 2 + gap / 2;

  state.restartButton = { x: leftX, y: top, width: buttonW, height: buttonH };
  state.pauseButton = { x: rightX, y: top, width: buttonW, height: buttonH };

  drawComicButton("再来一次", leftX, top, buttonW, buttonH, "#facc15", -0.04);
  drawComicButton("暂停", rightX, top, buttonW, buttonH, "#60a5fa", 0.04);
}

function drawPauseOverlay() {
  if (!state.paused) {
    state.returnButton = null;
    state.resumeButton = null;
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.56)";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();

  drawLoginComicText("暂停", state.width / 2, state.height * 0.38, 40, "#facc15", -0.02);

  const buttonW = Math.min(152, state.width * 0.42);
  const buttonH = 52;
  const gap = 18;
  const x = (state.width - buttonW) / 2;
  const returnY = state.height * 0.48;
  const resumeY = returnY + buttonH + gap;

  state.returnButton = { x, y: returnY, width: buttonW, height: buttonH };
  state.resumeButton = { x, y: resumeY, width: buttonW, height: buttonH };

  drawComicButton("返回", x, returnY, buttonW, buttonH, "#fb7185", -0.03);
  drawComicButton("开始", x, resumeY, buttonW, buttonH, "#4ade80", 0.03);
}

function drawPrompt() {
  const x = state.width / 2;
  const y = state.height - Math.min(178, state.width * 0.48);
  const pulse = Math.sin(Date.now() * 0.014) * 0.5 + 0.5;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 30px sans-serif";
  ctx.lineWidth = 7;
  ctx.shadowColor = "rgba(127,29,29,0.42)";
  ctx.shadowBlur = 10 + pulse * 8;
  ctx.shadowOffsetY = 4;
  ctx.strokeStyle = "rgba(17,24,39,0.94)";
  ctx.fillStyle = "#facc15";
  ctx.strokeText(state.message, x, y);
  ctx.fillText(state.message, x, y);

  ctx.lineWidth = 2;
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.strokeText(state.message, x, y - 1);
}

function drawGameOver(now) {
  const top = Math.max(42, state.safeTop + 8);
  const imageTop = top + 18;
  const imageHeight = Math.min(state.height * 0.7, state.height - imageTop - 170);
  const imageWidth = Math.min(state.width * 0.92, imageHeight * 0.72);
  const imageX = (state.width - imageWidth) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,0.18)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 10;
  drawImageContain(images.faceGameOver, imageX, imageTop, imageWidth, imageHeight);
  ctx.restore();

  const pulse = Math.sin(now * 0.012) * 0.5 + 0.5;
  const subtitleY = Math.min(state.height - 112, imageTop + imageHeight + 32);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 34px sans-serif";
  ctx.lineWidth = 8;
  ctx.shadowColor = "rgba(127,29,29,0.46)";
  ctx.shadowBlur = 12 + pulse * 8;
  ctx.strokeStyle = "rgba(17,24,39,0.96)";
  ctx.fillStyle = "#facc15";
  ctx.strokeText("别打了，别打了", state.width / 2, subtitleY);
  ctx.fillText("别打了，别打了", state.width / 2, subtitleY);

  ctx.font = "800 22px sans-serif";
  ctx.lineWidth = 5;
  ctx.shadowColor = "rgba(15,23,42,0.22)";
  ctx.strokeStyle = "rgba(17,24,39,0.86)";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText(`用时 ${state.finalSeconds} 秒`, state.width / 2, subtitleY + 44);
  ctx.fillText(`用时 ${state.finalSeconds} 秒`, state.width / 2, subtitleY + 44);
  ctx.restore();

  const gameOverButtonW = Math.min(132, state.width * 0.36);
  const gameOverButtonH = 46;
  const gameOverGap = Math.min(28, state.width * 0.08);
  const gameOverButtonY = Math.min(state.height - gameOverButtonH - 18, subtitleY + 78);
  const restartX = state.width / 2 - gameOverGap / 2 - gameOverButtonW;
  const returnX = state.width / 2 + gameOverGap / 2;

  state.restartButton = { x: restartX, y: gameOverButtonY, width: gameOverButtonW, height: gameOverButtonH };
  state.returnButton = { x: returnX, y: gameOverButtonY, width: gameOverButtonW, height: gameOverButtonH };

  drawComicButton("再来一次", restartX, gameOverButtonY, gameOverButtonW, gameOverButtonH, "#facc15", -0.04);
  drawComicButton("返回", returnX, gameOverButtonY, gameOverButtonW, gameOverButtonH, "#fb7185", 0.04);
}

function drawLoading() {
  drawBackground();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#111827";
  ctx.font = "600 17px sans-serif";
  ctx.fillText(`素材加载中 ${state.loaded}/${state.total}`, state.width / 2, state.height / 2);
}

function render() {
  const now = Date.now();
  if (!state.paused) {
    updateChargedStrike(now);
  }
  drawBackground();

  if (state.loaded < state.total) {
    drawLoading();
  } else if (state.screen === "login") {
    drawLoginScreen(now);
  } else if (state.gameEnded) {
    drawGameOver(now);
  } else {
    drawEnergyBar(now);
    drawGameMenuButtons();
    const faceBox = drawFace(now);
    if (!state.paused) {
      drawHand(now, faceBox);
      drawChargedStrike(now, faceBox);
      drawPowerImpactOverlay(now);
    }
    drawPrompt();
    drawControls();
    drawPauseOverlay();
  }

  requestAnimationFrame(render);
}

function pointInRect(point, rect) {
  return rect
    && point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function enterSinglePlayer() {
  resetSinglePlayerGame();
  state.screen = "single";
  startBgm();
}

function handleLoginTouch(point) {
  startBgm();
  if (pointInRect(point, state.loginButtons.single)) {
    enterSinglePlayer();
    return;
  }

  if (pointInRect(point, state.loginButtons.duel)) {
    state.loginNotice = "双人对线暂未开放";
    state.loginNoticeAt = Date.now();
    return;
  }

  if (pointInRect(point, state.loginButtons.fight)) {
    state.loginNotice = "双人格斗暂未开放";
    state.loginNoticeAt = Date.now();
  }
}

function handleGameMenuTouch(point) {
  const now = Date.now();
  if (state.gameEnded) {
    if (pointInRect(point, state.restartButton)) {
      resetSinglePlayerGame();
      state.screen = "single";
      startBgm();
      return true;
    }

    if (pointInRect(point, state.returnButton)) {
      returnToLogin();
      resumeBgm();
      return true;
    }

    return true;
  }

  if (state.paused) {
    if (pointInRect(point, state.returnButton)) {
      returnToLogin();
      resumeBgm();
      return true;
    }

    if (pointInRect(point, state.resumeButton)) {
      resumeGame(now);
      resumeBgm();
      return true;
    }

    return true;
  }

  if (pointInRect(point, state.restartButton)) {
    resetSinglePlayerGame();
    state.screen = "single";
    startBgm();
    return true;
  }

  if (pointInRect(point, state.pauseButton)) {
    pauseGame(now);
    pauseBgm();
    return true;
  }

  return false;
}

function playSlap(direction, options = {}) {
  const now = Date.now();
  if (state.gameEnded || state.paused || state.chargedStrike || state.powerHitUntil > now) {
    return;
  }

  const isLeft = direction === "left";
  markGameStarted(now);
  startBgm();
  playSlapSound(direction);
  vibrateOnSlap();
  state.action = direction;
  state.actionStart = now;
  state.message = options.message || (isLeft ? "左手一巴掌，欠劲收敛 1 秒" : "右手反手补上，节奏很稳");
  state.pendingMessageAfterAction = options.afterMessage || null;

  if (options.countHit === false) {
    state.face = "faceNormal";
    return;
  }

  const gain = addEnergy(direction);
  state.face = gain >= 3 ? (isLeft ? "faceLeft" : "faceRight") : "faceNormal";

  if (isLeft) {
    state.leftCount += 1;
  } else {
    state.rightCount += 1;
  }
}

function bindTouch() {
  wx.onTouchStart((event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) {
      return;
    }

    const point = { x: touch.clientX, y: touch.clientY };
    if (state.screen === "login") {
      handleLoginTouch(point);
      return;
    }

    if (handleGameMenuTouch(point)) {
      return;
    }

    if (pointInRect(point, state.leftButton)) {
      playSlap("left");
    } else if (pointInRect(point, state.rightButton)) {
      playSlap("right");
    }
  });
}

resizeCanvas();
state.message = getIdleMessage();
loadImages();
initAudio();
bindTouch();
requestAnimationFrame(render);
