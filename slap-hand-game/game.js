const canvas = wx.createCanvas();
const ctx = canvas.getContext("2d");

const ASSETS = {
  faceNormal: "assets/cutout/face-normal.png",
  faceLeft: "assets/cutout/face-hit-left.png",
  faceRight: "assets/cutout/face-hit-right.png",
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
  message: "点左右方向键，安排他一下",
  leftButton: null,
  rightButton: null,
  pendingMessageAfterAction: null
};

const ACTION_DURATION = 760;
const ENERGY_MAX = 333;
const DEFAULT_IDLE_MESSAGE = "继续点，左右都能打";
const TAUNT_MESSAGES = [
  "打啊，就没力气了？",
  "继续一点都不疼",
  "我错了放过我吧"
];

function getTotalHits() {
  return state.leftCount + state.rightCount;
}

function getIdleMessage() {
  const totalHits = getTotalHits();
  if (totalHits < 88) {
    return DEFAULT_IDLE_MESSAGE;
  }

  const phraseIndex = Math.floor(totalHits / 88 - 1) % TAUNT_MESSAGES.length;
  return TAUNT_MESSAGES[phraseIndex];
}

function getEnergyGain(direction) {
  return state.lastEnergyDirection && state.lastEnergyDirection !== direction ? 3 : 1;
}

function addEnergy(direction) {
  const gain = getEnergyGain(direction);
  state.energyScore = Math.min(state.energyScore + gain, ENERGY_MAX);
  state.lastEnergyDirection = direction;
  state.lastEnergyGain = gain;
  state.lastEnergyGainAt = Date.now();
  return gain;
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
  const shake = progress < 0.66 ? Math.sin(progress * Math.PI * 9) * (1 - progress) * 22 * push : 0;
  const rotate = progress < 0.66 ? Math.sin(progress * Math.PI * 7) * (1 - progress) * 0.09 * push : 0;
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
  const handSide = faceBox.side * 0.62;
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

function drawPrompt() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#374151";
  ctx.fillText(state.message, state.width / 2, state.height - Math.min(178, state.width * 0.48));
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
  drawBackground();

  if (state.loaded < state.total) {
    drawLoading();
  } else {
    drawEnergyBar(now);
    const faceBox = drawFace(now);
    drawHand(now, faceBox);
    drawPrompt();
    drawControls();
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

function playSlap(direction, options = {}) {
  const isLeft = direction === "left";
  startBgm();
  playSlapSound(direction);
  vibrateOnSlap();
  state.action = direction;
  state.actionStart = Date.now();
  state.face = isLeft ? "faceLeft" : "faceRight";
  state.message = options.message || (isLeft ? "左手一巴掌，欠劲收敛 1 秒" : "右手反手补上，节奏很稳");
  state.pendingMessageAfterAction = options.afterMessage || null;

  if (options.countHit === false) {
    return;
  }

  addEnergy(direction);

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
    if (pointInRect(point, state.leftButton)) {
      playSlap("left");
    } else if (pointInRect(point, state.rightButton)) {
      playSlap("right");
    }
  });
}

resizeCanvas();
loadImages();
initAudio();
bindTouch();
requestAnimationFrame(render);
