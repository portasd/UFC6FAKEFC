import { FighterProfile } from './fighters';

const portraitCache = new Map<string, string>();

export function getFighterPortraitUrl(profile: FighterProfile): string {
  const cached = portraitCache.get(profile.id);
  if (cached) return cached;
  if (typeof document === 'undefined') return '';

  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 104;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  const bg = ctx.createLinearGradient(0, 0, 0, 104);
  bg.addColorStop(0, '#2a303e');
  bg.addColorStop(1, '#0d0f15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 160, 104);

  const rim = ctx.createRadialGradient(84, 42, 6, 80, 48, 60);
  rim.addColorStop(0, 'rgba(255, 224, 196, 0.22)');
  rim.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 160, 104);

  ctx.save();
  ctx.translate(80, 4);
  ctx.scale(0.76, 0.76);

  const skin = profile.appearance.skinHex;
  const hair = profile.appearance.hairHex;

  const sw = 58 * profile.buildScale;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-sw, 134);
  ctx.quadraticCurveTo(-44 * profile.buildScale, 92, -16, 86);
  ctx.lineTo(16, 86);
  ctx.quadraticCurveTo(44 * profile.buildScale, 92, sw, 134);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(20, 9, 5, 0.28)';
  ctx.fillRect(-15, 72, 30, 26);
  ctx.fillStyle = skin;
  ctx.fillRect(-13, 68, 26, 26);

  const ts = profile.appearance.tattooStyle;
  if (ts === 'hollowayFull' || ts === 'poirierFull' || ts === 'fullSleeveChest') {
    ctx.fillStyle = 'rgba(18, 25, 32, 0.56)';
    ctx.fillRect(-38, 100, 32, 22);
    ctx.fillRect(6, 100, 32, 22);
  } else if (ts === 'mcgregorChest') {
    ctx.fillStyle = 'rgba(18, 25, 32, 0.58)';
    ctx.beginPath();
    ctx.arc(0, 114, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c88c38';
    ctx.fillRect(-8, 95, 16, 5);
  } else if (ts === 'omalleyChest') {
    ctx.fillStyle = 'rgba(30, 68, 72, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-36, 104);
    ctx.lineTo(0, 126);
    ctx.lineTo(36, 104);
    ctx.closePath();
    ctx.fill();
  } else if (ts === 'chestBand' || ts === 'oliveiraChest') {
    ctx.strokeStyle = 'rgba(20, 28, 36, 0.62)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-34, 112);
    ctx.quadraticCurveTo(0, 100, 34, 112);
    ctx.stroke();
  }

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(-25, 47, 4.8, 8.8, 0, 0, Math.PI * 2);
  ctx.ellipse(25, 47, 4.8, 8.8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-23.5, 33);
  ctx.quadraticCurveTo(-24, 14, 0, 13);
  ctx.quadraticCurveTo(24, 14, 23.5, 33);
  ctx.lineTo(21, 59);
  ctx.quadraticCurveTo(15, 76, 0, 77);
  ctx.quadraticCurveTo(-15, 76, -21, 59);
  ctx.closePath();
  ctx.fill();

  const sideShade = ctx.createLinearGradient(-24, 20, 24, 72);
  sideShade.addColorStop(0, 'rgba(12, 5, 3, 0.34)');
  sideShade.addColorStop(0.5, 'rgba(0,0,0,0)');
  sideShade.addColorStop(1, 'rgba(255, 224, 198, 0.14)');
  ctx.fillStyle = sideShade;
  ctx.fill();

  if (profile.appearance.hairStyle !== 'shaved') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(0, 19, 23.5, 11.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    if (profile.appearance.hairStyle === 'textured') {
      ctx.beginPath();
      ctx.ellipse(0, 14, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (profile.appearance.hairStyle === 'fade') {
      ctx.fillRect(-22, 18, 44, 6);
    } else {
      ctx.fillRect(-21, 19, 42, 4.5);
    }
  }

  ctx.strokeStyle = hair;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-17, 37);
  ctx.quadraticCurveTo(-10, 34, -4, 37);
  ctx.moveTo(4, 37);
  ctx.quadraticCurveTo(10, 34, 17, 37);
  ctx.stroke();

  for (const ex of [-10.5, 10.5]) {
    ctx.fillStyle = 'rgba(20, 8, 5, 0.25)';
    ctx.beginPath();
    ctx.arc(ex, 43, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ddd6cd';
    ctx.beginPath();
    ctx.ellipse(ex, 43, 4.1, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#18100c';
    ctx.beginPath();
    ctx.arc(ex, 43, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(22, 9, 5, 0.28)';
  ctx.beginPath();
  ctx.moveTo(0, 41);
  ctx.lineTo(-4.2, 55);
  ctx.lineTo(4.2, 55);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(38, 14, 12, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, 63);
  ctx.lineTo(8, 63);
  ctx.stroke();

  const fh = profile.appearance.facialHair;
  if (fh === 'fullBeard') {
    ctx.fillStyle = hair;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(-21, 49);
    ctx.quadraticCurveTo(-18, 78, 0, 80);
    ctx.quadraticCurveTo(18, 78, 21, 49);
    ctx.lineTo(15, 59);
    ctx.quadraticCurveTo(0, 67, -15, 59);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 58.5, 9, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (fh === 'goatee') {
    ctx.fillStyle = hair;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.ellipse(0, 70, 8.2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 58.5, 8, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (fh === 'stubble') {
    ctx.fillStyle = 'rgba(18, 14, 14, 0.26)';
    ctx.beginPath();
    ctx.moveTo(-20, 52);
    ctx.quadraticCurveTo(0, 79, 20, 52);
    ctx.lineTo(14, 68);
    ctx.quadraticCurveTo(0, 75, -14, 68);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  const dataUrl = c.toDataURL('image/png');
  portraitCache.set(profile.id, dataUrl);
  return dataUrl;
}
