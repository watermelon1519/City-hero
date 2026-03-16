// 音效与音乐管理系统 - 8-bit 像素风风格
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.bgMusicEnabled = true;
    this.currentMusic = null;
    this.currentScene = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.musicVolume = 0.3;
    this.sfxVolume = 0.5;
    this.initialized = false;
  }

  // 初始化音频上下文（需要用户交互后调用）
  init() {
    if (this.initialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 创建主音量节点
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.audioContext.destination);
      
      // 音乐音量
      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);
      
      // 音效音量
      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);
      
      this.initialized = true;
      console.log("Audio system initialized");
    } catch (e) {
      console.warn("Audio system failed to initialize:", e);
    }
  }

  // 切换场景音乐
  playSceneMusic(scene) {
    try {
      if (!this.initialized || !this.bgMusicEnabled) return;
      if (this.currentScene === scene) return;
      
      this.currentScene = scene;
      
      switch (scene) {
        case 'battle':
          this.playBattleMusic();
          break;
        case 'boss':
          this.playBossMusic();
          break;
        case 'shop':
          this.playShopMusic();
          break;
        case 'event':
          this.playEventMusic();
          break;
        case 'map':
          this.playMapMusic();
          break;
        case 'victory':
          this.playVictoryMusic();
          break;
        default:
          this.stopMusic();
      }
    } catch (e) {
      console.warn('playSceneMusic error:', e);
    }
  }

  // ===== 背景音乐 =====
  
  // 普通战斗音乐 - 紧张刺激
  playBattleMusic() {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    this.stopMusic();
    
    const now = this.audioContext.currentTime;
    
    // 8-bit 战斗旋律
    const melody = [
      { note: 'E4', dur: 0.15 }, { note: 'G4', dur: 0.15 }, { note: 'A4', dur: 0.15 }, { note: 'B4', dur: 0.15 },
      { note: 'A4', dur: 0.15 }, { note: 'G4', dur: 0.15 }, { note: 'E4', dur: 0.15 }, { note: 'D4', dur: 0.15 },
      { note: 'E4', dur: 0.2 }, { note: 'G4', dur: 0.2 }, { note: 'B4', dur: 0.2 }, { note: 'D5', dur: 0.2 },
      { note: 'C5', dur: 0.15 }, { note: 'B4', dur: 0.15 }, { note: 'A4', dur: 0.15 }, { note: 'G4', dur: 0.15 },
    ];
    
    // 低音线
    const bass = [
      { note: 'E2', dur: 0.3 }, { note: 'E2', dur: 0.3 },
      { note: 'G2', dur: 0.3 }, { note: 'G2', dur: 0.3 },
      { note: 'A2', dur: 0.3 }, { note: 'A2', dur: 0.3 },
      { note: 'B2', dur: 0.3 }, { note: 'B2', dur: 0.3 },
    ];
    
    // 鼓点
    const drumPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    
    this.playMelodyLoop(melody, 'square', 0.15, 120);
    this.playMelodyLoop(bass, 'triangle', 0.2, 120);
    this.playDrumLoop(drumPattern, 120);
  }

  // Boss战音乐 - 更激烈
  playBossMusic() {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    this.stopMusic();
    
    const melody = [
      { note: 'E5', dur: 0.1 }, { note: 'D5', dur: 0.1 }, { note: 'C5', dur: 0.1 }, { note: 'B4', dur: 0.1 },
      { note: 'A4', dur: 0.1 }, { note: 'B4', dur: 0.1 }, { note: 'C5', dur: 0.1 }, { note: 'D5', dur: 0.1 },
      { note: 'E5', dur: 0.15 }, { note: 'E5', dur: 0.15 }, { note: 'D5', dur: 0.1 }, { note: 'C5', dur: 0.1 },
      { note: 'B4', dur: 0.2 }, { note: 'A4', dur: 0.1 }, { note: 'G4', dur: 0.1 }, { note: 'A4', dur: 0.15 },
    ];
    
    const bass = [
      { note: 'E2', dur: 0.15 }, { note: 'E2', dur: 0.15 },
      { note: 'G2', dur: 0.15 }, { note: 'G2', dur: 0.15 },
      { note: 'A2', dur: 0.15 }, { note: 'A2', dur: 0.15 },
      { note: 'B2', dur: 0.15 }, { note: 'B2', dur: 0.15 },
    ];
    
    const drumPattern = [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1];
    
    this.playMelodyLoop(melody, 'square', 0.18, 140);
    this.playMelodyLoop(bass, 'triangle', 0.25, 140);
    this.playDrumLoop(drumPattern, 140);
  }

  // 商店音乐 - 轻松悠闲
  playShopMusic() {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    this.stopMusic();
    
    const melody = [
      { note: 'C5', dur: 0.3 }, { note: 'E5', dur: 0.3 }, { note: 'G5', dur: 0.3 }, { note: 'E5', dur: 0.3 },
      { note: 'C5', dur: 0.3 }, { note: 'D5', dur: 0.15 }, { note: 'E5', dur: 0.15 }, { note: 'F5', dur: 0.3 },
      { note: 'E5', dur: 0.3 }, { note: 'D5', dur: 0.3 }, { note: 'C5', dur: 0.3 }, { note: 'B4', dur: 0.3 },
      { note: 'C5', dur: 0.6 },
    ];
    
    const bass = [
      { note: 'C3', dur: 0.6 }, { note: 'C3', dur: 0.6 },
      { note: 'F3', dur: 0.6 }, { note: 'G3', dur: 0.6 },
    ];
    
    this.playMelodyLoop(melody, 'sine', 0.12, 80);
    this.playMelodyLoop(bass, 'triangle', 0.15, 80);
  }

  // 事件音乐 - 神秘轻松
  playEventMusic() {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    this.stopMusic();
    
    const melody = [
      { note: 'A4', dur: 0.4 }, { note: 'C5', dur: 0.4 }, { note: 'E5', dur: 0.4 },
      { note: 'D5', dur: 0.2 }, { note: 'C5', dur: 0.2 }, { note: 'B4', dur: 0.4 },
      { note: 'A4', dur: 0.4 }, { note: 'G4', dur: 0.4 }, { note: 'A4', dur: 0.8 },
    ];
    
    this.playMelodyLoop(melody, 'sine', 0.1, 70);
  }

  // 地图音乐 - 探索感
  playMapMusic() {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    this.stopMusic();
    
    const melody = [
      { note: 'C4', dur: 0.25 }, { note: 'E4', dur: 0.25 }, { note: 'G4', dur: 0.25 }, { note: 'C5', dur: 0.25 },
      { note: 'B4', dur: 0.25 }, { note: 'G4', dur: 0.25 }, { note: 'E4', dur: 0.25 }, { note: 'C4', dur: 0.25 },
      { note: 'D4', dur: 0.25 }, { note: 'F4', dur: 0.25 }, { note: 'A4', dur: 0.25 }, { note: 'D5', dur: 0.25 },
      { note: 'C5', dur: 0.25 }, { note: 'A4', dur: 0.25 }, { note: 'F4', dur: 0.25 }, { note: 'D4', dur: 0.25 },
    ];
    
    const bass = [
      { note: 'C3', dur: 0.5 }, { note: 'C3', dur: 0.5 },
      { note: 'F3', dur: 0.5 }, { note: 'G3', dur: 0.5 },
    ];
    
    this.playMelodyLoop(melody, 'square', 0.08, 90);
    this.playMelodyLoop(bass, 'triangle', 0.12, 90);
  }

  // 胜利音乐
  playVictoryMusic() {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    this.stopMusic();
    
    const melody = [
      { note: 'C5', dur: 0.15 }, { note: 'E5', dur: 0.15 }, { note: 'G5', dur: 0.15 }, { note: 'C6', dur: 0.3 },
      { note: 'G5', dur: 0.15 }, { note: 'C6', dur: 0.45 },
    ];
    
    this.playMelody(melody, 'square', 0.2);
  }

  // 播放旋律循环
  playMelodyLoop(notes, type, volume, bpm) {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    
    try {
      const beatDuration = 60 / bpm;
      
      // 清除之前的循环
      if (this._melodyTimeout) {
        clearTimeout(this._melodyTimeout);
        this._melodyTimeout = null;
      }
      
      // 创建循环振荡器组
      const playLoop = () => {
        if (!this.bgMusicEnabled || this.currentScene !== this._currentMelodyScene) return;
        
        const now = this.audioContext.currentTime;
        notes.forEach((note, i) => {
          const freq = this.noteToFreq(note.note);
          const duration = note.dur * beatDuration;
          this.playTone(freq, now + i * duration, duration, type, volume);
        });
        
        const totalDuration = notes.reduce((sum, n) => sum + n.dur, 0) * beatDuration;
        this._melodyTimeout = setTimeout(playLoop, totalDuration * 1000);
      };
      
      this._currentMelodyScene = this.currentScene;
      playLoop();
    } catch (e) {
      console.warn('playMelodyLoop error:', e);
    }
  }

  // 播放鼓点循环
  playDrumLoop(pattern, bpm) {
    if (!this.audioContext || !this.bgMusicEnabled) return;
    
    try {
      const beatDuration = 60 / bpm / 4;
      
      // 清除之前的循环
      if (this._drumTimeout) {
        clearTimeout(this._drumTimeout);
        this._drumTimeout = null;
      }
      
      const playLoop = () => {
        if (!this.bgMusicEnabled || this.currentScene !== this._currentDrumScene) return;
        
        const now = this.audioContext.currentTime;
        pattern.forEach((hit, i) => {
          if (hit) {
            this.playDrum(now + i * beatDuration);
          }
        });
        
        const totalDuration = pattern.length * beatDuration;
        this._drumTimeout = setTimeout(playLoop, totalDuration * 1000);
      };
      
      this._currentDrumScene = this.currentScene;
      playLoop();
    } catch (e) {
      console.warn('playDrumLoop error:', e);
    }
  }

  // 停止音乐
  stopMusic() {
    this._currentMelodyScene = null;
    this._currentDrumScene = null;
    if (this._melodyTimeout) clearTimeout(this._melodyTimeout);
    if (this._drumTimeout) clearTimeout(this._drumTimeout);
    this.currentScene = null;
  }

  // ===== 音效 =====

  // 出牌音效
  playCard() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    this.playTone(800, now, 0.05, 'square', 0.2);
    this.playTone(1000, now + 0.05, 0.05, 'square', 0.15);
  }

  // 抽牌音效
  drawCard() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    this.playTone(600, now, 0.08, 'sine', 0.15);
    this.playTone(800, now + 0.05, 0.08, 'sine', 0.12);
  }

  // 伤害音效
  hit() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    this.playNoise(now, 0.1, 0.3);
    this.playTone(200, now, 0.1, 'square', 0.3);
    this.playTone(150, now + 0.05, 0.1, 'square', 0.2);
  }

  // 敌人攻击音效
  enemyAttack() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    this.playTone(300, now, 0.1, 'sawtooth', 0.25);
    this.playTone(200, now + 0.08, 0.15, 'sawtooth', 0.2);
    this.playNoise(now + 0.1, 0.1, 0.15);
  }

  // 胜利音效
  victory() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    // 上升音阶
    const notes = ['C5', 'E5', 'G5', 'C6'];
    notes.forEach((note, i) => {
      this.playTone(this.noteToFreq(note), now + i * 0.12, 0.2, 'square', 0.2);
    });
    
    // 最后的和弦
    this.playTone(this.noteToFreq('C5'), now + 0.5, 0.3, 'sine', 0.15);
    this.playTone(this.noteToFreq('E5'), now + 0.5, 0.3, 'sine', 0.15);
    this.playTone(this.noteToFreq('G5'), now + 0.5, 0.3, 'sine', 0.15);
  }

  // 失败音效
  defeat() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    // 下降音阶
    this.playTone(400, now, 0.2, 'square', 0.2);
    this.playTone(350, now + 0.2, 0.2, 'square', 0.18);
    this.playTone(300, now + 0.4, 0.3, 'square', 0.15);
    this.playTone(200, now + 0.7, 0.5, 'triangle', 0.2);
  }

  // 治疗音效
  heal() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    this.playTone(600, now, 0.1, 'sine', 0.15);
    this.playTone(800, now + 0.1, 0.1, 'sine', 0.15);
    this.playTone(1000, now + 0.2, 0.15, 'sine', 0.12);
  }

  // 金币音效
  gold() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    this.playTone(1200, now, 0.05, 'square', 0.15);
    this.playTone(1500, now + 0.05, 0.05, 'square', 0.12);
    this.playTone(1800, now + 0.1, 0.08, 'square', 0.1);
  }

  // 商店购买音效
  shopBuy() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    this.playTone(800, now, 0.08, 'sine', 0.15);
    this.playTone(1000, now + 0.08, 0.08, 'sine', 0.15);
    this.playTone(1200, now + 0.16, 0.12, 'sine', 0.12);
  }

  // 商店出售音效
  shopSell() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    this.playTone(600, now, 0.08, 'sine', 0.15);
    this.playTone(800, now + 0.08, 0.08, 'sine', 0.15);
  }

  // 事件正面效果音效
  eventPositive() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    this.playTone(500, now, 0.1, 'sine', 0.15);
    this.playTone(700, now + 0.1, 0.1, 'sine', 0.15);
    this.playTone(900, now + 0.2, 0.15, 'sine', 0.12);
    this.playTone(1100, now + 0.3, 0.2, 'sine', 0.1);
  }

  // 事件负面效果音效
  eventNegative() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    this.playTone(400, now, 0.15, 'sawtooth', 0.15);
    this.playTone(300, now + 0.15, 0.15, 'sawtooth', 0.12);
    this.playTone(200, now + 0.3, 0.2, 'sawtooth', 0.1);
  }

  // 成就/传奇道具音效
  legendaryItem() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    // 华丽的上升音阶
    const notes = ['C5', 'E5', 'G5', 'B5', 'D6', 'G6', 'B6', 'C7'];
    notes.forEach((note, i) => {
      this.playTone(this.noteToFreq(note), now + i * 0.08, 0.15, 'sine', 0.15);
    });
    
    // 闪亮效果
    this.playNoise(now + 0.3, 0.1, 0.05);
    this.playNoise(now + 0.5, 0.1, 0.03);
  }

  // 组合技触发音效
  combo() {
    if (!this.audioContext || !this.enabled) return;
    const now = this.audioContext.currentTime;
    
    this.playTone(400, now, 0.1, 'square', 0.2);
    this.playTone(600, now + 0.1, 0.1, 'square', 0.18);
    this.playTone(800, now + 0.2, 0.1, 'square', 0.15);
    this.playTone(1000, now + 0.3, 0.2, 'square', 0.12);
    this.playNoise(now + 0.4, 0.1, 0.1);
  }

  // ===== 工具函数 =====

  // 播放单次旋律
  playMelody(notes, type, volume) {
    if (!this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    notes.forEach((note, i) => {
      const freq = this.noteToFreq(note.note);
      const startTime = now + i * note.dur;
      this.playTone(freq, startTime, note.dur * 0.9, type, volume);
    });
  }

  // 播放单音
  playTone(freq, startTime, duration, type, volume) {
    if (!this.audioContext) return;
    
    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = type;
      osc.frequency.value = freq;
      
      // 确保时间是有效的
      const now = this.audioContext.currentTime;
      const safeStart = Math.max(now, startTime);
      const safeDuration = Math.max(0.01, duration);
      
      gain.gain.setValueAtTime(0, safeStart);
      gain.gain.linearRampToValueAtTime(volume, safeStart + 0.01);
      gain.gain.linearRampToValueAtTime(volume * 0.7, safeStart + safeDuration * 0.3);
      gain.gain.linearRampToValueAtTime(0, safeStart + safeDuration);
      
      osc.connect(gain);
      gain.connect(this.sfxGain);
      
      osc.start(safeStart);
      osc.stop(safeStart + safeDuration + 0.1);
    } catch (e) {
      console.warn('playTone error:', e);
    }
  }

  // 播放鼓点
  playDrum(time) {
    if (!this.audioContext) return;
    
    // 低音鼓
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);
    
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(time);
    osc.stop(time + 0.15);
    
    // 噪音层
    this.playNoise(time, 0.05, 0.15);
  }

  // 播放噪音
  playNoise(startTime, duration, volume) {
    if (!this.audioContext) return;
    
    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    
    noise.buffer = buffer;
    
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    noise.connect(gain);
    gain.connect(this.sfxGain);
    
    noise.start(startTime);
  }

  // 音符转频率
  noteToFreq(note) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = note.match(/([A-G]#?)(\d+)/);
    if (!match) return 440;
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    const noteIndex = notes.indexOf(noteName);
    const semitones = noteIndex + (octave - 4) * 12;
    
    return 440 * Math.pow(2, semitones / 12);
  }

  // 切换背景音乐
  toggleBgMusic() {
    this.bgMusicEnabled = !this.bgMusicEnabled;
    if (!this.bgMusicEnabled) {
      this.stopMusic();
    }
    return this.bgMusicEnabled;
  }

  // 切换音效
  toggleSfx() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // 设置音量
  setMasterVolume(value) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  setSfxVolume(value) {
    this.sfxVolume = Math.max(0, Math.min(1, value));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }
}

// 创建全局实例
const audioManager = new AudioManager();

// 用户首次交互时初始化
document.addEventListener('click', () => {
  audioManager.init();
}, { once: true });

document.addEventListener('keydown', () => {
  audioManager.init();
}, { once: true });

// 挂载到 window
if (typeof window !== 'undefined') {
  window.audioManager = audioManager;
  window.AudioManager = AudioManager;
}
