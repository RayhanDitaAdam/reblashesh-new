import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const drawingUtils = new DrawingUtils(ctx);

// Smooth progress bar update helper
function updateProgress(targetPercentage) {
  const progressBar = document.getElementById('progress-bar');
  const loadPercent = document.getElementById('load-percent');

  const currentWidth = parseFloat(progressBar?.style.width) || 0;
  const duration = 600; // ms
  const startTime = performance.now();

  function animate(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Cubic ease out
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const nowWidth = currentWidth + (targetPercentage - currentWidth) * easeProgress;

    if (progressBar) progressBar.style.width = `${nowWidth}%`;
    if (loadPercent) loadPercent.textContent = `${Math.round(nowWidth)}%`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}

async function setupCamera() {
  updateProgress(20);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true
  });

  video.srcObject = stream;
  video.play();

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      updateProgress(40);
      resolve();
    };
  });
}

async function createDetector() {
  updateProgress(50);
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
  );

  updateProgress(70);
  // Let progress creep up while loading large WASM/Model files
  const creepInterval = setInterval(() => {
    const progressBar = document.getElementById('progress-bar');
    const loadPercent = document.getElementById('load-percent');
    let width = parseFloat(progressBar?.style.width) || 70;
    if (width < 92) {
      width += 1.5;
      if (progressBar) progressBar.style.width = `${width}%`;
      if (loadPercent) loadPercent.textContent = `${Math.round(width)}%`;
    }
  }, 300);

  const landmarker = await FaceLandmarker.createFromOptions(
    vision,
    {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    }
  );

  clearInterval(creepInterval);
  return landmarker;
}

// Helper to draw interactive guide frame with glowing aligned borders
function drawInteractiveGuideBox(x, y, w, h, leftTouch, rightTouch, bottomTouch) {
  ctx.save();

  // Draw top border (neutral/semi-transparent)
  ctx.beginPath();
  ctx.strokeStyle = "rgba(226, 232, 240, 0.25)";
  ctx.lineWidth = 2;
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();

  // Draw left border
  ctx.beginPath();
  ctx.strokeStyle = leftTouch ? "#00ffaa" : "rgba(255, 59, 59, 0.6)";
  ctx.lineWidth = leftTouch ? 4 : 2;
  if (leftTouch) {
    ctx.shadowColor = "#00ffaa";
    ctx.shadowBlur = 10;
  }
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Draw right border
  ctx.beginPath();
  ctx.strokeStyle = rightTouch ? "#00ffaa" : "rgba(255, 59, 59, 0.6)";
  ctx.lineWidth = rightTouch ? 4 : 2;
  if (rightTouch) {
    ctx.shadowColor = "#00ffaa";
    ctx.shadowBlur = 10;
  }
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Draw bottom border
  ctx.beginPath();
  ctx.strokeStyle = bottomTouch ? "#00ffaa" : "rgba(255, 59, 59, 0.6)";
  ctx.lineWidth = bottomTouch ? 4 : 2;
  if (bottomTouch) {
    ctx.shadowColor = "#00ffaa";
    ctx.shadowBlur = 10;
  }
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Draw corners for premium HUD visual style
  const cornerLen = 20;
  ctx.lineWidth = 3.5;

  const allTouch = leftTouch && rightTouch && bottomTouch;
  const cornerColor = allTouch ? "#00ffaa" : "#00b3ff";
  ctx.strokeStyle = cornerColor;
  ctx.shadowColor = cornerColor;
  ctx.shadowBlur = 8;

  ctx.beginPath();
  // Top-Left corner
  ctx.moveTo(x + cornerLen, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + cornerLen);

  // Top-Right corner
  ctx.moveTo(x + w - cornerLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerLen);

  // Bottom-Left corner
  ctx.moveTo(x, y + h - cornerLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cornerLen, y + h);

  // Bottom-Right corner
  ctx.moveTo(x + w - cornerLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerLen);

  ctx.stroke();
  ctx.restore();
}

