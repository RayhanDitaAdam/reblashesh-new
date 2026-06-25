import { createDetector } from "./utils/detector.js";
import { setupCamera } from "./components/Camera.js";
import { updateProgress, hideLoader } from "./components/Loader.js";
import { updateBiometricStatus, showBiometricHud } from "./components/BiometricStatus.js";
import { setCapturedPhoto, analyzeAndShowResults, bindRestartButton } from "./components/ResultsModal.js";
import { initControlPanel } from "./components/ControlPanel.js";
import { getState, setState, subscribe } from "./state/store.js";
import { calculateContainerBounds, calculateHairPoints, calculateMidHairPoints } from "./utils/geometry.js";
import {
  drawFaceMesh,
  drawLandmarkDots,
  drawEyeContoursAndBridge,
  drawFullHeadOutline,
  drawFaceOvalContour,
  drawHairGrid,
  drawStaticHairGrid,
  drawHairDots
} from "./components/Renderer.js";

async function main() {
  let trackingInitialized = false;
  let trackingStartTime = 0;
  let isReadyToStart = false;
  let clickTriggered = false;

  function startScanner() {
    if (trackingInitialized) return;
    trackingInitialized = true;
    trackingStartTime = performance.now();

    // Select random outline shape at the start of scan
    const shapes = ['diamond', 'square', 'round', 'oval', 'heart'];
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    setState({ outlineShape: randomShape });

    const bgImg = document.getElementById("bg-image");
    if (bgImg) {
      bgImg.style.display = "none";
      bgImg.remove();
    }
  }

  // Register click handler synchronously at the very beginning of main()
  document.body.addEventListener("click", () => {
    clickTriggered = true;
    if (isReadyToStart) {
      startScanner();
    }
  });

  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  updateProgress(10);

  // 1. Setup Camera webcam
  try {
    updateProgress(20);
    await setupCamera(video, () => updateProgress(40));
  } catch (err) {
    console.error("Camera access failed:", err);
    updateProgress(0);
    const loadPercent = document.getElementById('load-percent');
    if (loadPercent) loadPercent.textContent = "ERR";
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // 2. Setup MediaPipe Face Detector
  let detector;
  try {
    detector = await createDetector((pct) => updateProgress(pct));
  } catch (err) {
    console.error("Model loading failed:", err);
    updateProgress(0);
    const loadPercent = document.getElementById('load-percent');
    if (loadPercent) loadPercent.textContent = "ERR";
    return;
  }

  updateProgress(100);

  // 3. Hide loading UX and open Biometrics HUD
  hideLoader();
  showBiometricHud(true);

  // 4. Initialize Config panel bindings
  initControlPanel();

  // Setup dynamic HUD text overlay subscribers
  function updateHUDTexts(state) {
    const hudTopRight = document.getElementById("hud-top-right");
    const hudDetect = document.getElementById("hud-detect");
    if (hudTopRight) {
      hudTopRight.textContent = `SHAPE : ${state.outlineShape.toUpperCase()}`;
    }
    if (hudDetect) {
      hudDetect.textContent = `DETECT : EYE, ${state.outlineShape.toUpperCase()}, DEFAULT`;
    }
  }

  subscribe(updateHUDTexts);
  updateHUDTexts(getState());

  // Mark scanner setup as ready and automatically start if user has already clicked
  isReadyToStart = true;
  if (clickTriggered) {
    startScanner();
  }

  // 5. Setup Analysis Restart binding callback
  bindRestartButton(() => {
    setState({
      scanState: 'ALIGNING',
      countdownVal: 3,
      countdownStartTime: 0,
      stabilityStart: 0,
      captureBuffer: []
    });
    showBiometricHud(true);
  });

  // Guide box crop helper
  function takeSnapshot(boxX, boxY, boxW, boxH) {
    const w = canvas.width;
    const h = canvas.height;

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = boxW;
    captureCanvas.height = boxH;
    const captureCtx = captureCanvas.getContext("2d");

    // Mirror snapshot
    captureCtx.translate(boxW, 0);
    captureCtx.scale(-1, 1);

    const srcX = w - boxX - boxW;

    try {
      captureCtx.drawImage(
        video,
        srcX, boxY, boxW, boxH,
        0, 0, boxW, boxH
      );

      const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.95);
      setCapturedPhoto(dataUrl);
    } catch (e) {
      console.error("Failed to capture snapshot:", e);
    }
  }

  // Animation frame vars
  let lastFrameTime = performance.now();

  // 6. Frame Animation Loop
  function render() {
    const now = performance.now();
    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    const state = getState();
    const result = detector.detectForVideo(video, now);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Center alignment box guide box dimensions
    const boxW = w * 0.38;
    const boxH = h * 0.55;
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;

    let drawLeftTouch = false;
    let drawRightTouch = false;
    let drawBottomTouch = false;

    if (trackingInitialized && result.faceLandmarks.length) {
      const points = result.faceLandmarks[0];
      const faceCenterRef = points[9] || points[168];

      // Check if we are still in the initial scanning phase (X and Y sweep cycles)
      const scanPhaseDuration = state.sweepDuration * 2;
      const elapsed = trackingInitialized ? (now - trackingStartTime) / 1000 : 0;
      const inScanPhase = trackingInitialized && (elapsed <= scanPhaseDuration);

      // Build an overridden state for drawing calls to disable sweep and draw natural shapes during scan
      const drawState = {
        ...state,
        sweepEnabled: state.sweepEnabled && inScanPhase,
        outlineShape: inScanPhase ? 'natural' : state.outlineShape
      };

      // Calculate Extended head coordinates & borders
      const containerBounds = calculateContainerBounds(
        points,
        faceCenterRef,
        state.diamondWidthScale,
        state.diamondHeightScale,
        state.skullExtension
      );

      const hairPoints = calculateHairPoints(
        points,
        faceCenterRef,
        containerBounds,
        drawState.outlineShape,
        state.skullExtension,
        state.diamondHeightScale
      );

      const midHairPoints = calculateMidHairPoints(
        points,
        faceCenterRef,
        hairPoints,
        drawState.outlineShape,
        state.skullExtension
      );

      // Bounds calculations for Sweep Opacities
      let minX = 1.0, maxX = 0.0;
      let minY = 1.0, maxY = 0.0;
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      hairPoints.forEach(pt => {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      });
      const boundsSweep = {
        minX,
        maxX,
        minY,
        maxY,
        spanX: (maxX - minX) || 0.001,
        spanY: (maxY - minY) || 0.001
      };

      // Update Sweep Positions ONLY during the scan phase
      if (inScanPhase && state.sweepEnabled && !state.sweepPaused) {
        let nextPos = state.sweepPosition + delta * (1.0 / state.sweepDuration);
        let nextAxis = state.activeAxis;
        if (nextPos >= 1.0) {
          nextPos = 0.0;
          nextAxis = (state.activeAxis === 'x') ? 'y' : 'x';
        }
        setState({ sweepPosition: nextPos, activeAxis: nextAxis });
      }

      // Calculate delay/fade-in for geometric shapes after initial sweep scan completes
      let shapesRevealFactor = 0;
      if (trackingInitialized && !inScanPhase) {
        shapesRevealFactor = Math.min(1.0, (elapsed - scanPhaseDuration) / 1.0); // 1.0s fade-in
      }

      // Sync HTML overlays opacity with shapesRevealFactor
      const overlays = document.getElementById("hud-text-overlays");
      if (overlays) {
        overlays.style.opacity = shapesRevealFactor;
      }

      // Drawing Calls
      const landmarkOpacity = 1.0 - shapesRevealFactor;
      if (landmarkOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = landmarkOpacity;
        drawFaceMesh(ctx, points, drawState, boundsSweep, w, h);
        drawLandmarkDots(ctx, points, drawState, boundsSweep, w, h);
        ctx.restore();
      }

      // Draw outer face shape, eyes, bridge, and under-eye lines only after the first sweep cycle
      if (shapesRevealFactor > 0) {
        ctx.save();
        ctx.globalAlpha = shapesRevealFactor;
        drawFullHeadOutline(ctx, points, containerBounds, hairPoints, state.outlineShape, w, h);
        drawEyeContoursAndBridge(ctx, points, w, h);
        ctx.restore();
      }

    }

    requestAnimationFrame(render);
  }

  render();
}

main();