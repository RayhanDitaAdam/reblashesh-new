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

  function render() {
    const result = detector.detectForVideo(
      video,
      performance.now()
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (result.faceLandmarks.length) {
      const points = result.faceLandmarks[0];

      // Jaring wajah dinamis (Tesselation) menggunakan utilitas resmi MediaPipe
      drawingUtils.drawConnectors(
        points,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        {
          color: "#00ffaa",
          lineWidth: 0.1,
        }
      );

      // Blacklist indeks lubang hidung & sayap hidung bawah agar tidak menumpuk dot-nya
      const NOSE_BLACKLIST = new Set([
        48, 49, 102, 115, 278, 279, 331, 344, 
        129, 198, 217, 209, 131, 358, 429, 437, 420, 360,
        2, 97, 326, 98, 327, 218, 219, 220, 235, 236, 363, 456
      ]);

      // Titik kecil dengan ukuran 0.5px (lewati area lubang hidung)
      ctx.fillStyle = "#00ffaa";
      for (let i = 0; i < points.length; i++) {
        if (NOSE_BLACKLIST.has(i)) continue;

        ctx.beginPath();
        ctx.arc(
          points[i].x * canvas.width,
          points[i].y * canvas.height,
          0.5,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // =========================================================================
      // DYNAMIC LASER SCAN OVERLAY
      // =========================================================================
      
      // Calculate face bounding box
      let minX = canvas.width, maxX = 0;
      let minY = canvas.height, maxY = 0;
      for (const pt of points) {
        const px = pt.x * canvas.width;
        const py = pt.y * canvas.height;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      
      const faceHeight = maxY - minY;
      const padding = 15;
      
      const scanProgress = (Math.sin(performance.now() * 0.002) + 1) / 2;
      const laserY = minY + (faceHeight * scanProgress);
      
      const gradient = ctx.createLinearGradient(minX - padding, laserY, maxX + padding, laserY);
      gradient.addColorStop(0, "rgba(0, 255, 170, 0)");
      gradient.addColorStop(0.15, "rgba(0, 255, 170, 0.4)");
      gradient.addColorStop(0.5, "rgba(0, 255, 170, 1.0)");
      gradient.addColorStop(0.85, "rgba(0, 255, 170, 0.4)");
      gradient.addColorStop(1, "rgba(0, 255, 170, 0)");
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;
      
      // Optional shadow glowing effect
      ctx.shadowColor = "#00ffaa";
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.moveTo(minX - padding, laserY);
      ctx.lineTo(maxX + padding, laserY);
      ctx.stroke();
      
      // Reset shadow blur
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(render);
  }

  render();
}

main();