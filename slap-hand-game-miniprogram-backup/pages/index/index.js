const FACE_NORMAL = "/assets/optimized/face-normal.jpg";
const FACE_HIT_LEFT = "/assets/optimized/face-hit-left.jpg";
const FACE_HIT_RIGHT = "/assets/optimized/face-hit-right.jpg";
const HAND_PALM = "/assets/optimized/hand-palm-wind.jpg";
const HAND_BACK = "/assets/optimized/hand-back-wind.jpg";

Page({
  data: {
    faceSrc: FACE_NORMAL,
    handSrc: "",
    handVisible: false,
    impactVisible: false,
    handClass: "",
    impactClass: "",
    shakeClass: "",
    leftCount: 0,
    rightCount: 0,
    message: "点左右方向键，安排他一下"
  },

  onUnload() {
    this.clearTimers();
  },

  hitLeft() {
    this.playSlap({
      faceSrc: FACE_HIT_LEFT,
      handSrc: HAND_PALM,
      handClass: "hand-from-left",
      impactClass: "impact-left",
      shakeClass: "shake-right",
      countKey: "leftCount",
      message: "左手一巴掌，欠劲收敛 1 秒"
    });
  },

  hitRight() {
    this.playSlap({
      faceSrc: FACE_HIT_RIGHT,
      handSrc: HAND_BACK,
      handClass: "hand-from-right",
      impactClass: "impact-right",
      shakeClass: "shake-left",
      countKey: "rightCount",
      message: "右手反手补上，节奏很稳"
    });
  },

  playSlap(config) {
    this.clearTimers();

    this.setData({
      faceSrc: config.faceSrc,
      handSrc: config.handSrc,
      handVisible: true,
      impactVisible: true,
      handClass: config.handClass,
      impactClass: config.impactClass,
      shakeClass: config.shakeClass,
      [config.countKey]: this.data[config.countKey] + 1,
      message: config.message
    });

    this.impactTimer = setTimeout(() => {
      this.setData({ impactVisible: false });
    }, 240);

    this.resetTimer = setTimeout(() => {
      this.setData({
        faceSrc: FACE_NORMAL,
        handVisible: false,
        impactVisible: false,
        handClass: "",
        impactClass: "",
        shakeClass: "",
        message: "继续点，左右都能打"
      });
    }, 720);
  },

  clearTimers() {
    if (this.impactTimer) {
      clearTimeout(this.impactTimer);
      this.impactTimer = null;
    }

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
});
