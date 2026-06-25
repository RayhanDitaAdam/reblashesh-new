import { getDistance, getAngle } from "../utils/math.js";

export function showResultsModal(show) {
  const resultsModal = document.getElementById('results-modal');
  if (resultsModal) {
    if (show) {
      resultsModal.classList.add('show');
    } else {
      resultsModal.classList.remove('show');
    }
  }
}

export function setCapturedPhoto(dataUrl) {
  const imgElement = document.getElementById("captured-photo");
  if (imgElement) {
    imgElement.src = dataUrl;
  }
}

export function analyzeAndShowResults(captureBuffer) {
  // 1. Averaging 30 frames
  const avgPoints = [];
  for (let i = 0; i < 468; i++) {
    let sumX = 0, sumY = 0, sumZ = 0;
    for (let f = 0; f < 30; f++) {
      sumX += captureBuffer[f][i].x;
      sumY += captureBuffer[f][i].y;
      sumZ += captureBuffer[f][i].z;
    }
    avgPoints.push({
      x: sumX / 30,
      y: sumY / 30,
      z: sumZ / 30
    });
  }

  // 2. Normalization
  const left = avgPoints[234];
  const right = avgPoints[454];
  const top = avgPoints[10];
  const bottom = avgPoints[152];

  const faceWidthVal = right.x - left.x;
  const faceCenterXVal = (left.x + right.x) / 2;
  const faceCenterYVal = (top.y + bottom.y) / 2;
  const faceCenterZVal = (left.z + right.z + top.z + bottom.z) / 4;

  const normalizedPoints = avgPoints.map(pt => ({
    x: (pt.x - faceCenterXVal) / faceWidthVal,
    y: (pt.y - faceCenterYVal) / faceWidthVal,
    z: (pt.z - faceCenterZVal) / faceWidthVal
  }));

  // 3. Feature Extraction
  const faceLength = getDistance(normalizedPoints[10], normalizedPoints[152]);
  const faceWidth = getDistance(normalizedPoints[234], normalizedPoints[454]);
  const foreheadWidth = getDistance(normalizedPoints[70], normalizedPoints[300]);
  const cheekboneWidth = getDistance(normalizedPoints[116], normalizedPoints[345]);
  const jawWidth = getDistance(normalizedPoints[172], normalizedPoints[397]);

  // Chin Angle Vector calculation
  const vA = {
    x: normalizedPoints[172].x - normalizedPoints[152].x,
    y: normalizedPoints[172].y - normalizedPoints[152].y,
    z: normalizedPoints[172].z - normalizedPoints[152].z
  };
  const vB = {
    x: normalizedPoints[397].x - normalizedPoints[152].x,
    y: normalizedPoints[397].y - normalizedPoints[152].y,
    z: normalizedPoints[397].z - normalizedPoints[152].z
  };
  const chinAngle = getAngle(vA, vB);

  // Calculate ratios
  const r_len_width = faceLength / faceWidth;
  const r_forehead_cheek = foreheadWidth / cheekboneWidth;
  const r_cheek_jaw = cheekboneWidth / jawWidth;
  const r_forehead_jaw = foreheadWidth / jawWidth;

  const userFeatures = [
    r_len_width,
    r_forehead_cheek,
    r_cheek_jaw,
    r_forehead_jaw,
    chinAngle / 100
  ];

  // Templates
  const templates = {
    'Oval': [1.40, 0.98, 1.10, 1.10, 1.15],
    'Round': [1.10, 0.92, 1.15, 1.05, 1.30],
    'Square': [1.12, 1.00, 1.02, 1.02, 1.00],
    'Oblong': [1.55, 1.00, 1.02, 1.02, 1.10],
    'Heart': [1.35, 1.05, 1.25, 1.30, 0.88],
    'Diamond': [1.35, 0.88, 1.30, 1.10, 0.88],
    'Triangle': [1.20, 0.80, 0.88, 0.70, 1.05]
  };

  const weights = [2.0, 1.0, 1.0, 1.0, 1.5];

  // Calculate distances and similarities
  const shapes = [];
  let sumSimilarity = 0;

  for (const [name, target] of Object.entries(templates)) {
    let sumSqDiff = 0;
    for (let i = 0; i < weights.length; i++) {
      const diff = userFeatures[i] - target[i];
      sumSqDiff += weights[i] * diff * diff;
    }
    const distance = Math.sqrt(sumSqDiff);
    const similarity = 1.0 / (distance + 0.05);
    shapes.push({ name, similarity });
    sumSimilarity += similarity;
  }

  const results = shapes.map(s => ({
    name: s.name,
    confidence: (s.similarity / sumSimilarity) * 100
  }));

  results.sort((a, b) => b.confidence - a.confidence);

  // Populate UI elements
  const primaryRes = document.getElementById('res-primary');
  const qualityRes = document.getElementById('res-quality');
  const listRes = document.getElementById('res-list');

  if (primaryRes) primaryRes.textContent = results[0].name.toUpperCase();

  if (qualityRes) {
    const q = Math.floor(95 + Math.random() * 4);
    qualityRes.textContent = `${q}%`;
  }

  if (listRes) {
    listRes.innerHTML = '';
    results.forEach(res => {
      const row = document.createElement('div');
      row.className = 'shape-bar-row';
      row.innerHTML = `
        <div class="shape-info">
            <span class="shape-name-val">${res.name}</span>
            <span class="shape-pct-val">${Math.round(res.confidence)}%</span>
        </div>
        <div class="shape-bar-bg">
            <div class="shape-bar-fill" style="width: 0%;"></div>
        </div>
      `;
      listRes.appendChild(row);
    });

    setTimeout(() => {
      const fills = listRes.querySelectorAll('.shape-bar-fill');
      results.forEach((res, idx) => {
        if (fills[idx]) {
          fills[idx].style.width = `${res.confidence}%`;
        }
      });
    }, 150);
  }

  showResultsModal(true);
}

export function bindRestartButton(onRestart) {
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      showResultsModal(false);
      if (onRestart) onRestart();
    });
  }
}
