const topCanvas = document.getElementById('topCanvas');
const bottomCanvas = document.getElementById('bottomCanvas');
const topCtx = topCanvas.getContext('2d', { willReadFrequently: true });
const bottomCtx = bottomCanvas.getContext('2d', { willReadFrequently: true });
const modal = document.getElementById('modal');
const modalMessage = document.getElementById('modalMessage');
const nextLevelBtn = document.getElementById('nextLevelBtn');
const currentLevelSpan = document.getElementById('currentLevel');
const totalLevelsSpan = document.getElementById('totalLevels');
const progressBar = document.getElementById('progressBar');
const performanceStats = document.getElementById('performanceStats');

let currentLevel = 1;
let isErasing = false;
let eraseStartTime = 0;
let erasedPixels = 0;
let totalPixels = 0;
let lastEraseCheck = 0;
let animationFrameId = null;
let lastFrameTime = 0;
let fps = 0;
let lastMousePos = { x: 0, y: 0 };
let currentMousePos = { x: 0, y: 0 };
let pendingPoints = [];

const levels = [
  { dirty: '/assets/images/dirty-1.jpg', clean: '/assets/images/clean-1.jpg' },
  { dirty: '/assets/images/dirty-2.jpg', clean: '/assets/images/clean-2.jpg' },
  { dirty: '/assets/images/dirty-3.jpg', clean: '/assets/images/clean-3.jpg' },
  { dirty: '/assets/images/dirty-4.jpg', clean: '/assets/images/clean-4.jpg' },
  { dirty: '/assets/images/dirty-5.jpg', clean: '/assets/images/clean-5.jpg' }
];
const requiredHoldTime = 6500;
const pixelCheckInterval = 250;
const renderInterval = 1000 / 60;
const totalLevels = levels.length;

function loadLevel(level) {
  return new Promise((resolve) => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    topCtx.clearRect(0, 0, topCanvas.width, topCanvas.height);
    bottomCtx.clearRect(0, 0, bottomCanvas.width, bottomCanvas.height);

    const dirtyImage = new Image();
    const cleanImage = new Image();
    let loadedImages = 0;

    dirtyImage.onload = () => {
      topCtx.drawImage(dirtyImage, 0, 0, topCanvas.width, topCanvas.height);
      totalPixels = topCanvas.width * topCanvas.height;
      loadedImages++;
      if (loadedImages === 2) resolve();
    };

    cleanImage.onload = () => {
      bottomCtx.drawImage(cleanImage, 0, 0, bottomCanvas.width, bottomCanvas.height);
      loadedImages++;
      if (loadedImages === 2) resolve();
    };

    dirtyImage.src = levels[level - 1].dirty;
    cleanImage.src = levels[level - 1].clean;

    currentLevelSpan.textContent = level;
    totalLevelsSpan.textContent = totalLevels;
    updateProgress();
    erasedPixels = 0;
    pendingPoints = [];
  });
}

function updateProgress() {
  const progress = ((currentLevel - 1) / totalLevels) * 100;
  progressBar.style.width = `${progress}%`;
}

function getDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function interpolatePoints(start, end, steps) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    points.push({
      x: start.x + (end.x - start.x) * (i / steps),
      y: start.y + (end.y - start.y) * (i / steps)
    });
  }
  return points;
}

function checkCompletion() {
  const currentTime = Date.now();
  if (currentTime - lastEraseCheck < pixelCheckInterval) return false;

  const imageData = topCtx.getImageData(0, 0, topCanvas.width, topCanvas.height);
  let transparentPixels = 0;

  for (let i = 3; i < imageData.data.length; i += 4) {
    if (imageData.data[i] === 0) transparentPixels++;
  }

  erasedPixels = transparentPixels;
  lastEraseCheck = currentTime;

  return transparentPixels > totalPixels * 0.5;
}

function render(timestamp) {
  if (!isErasing) {
    animationFrameId = requestAnimationFrame(render);
    return;
  }

  const deltaTime = timestamp - lastFrameTime;
  fps = Math.round(1000 / deltaTime);
  lastFrameTime = timestamp;

  performanceStats.textContent = `FPS: ${fps} | Silinme: ${((erasedPixels / totalPixels) * 100).toFixed(1)}%`;

  if (pendingPoints.length > 0) {
    topCtx.save();
    topCtx.globalCompositeOperation = 'destination-out';

    const radius = 110; // Yumuşaklık yarıçapı
    pendingPoints.forEach(point => {
      const gradient = topCtx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)'); // Merkezde tam silme
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.10)'); // Kenara yakın %10 şeffaflık
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Tam kenarda şeffaf

      topCtx.fillStyle = gradient;
      topCtx.beginPath();
      topCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      topCtx.fill();
    });

    topCtx.restore();
    pendingPoints = [];
    if (checkCompletion()) {
      showModal();
      isErasing = false;
    }
  }

  animationFrameId = requestAnimationFrame(render);
}

topCanvas.addEventListener('mousedown', (e) => {
  isErasing = true;
  eraseStartTime = Date.now();
  lastMousePos = { x: e.offsetX, y: e.offsetY };
  currentMousePos = { ...lastMousePos };
  lastEraseCheck = Date.now();
  animationFrameId = requestAnimationFrame(render);
});

topCanvas.addEventListener('mousemove', (e) => {
  if (!isErasing) return;

  const currentTime = Date.now();
  const timeHeld = currentTime - eraseStartTime;

  if (timeHeld < requiredHoldTime) {
    currentMousePos = { x: e.offsetX, y: e.offsetY };
    const distance = getDistance(lastMousePos.x, lastMousePos.y, currentMousePos.x, currentMousePos.y);
    const steps = Math.max(Math.floor(distance / 5), 1);
    
    const newPoints = interpolatePoints(lastMousePos, currentMousePos, steps);
    pendingPoints.push(...newPoints);
    
    lastMousePos = { ...currentMousePos };
  }
});

topCanvas.addEventListener('mouseup', () => {
  if (!isErasing) return;

  const timeHeld = Date.now() - eraseStartTime;

  if (timeHeld >= requiredHoldTime) {
    topCtx.clearRect(0, 0, topCanvas.width, topCanvas.height);
    showModal();
  } else {
    checkCompletion() && showModal();
  }

  isErasing = false;
});

function showModal() {
  if (currentLevel === totalLevels) {
    modalMessage.textContent = "Tüm seviyeleri tamamladınız!";
    nextLevelBtn.textContent = "Oyunu Baştan Başlat";
  } else {
    modalMessage.textContent = `Seviye ${currentLevel} tamamlandı!`;
    nextLevelBtn.textContent = "Sonraki Seviyeye Geç";
  }
  modal.style.display = 'block';
}

function nextLevel() {
  modal.style.display = 'none';

  if (currentLevel === totalLevels) {
    currentLevel = 1;
  } else {
    currentLevel++;
  }

  loadLevel(currentLevel);
}

loadLevel(1);
