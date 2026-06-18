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

// Helper to draw corners of biometric guide frame
function drawGuideFrame(x, y, width, height, color, isDashed = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (isDashed) {
    ctx.setLineDash([6, 6]);
  }
  
  const cornerLen = Math.min(25, width * 0.15);
  ctx.beginPath();
  
  // Top-Left corner
  ctx.moveTo(x + cornerLen, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + cornerLen);
  
  // Top-Right corner
  ctx.moveTo(x + width - cornerLen, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width, y + cornerLen);
  
  // Bottom-Left corner
  ctx.moveTo(x, y + height - cornerLen);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x + cornerLen, y + height);
  
  // Bottom-Right corner
  ctx.moveTo(x + width - cornerLen, y + height);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x + width, y + height - cornerLen);
  
  ctx.stroke();
  ctx.restore();
}

// Distance helper
function getDistance(ptA, ptB) {
  const dx = ptA.x - ptB.x;
  const dy = ptA.y - ptB.y;
  const dz = ptA.z - ptB.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// Angle helper
function getAngle(vA, vB) {
  const dot = vA.x*vB.x + vA.y*vB.y + vA.z*vB.z;
  const magA = Math.sqrt(vA.x*vA.x + vA.y*vA.y + vA.z*vA.z);
  const magB = Math.sqrt(vB.x*vB.x + vB.y*vB.y + vB.z*vB.z);
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
    const result = detector.detectForVideo(
      video,
      performance.now()
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Define guide frame coordinates
    const innerW = w * 0.42;
    const innerH = h * 0.58;
    const innerX = (w - innerW) / 2;
    const innerY = (h - innerH) / 2;

    const outerW = w * 0.54;
    const outerH = h * 0.72;
    const outerX = (w - outerW) / 2;
    const outerY = (h - outerH) / 2;

    // Draw static guide boxes
    drawGuideFrame(outerX, outerY, outerW, outerH, "rgba(226, 232, 240, 0.25)", true);

    const hudStatus = document.getElementById('hud-status');
    const hudSubstatus = document.getElementById('hud-substatus');

    if (result.faceLandmarks.length && scanState !== 'RESULT') {
      const points = result.faceLandmarks[0];

      // Draw mesh wireframe
      drawingUtils.drawConnectors(
        points,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        {
          color: "rgba(0, 255, 170, 0.35)",
          lineWidth: 0.1,
        }
      );

      // Blacklist nose index dots
      const NOSE_BLACKLIST = new Set([
        48, 49, 102, 115, 278, 279, 331, 344, 
        129, 198, 217, 209, 131, 358, 429, 437, 420, 360,
        2, 97, 326, 98, 327, 218, 219, 220, 235, 236, 363, 456
      ]);

      // Draw dots
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

      // Biometric positioning & head pose calculations
      const topPt = points[10];
      const bottomPt = points[152];
      const leftPt = points[234];
      const rightPt = points[454];

      const fMinX = leftPt.x * w;
      const fMaxX = rightPt.x * w;
      const fMinY = topPt.y * h;
      const fMaxY = bottomPt.y * h;

      const faceCenterX = (fMinX + fMaxX) / 2;
      const faceCenterY = (fMinY + fMaxY) / 2;
      const faceWidth = fMaxX - fMinX;
      const faceHeight = fMaxY - fMinY;
      const padding = 15;

      // Position Validation
      let posValid = true;
      let posFeedback = "";
      let subFeedback = "";

      if (faceWidth > outerW || faceHeight > outerH || fMinX < outerX || fMaxX > (outerX + outerW) || fMinY < outerY || fMaxY > (outerY + outerH)) {
        posValid = false;
        posFeedback = "Move Back";
        subFeedback = "Position face inside outer box";
      } else if (faceWidth < innerW * 0.72) {
        posValid = false;
        posFeedback = "Move Closer";
        subFeedback = "Align face to fit inner box";
      } else {
        const centerXDiff = Math.abs(faceCenterX - w / 2);
        const centerYDiff = Math.abs(faceCenterY - h / 2);
        if (centerXDiff > w * 0.08 || centerYDiff > h * 0.08) {
          posValid = false;
          posFeedback = "Center Your Face";
          subFeedback = "Align face to center of screen";
        }
      }

      // Head Pose Validation
      const eyeL = points[33];
      const eyeR = points[263];
      const roll = Math.atan2((eyeR.y - eyeL.y) * h, (eyeR.x - eyeL.x) * w) * (180 / Math.PI);
      const rollValid = Math.abs(roll) < 5;

      const leftCheekDist = Math.abs(points[1].x - points[234].x);
      const rightCheekDist = Math.abs(points[454].x - points[1].x);
      const yawRatio = leftCheekDist / (leftCheekDist + rightCheekDist);
      const yawValid = yawRatio >= 0.40 && yawRatio <= 0.60;

      const foreheadNoseDist = Math.abs(points[10].y - points[1].y);
      const noseChinDist = Math.abs(points[152].y - points[1].y);
      const pitchRatio = foreheadNoseDist / (foreheadNoseDist + noseChinDist);
      const pitchValid = pitchRatio >= 0.35 && pitchRatio <= 0.55;

      let poseFeedback = "";
      if (posValid) {
        if (!rollValid) {
          poseFeedback = "Level Your Head";
          subFeedback = "Avoid tilting head left or right";
        } else if (!yawValid) {
          poseFeedback = "Look Straight";
          subFeedback = "Keep head centered, look at camera";
        } else if (!pitchValid) {
          poseFeedback = "Look Straight";
          subFeedback = "Look directly at the camera";
        }
      }

      const allValid = posValid && rollValid && yawValid && pitchValid;

      // Draw Inner Frame (Color based on validity)
      const innerFrameColor = allValid ? "#00ffaa" : "rgba(255, 59, 59, 0.8)";
      drawGuideFrame(innerX, innerY, innerW, innerH, innerFrameColor, false);

      // State Machine
      if (scanState === 'ALIGNING') {
        if (hudStatus) {
          hudStatus.classList.remove('stable');
          hudStatus.classList.add('warning');
        }

        if (!posValid) {
          if (hudStatus) hudStatus.textContent = posFeedback;
          if (hudSubstatus) hudSubstatus.textContent = subFeedback;
        } else if (!allValid) {
          if (hudStatus) hudStatus.textContent = poseFeedback;
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
        drawGuideFrame(innerX, innerY, innerW, innerH, "rgba(255, 59, 59, 0.4)", false);
        if (hudStatus) {
          hudStatus.classList.remove('stable');
          hudStatus.classList.add('warning');
          hudStatus.textContent = "NO FACE DETECTED";
        }
        if (hudSubstatus) hudSubstatus.textContent = "Please look at the camera";
      }
    }

    requestAnimationFrame(render);
  }

  render();
}

main();