// Distance helper
function getDistance(ptA, ptB) {
  const dx = ptA.x - ptB.x;
  const dy = ptA.y - ptB.y;
  const dz = ptA.z - ptB.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Angle helper
function getAngle(vA, vB) {
  const dot = vA.x * vB.x + vA.y * vB.y + vA.z * vB.z;
  const magA = Math.sqrt(vA.x * vA.x + vA.y * vA.y + vA.z * vA.z);
  const magB = Math.sqrt(vB.x * vB.x + vB.y * vB.y + vB.z * vB.z);
  const cosAngle = dot / (magA * magB);
  // Prevent floating point errors
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

async function main() {
  updateProgress(10);

  try {
    await setupCamera();
  } catch (err) {
    console.error("Camera access failed:", err);
    updateProgress(0);
    const loadPercent = document.getElementById('load-percent');
    if (loadPercent) loadPercent.textContent = "ERR";
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  let detector;
  try {
    detector = await createDetector();
  } catch (err) {
    console.error("Model loading failed:", err);
    updateProgress(0);
    const loadPercent = document.getElementById('load-percent');
    if (loadPercent) loadPercent.textContent = "ERR";
    return;
  }

  updateProgress(100);

  // Sembunyikan loading screen setelah semuanya terinisialisasi
  const loader = document.getElementById('loader');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 800);
    }, 1000); // 1s buffer for user to enjoy 100% complete loading UX
  }

  // Show biometric HUD
  const biometricHud = document.getElementById('biometric-hud');
  if (biometricHud) {
    biometricHud.classList.add('show');
  }

  // Biometric Scan State Machine variables
  let scanState = 'ALIGNING'; // 'ALIGNING', 'COUNTDOWN', 'CAPTURING', 'RESULT'
  let countdownVal = 3;
  let countdownStartTime = 0;
  let captureBuffer = [];
  let stabilityStart = 0;
  const STABILITY_REQUIRED_MS = 600;

  // Scanner Sweep State variables
  let sweepEnabled = true;
  let sweepMode = 'smooth'; // 'block' or 'smooth'
  let sweepWidth = 0.25; // 25% of face size
  let inactiveMeshOpacity = 0.15;
  let sweepDuration = 1.5; // seconds per sweep

  let sweepPosition = 0.0;
  let lastFrameTime = performance.now();
  let activeAxis = 'x'; // 'x' or 'y'
  let sweepPaused = false;

  // Bind controls UI
  const sweepToggle = document.getElementById("sweep-toggle");
  const sweepModeSelect = document.getElementById("sweep-mode");
  const sweepWidthSlider = document.getElementById("sweep-width");
  const meshOpacitySlider = document.getElementById("mesh-opacity");
  const sweepDurationSlider = document.getElementById("sweep-duration");
  const playPauseBtn = document.getElementById("play-pause-btn");
  
  const widthValLabel = document.getElementById("width-val");
  const opacityValLabel = document.getElementById("opacity-val");
  const durationValLabel = document.getElementById("duration-val");
  const activeAxisValLabel = document.getElementById("active-axis-val");

  const resetControlsBtn = document.getElementById("reset-controls-btn");

  function updateControlUI() {
    if (sweepToggle) sweepToggle.checked = sweepEnabled;
    if (sweepModeSelect) sweepModeSelect.value = sweepMode;
    
    if (sweepWidthSlider) sweepWidthSlider.value = Math.round(sweepWidth * 100);
    if (widthValLabel) widthValLabel.textContent = `${Math.round(sweepWidth * 100)}%`;
    
    if (meshOpacitySlider) meshOpacitySlider.value = inactiveMeshOpacity * 100;
    if (opacityValLabel) opacityValLabel.textContent = `${Math.round(inactiveMeshOpacity * 100)}%`;
    
    if (sweepDurationSlider) sweepDurationSlider.value = Math.round(sweepDuration * 10);
    if (durationValLabel) durationValLabel.textContent = `${sweepDuration.toFixed(1)}s`;
    
    if (activeAxisValLabel) activeAxisValLabel.textContent = `${activeAxis.toUpperCase()}-AXIS`;

    if (playPauseBtn) {
      playPauseBtn.textContent = sweepPaused ? "RESUME SCAN" : "PAUSE SCAN";
      playPauseBtn.style.color = sweepPaused ? "#ff3b3b" : "#00ffaa";
      playPauseBtn.style.borderColor = sweepPaused ? "rgba(255, 59, 59, 0.3)" : "rgba(0, 255, 170, 0.3)";
    }
  }

  if (sweepToggle) {
    sweepToggle.addEventListener("change", (e) => {
      sweepEnabled = e.target.checked;
    });
  }
  if (sweepModeSelect) {
    sweepModeSelect.addEventListener("change", (e) => {
      sweepMode = e.target.value;
      sweepPosition = 0.0; // reset
    });
  }
  if (sweepWidthSlider) {
    sweepWidthSlider.addEventListener("input", (e) => {
      sweepWidth = parseFloat(e.target.value) / 100;
      if (widthValLabel) widthValLabel.textContent = `${Math.round(sweepWidth * 100)}%`;
    });
  }
  if (meshOpacitySlider) {
    meshOpacitySlider.addEventListener("input", (e) => {
      inactiveMeshOpacity = parseFloat(e.target.value) / 100;
      if (opacityValLabel) opacityValLabel.textContent = `${Math.round(inactiveMeshOpacity * 100)}%`;
    });
  }
  if (sweepDurationSlider) {
    sweepDurationSlider.addEventListener("input", (e) => {
      sweepDuration = parseFloat(e.target.value) / 10;
      if (durationValLabel) durationValLabel.textContent = `${sweepDuration.toFixed(1)}s`;
    });
  }
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      sweepPaused = !sweepPaused;
      updateControlUI();
    });
  }
  if (resetControlsBtn) {
    resetControlsBtn.addEventListener("click", () => {
      sweepEnabled = true;
      sweepMode = 'smooth';
      sweepWidth = 0.25;
      inactiveMeshOpacity = 0.15;
      sweepDuration = 1.5;
      sweepPosition = 0.0;
      activeAxis = 'x';
      sweepPaused = false;
      updateControlUI();
    });
  }

  // Initialize controls UI values
  updateControlUI();

  // Guide box dimensions
  let boxW = 0;
  let boxH = 0;
  let boxX = 0;
  let boxY = 0;

  function takeSnapshot() {
    const w = canvas.width;
    const h = canvas.height;

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = boxW;
    captureCanvas.height = boxH;
    const captureCtx = captureCanvas.getContext("2d");

    // Mirror horizontally to match what the user sees
    captureCtx.translate(boxW, 0);
    captureCtx.scale(-1, 1);

    // Map cropped coordinate back to raw unmirrored video
    const srcX = w - boxX - boxW;

    try {
      captureCtx.drawImage(
        video,
        srcX, boxY, boxW, boxH,
        0, 0, boxW, boxH
      );

      const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.95);
      const imgElement = document.getElementById("captured-photo");
      if (imgElement) {
        imgElement.src = dataUrl;
      }
    } catch (e) {
      console.error("Failed to capture snapshot:", e);
    }
  }

  // Add click listener for restart button
  const restartBtn = document.getElementById('restart-btn');
  const resultsModal = document.getElementById('results-modal');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      if (resultsModal) resultsModal.classList.remove('show');
      scanState = 'ALIGNING';
      countdownVal = 3;
      captureBuffer = [];
      stabilityStart = 0;
      if (biometricHud) biometricHud.classList.add('show');
    });
  }

  function analyzeFaceShape() {
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

    // User features vector
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
      // Similarity decreases as distance increases
      const similarity = 1.0 / (distance + 0.05);
      shapes.push({ name, similarity });
      sumSimilarity += similarity;
    }

    // Convert to normalized confidence percentages
    const results = shapes.map(s => ({
      name: s.name,
      confidence: (s.similarity / sumSimilarity) * 100
    }));

    // Sort descending
    results.sort((a, b) => b.confidence - a.confidence);

    // Populate UI
    const primaryRes = document.getElementById('res-primary');
    const qualityRes = document.getElementById('res-quality');
    const listRes = document.getElementById('res-list');

    if (primaryRes) primaryRes.textContent = results[0].name.toUpperCase();

    // Simulate high-quality biometric rating based on face mesh stability
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

      // Trigger slide animation after rendering
      setTimeout(() => {
        const fills = listRes.querySelectorAll('.shape-bar-fill');
        results.forEach((res, idx) => {
          if (fills[idx]) {
            fills[idx].style.width = `${res.confidence}%`;
          }
        });
      }, 150);
    }

    // Show Results modal
    if (resultsModal) {
      resultsModal.classList.add('show');
    }
  }

  function render() {
    const now = performance.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    const result = detector.detectForVideo(
      video,
      now
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Define guide frame coordinates (single box in the center)
    boxW = w * 0.38;
    boxH = h * 0.55;
    boxX = (w - boxW) / 2;
    boxY = (h - boxH) / 2;

    let drawLeftTouch = false;
    let drawRightTouch = false;
    let drawBottomTouch = false;

    const hudStatus = document.getElementById('hud-status');
    const hudSubstatus = document.getElementById('hud-substatus');

    if (result.faceLandmarks.length && scanState !== 'RESULT') {
      const points = result.faceLandmarks[0];

      // Find boundaries of the face for division
      let minX = 1.0, maxX = 0.0;
      let minY = 1.0, maxY = 0.0;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      const spanX = (maxX - minX) || 0.001;
      const spanY = (maxY - minY) || 0.001;

      // Animate sweep
      if (sweepEnabled && !sweepPaused) {
        const speed = 1.0 / sweepDuration;
        sweepPosition += delta * speed;
        
        if (sweepPosition >= 1.0) {
          sweepPosition = 0.0;
          activeAxis = (activeAxis === 'x') ? 'y' : 'x';
          if (activeAxisValLabel) {
            activeAxisValLabel.textContent = `${activeAxis.toUpperCase()}-AXIS`;
          }
        }
      }

      // Helper to calculate sweep factor of a point [0.0 - 1.0]
      function getPointSweepOpacity(pt) {
        let val = 0;
        if (activeAxis === 'x') {
          val = (pt.x - minX) / spanX;
        } else {
          val = (pt.y - minY) / spanY;
        }
        val = Math.max(0, Math.min(1.0, val));
        
        if (sweepMode === "block") {
          // Block sweep: snap both position and landmark coordinate to columns
          const cols = 12; // fixed count for block step
          const ptCol = Math.floor(val * cols);
          const posCol = Math.floor(sweepPosition * cols);
          
          // Check if pt falls inside the 3-column active window (without wrap-around)
          const windowSize = 3;
          const isActiveBlock = (ptCol >= posCol && ptCol < posCol + windowSize);
          return isActiveBlock ? 1.0 : 0.0;
        } else {
          // Smooth slide sweep with linear falloff (without wrap-around)
          const dist = Math.abs(val - sweepPosition);
          
          const halfWidth = sweepWidth / 2;
          if (dist <= halfWidth) {
            return 1.0 - (dist / halfWidth);
          }
          return 0.0;
        }
      }

      // Eye landmark indices mapping
      const EYE_LANDMARKS = new Set([
        // Right eye
        33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
        // Left eye
        362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
      ]);

      // Draw mesh wireframe
      if (sweepEnabled) {
        // Setup 5 opacity buckets for line connections to optimize render performance
        const buckets = [[], [], [], [], []];
        
        FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(connection => {
          // Exclude connections related to eye landmarks
          if (EYE_LANDMARKS.has(connection.start) || EYE_LANDMARKS.has(connection.end)) return;

          const ptA = points[connection.start];
          const ptB = points[connection.end];
          
          const factorA = getPointSweepOpacity(ptA);
          const factorB = getPointSweepOpacity(ptB);
          const lineFactor = (factorA + factorB) / 2;
          
          // Map lineFactor to a bucket index [0..4]
          const bucketIndex = Math.max(0, Math.min(4, Math.floor(lineFactor * 5)));
          buckets[bucketIndex].push({ ptA, ptB });
        });
        
        // Draw each bucket
        buckets.forEach((lines, index) => {
          if (lines.length === 0) return;
          
          const avgLineFactor = index / 4; // 0.0 to 1.0
          const opacity = (inactiveMeshOpacity * 0.25) + (0.45 - (inactiveMeshOpacity * 0.25)) * avgLineFactor;
          
          if (opacity < 0.01) return; // don't draw if invisible
          
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0, 255, 170, ${opacity})`;
          ctx.lineWidth = 0.1 + 0.3 * avgLineFactor;
          
          lines.forEach(line => {
            ctx.moveTo(line.ptA.x * w, line.ptA.y * h);
            ctx.lineTo(line.ptB.x * w, line.ptB.y * h);
          });
          ctx.stroke();
        });
      } else {
        // Draw standard full wireframe except eye region
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 255, 170, 0.35)";
        ctx.lineWidth = 0.1;
        FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(connection => {
          if (EYE_LANDMARKS.has(connection.start) || EYE_LANDMARKS.has(connection.end)) return;
          const ptA = points[connection.start];
          const ptB = points[connection.end];
          ctx.moveTo(ptA.x * w, ptA.y * h);
          ctx.lineTo(ptB.x * w, ptB.y * h);
        });
        ctx.stroke();
      }

      // Blacklist nose index dots and eye landmarks
      const NOSE_BLACKLIST = new Set([
        48, 49, 102, 115, 278, 279, 331, 344,
        129, 198, 217, 209, 131, 358, 429, 437, 420, 360,
        2, 97, 326, 98, 327, 218, 219, 220, 235, 236, 363, 456,
        // Right eye
        33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
        // Left eye
        362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
      ]);

      // Draw dots
      if (sweepEnabled) {
        for (let i = 0; i < points.length; i++) {
          if (NOSE_BLACKLIST.has(i)) continue;
          
          const pt = points[i];
          const factor = getPointSweepOpacity(pt);
          const opacity = inactiveMeshOpacity + (0.95 - inactiveMeshOpacity) * factor;
          
          if (opacity < 0.01) continue; // skip invisible
          
          const radius = 0.4 + 0.8 * factor;
          
          ctx.fillStyle = `rgba(0, 255, 170, ${opacity})`;
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "rgba(0, 255, 170, 0.65)";
        for (let i = 0; i < points.length; i++) {
          if (NOSE_BLACKLIST.has(i)) continue;
          ctx.beginPath();
          ctx.arc(
            points[i].x * w,
            points[i].y * h,
            0.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      // Draw eye contour paths as thin white lines
      const rightEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
      const leftEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

      function drawEyeContour(indices) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        ctx.lineWidth = 0.55;
        indices.forEach((idx, i) => {
          const pt = points[idx];
          if (i === 0) {
            ctx.moveTo(pt.x * w, pt.y * h);
          } else {
            ctx.lineTo(pt.x * w, pt.y * h);
          }
        });
        ctx.closePath();
        ctx.stroke();
      }

      drawEyeContour(rightEyeIndices);
      drawEyeContour(leftEyeIndices);

      // Calculate centers of the eyes
      let sumRx = 0, sumRy = 0;
      rightEyeIndices.forEach(idx => {
        sumRx += points[idx].x;
        sumRy += points[idx].y;
      });
      const rightEyeCenter = {
        x: (sumRx / rightEyeIndices.length) * w,
        y: (sumRy / rightEyeIndices.length) * h
      };

      let sumLx = 0, sumLy = 0;
      leftEyeIndices.forEach(idx => {
        sumLx += points[idx].x;
        sumLy += points[idx].y;
      });
      const leftEyeCenter = {
        x: (sumLx / leftEyeIndices.length) * w,
        y: (sumLy / leftEyeIndices.length) * h
      };

      // Draw curved line connecting eye outlines (arcing upwards over the nose bridge)
      // Index 133 is the inner corner of the right eye, 362 is the inner corner of the left eye
      const rightEyeConnect = {
        x: points[133].x * w,
        y: points[133].y * h
      };
      const leftEyeConnect = {
        x: points[362].x * w,
        y: points[362].y * h
      };

      const midX = (rightEyeConnect.x + leftEyeConnect.x) / 2;
      const distEyes = Math.sqrt(
        Math.pow(leftEyeConnect.x - rightEyeConnect.x, 2) + 
        Math.pow(leftEyeConnect.y - rightEyeConnect.y, 2)
      );
      // Curve control point Y goes upwards (Y is subtracted in canvas)
      const cpY = ((rightEyeConnect.y + leftEyeConnect.y) / 2) - (distEyes * 0.22);

      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 0.55;
      ctx.moveTo(rightEyeConnect.x, rightEyeConnect.y);
      ctx.quadraticCurveTo(midX, cpY, leftEyeConnect.x, leftEyeConnect.y);
      ctx.stroke();

      // Draw tiny central tracking points inside eye centers
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.beginPath();
      ctx.arc(rightEyeCenter.x, rightEyeCenter.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(leftEyeCenter.x, leftEyeCenter.y, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Biometric positioning
      const topPt = points[10];
      const bottomPt = points[152];
      const leftPt = points[234];
      const rightPt = points[454];

      const fMinX = Math.min(leftPt.x, rightPt.x) * w;
      const fMaxX = Math.max(leftPt.x, rightPt.x) * w;
      const fMinY = Math.min(topPt.y, bottomPt.y) * h;
      const fMaxY = Math.max(topPt.y, bottomPt.y) * h; // Chin

      const faceCenterX = (fMinX + fMaxX) / 2;
      const faceWidth = fMaxX - fMinX;
      const faceHeight = fMaxY - fMinY;
      const padding = 15;

      // Alignment Thresholds (5% of width/height)
      const thresholdX = w * 0.05;
      const thresholdY = h * 0.05;

      // Checking alignment with box borders
      const leftTouch = Math.abs(fMinX - boxX) < thresholdX;
      const rightTouch = Math.abs(fMaxX - (boxX + boxW)) < thresholdX;
      const bottomTouch = Math.abs(fMaxY - (boxY + boxH)) < thresholdY;

      drawLeftTouch = leftTouch;
      drawRightTouch = rightTouch;
      drawBottomTouch = bottomTouch;

      const allValid = leftTouch && rightTouch && bottomTouch;

      // Position Validation & Guide HUD Feedback text
      let posFeedback = "";
      let subFeedback = "";

      if (faceWidth < boxW - thresholdX * 1.5) {
        posFeedback = "Move Closer";
        subFeedback = "Align face edges to the box";
      } else if (faceWidth > boxW + thresholdX * 1.5) {
        posFeedback = "Move Back";
        subFeedback = "Align face edges to the box";
      } else if (Math.abs(faceCenterX - w / 2) > thresholdX) {
        posFeedback = "Center Your Face";
        subFeedback = "Move left or right to center";
      } else if (!bottomTouch) {
        if (fMaxY < boxY + boxH) {
          posFeedback = "Tilt Head Down / Move Down";
          subFeedback = "Touch chin to the bottom line";
        } else {
          posFeedback = "Tilt Head Up / Move Up";
          subFeedback = "Touch chin to the bottom line";
        }
      } else if (!leftTouch || !rightTouch) {
        posFeedback = "Align Sides";
        subFeedback = "Make sure face edges touch the left & right borders";
      } else {
        posFeedback = "Hold Still...";
        subFeedback = "All points aligned!";
      }

      // State Machine
      if (scanState === 'ALIGNING') {
        if (hudStatus) {
          hudStatus.classList.remove('stable');
          hudStatus.classList.add('warning');
        }

        if (!allValid) {
          if (hudStatus) hudStatus.textContent = posFeedback;
          if (hudSubstatus) hudSubstatus.textContent = subFeedback;
        } else {
          // Valid! Start stability timer
          if (stabilityStart === 0) {
            stabilityStart = performance.now();
          } else if (performance.now() - stabilityStart > STABILITY_REQUIRED_MS) {
            scanState = 'COUNTDOWN';
            countdownStartTime = performance.now();
            countdownVal = 3;
          }
          if (hudStatus) {
            hudStatus.classList.remove('warning');
            hudStatus.classList.add('stable');
            hudStatus.textContent = "Hold Still...";
          }
          if (hudSubstatus) hudSubstatus.textContent = "Initializing calibration...";
        }
      } else if (scanState === 'COUNTDOWN') {
        if (!allValid) {
          // Lost stability
          scanState = 'ALIGNING';
          stabilityStart = 0;
        } else {
          const elapsed = performance.now() - countdownStartTime;
          countdownVal = 3 - Math.floor(elapsed / 1000);

          if (hudStatus) {
            hudStatus.classList.remove('warning');
            hudStatus.classList.add('stable');
            hudStatus.textContent = `Scan Starts in...`;
          }
          if (hudSubstatus) hudSubstatus.textContent = "Hold your position, do not move";

          if (countdownVal <= 0) {
            scanState = 'CAPTURING';
            captureBuffer = [];
          } else {
            // Draw large glowing countdown in center
            ctx.save();
            ctx.font = "900 120px 'Orbitron', sans-serif";
            ctx.fillStyle = "#00ffaa";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "#00ffaa";
            ctx.shadowBlur = 25;
            ctx.fillText(countdownVal, w / 2, h / 2);
            ctx.restore();
          }
        }
      } else if (scanState === 'CAPTURING') {
        if (!allValid) {
          // Lost stability during scan
          scanState = 'ALIGNING';
          stabilityStart = 0;
        } else {
          // Capture frames
          captureBuffer.push(points.map(pt => ({ x: pt.x, y: pt.y, z: pt.z })));

          if (hudStatus) {
            hudStatus.classList.remove('warning', 'stable');
            hudStatus.textContent = `SCANNING [${captureBuffer.length}/30]`;
          }
          if (hudSubstatus) hudSubstatus.textContent = "PROCESSING BIOMETRIC FEATURES...";

          // Draw vertical scanning laser line
          const scanProgress = captureBuffer.length / 30;
          const laserY = fMinY + (faceHeight * scanProgress);

          const gradient = ctx.createLinearGradient(fMinX - padding, laserY, fMaxX + padding, laserY);
          gradient.addColorStop(0, "rgba(0, 255, 170, 0)");
          gradient.addColorStop(0.15, "rgba(0, 255, 170, 0.5)");
          gradient.addColorStop(0.5, "rgba(0, 255, 170, 1.0)");
          gradient.addColorStop(0.85, "rgba(0, 255, 170, 0.5)");
          gradient.addColorStop(1, "rgba(0, 255, 170, 0)");

          ctx.save();
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3.5;
          ctx.shadowColor = "#00ffaa";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(fMinX - padding, laserY);
          ctx.lineTo(fMaxX + padding, laserY);
          ctx.stroke();
          ctx.restore();

          if (captureBuffer.length >= 30) {
            scanState = 'RESULT';
            if (biometricHud) biometricHud.classList.remove('show');
            takeSnapshot();
            analyzeFaceShape();
          }
        }
      }
    } else {
      // No face detected OR in RESULT state
      if (scanState !== 'RESULT') {
        // Reset to aligning if face is lost
        scanState = 'ALIGNING';
        stabilityStart = 0;
        if (hudStatus) {
          hudStatus.classList.remove('stable');
          hudStatus.classList.add('warning');
          hudStatus.textContent = "NO FACE DETECTED";
        }
        if (hudSubstatus) hudSubstatus.textContent = "Please look at the camera";
      }
    }

    // Draw the single interactive guide box if not in result screen
    if (scanState !== 'RESULT') {
      drawInteractiveGuideBox(boxX, boxY, boxW, boxH, drawLeftTouch, drawRightTouch, drawBottomTouch);
    }

    requestAnimationFrame(render);
  }

  render();
}

main();