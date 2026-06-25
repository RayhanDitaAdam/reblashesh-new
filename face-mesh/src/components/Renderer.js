import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { EYE_LANDMARKS, NOSE_BLACKLIST, foreheadIndices, jawIndices } from "../utils/geometry.js";

// Helper to draw interactive guide frame with glowing aligned borders
export function drawInteractiveGuideBox(ctx, x, y, w, h, leftTouch, rightTouch, bottomTouch) {
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

// Helper to calculate sweep factor of a point [0.0 - 1.0]
export function getPointSweepOpacity(pt, state, boundsSweep) {
  const { minX, spanX, minY, spanY } = boundsSweep;
  let val = 0;
  if (state.activeAxis === 'x') {
    val = (pt.x - minX) / spanX;
  } else {
    val = (pt.y - minY) / spanY;
  }
  val = Math.max(0, Math.min(1.0, val));

  if (state.sweepMode === "block") {
    const cols = 12;
    const ptCol = Math.floor(val * cols);
    const posCol = Math.floor(state.sweepPosition * cols);
    const windowSize = 3;
    const isActiveBlock = (ptCol >= posCol && ptCol < posCol + windowSize);
    return isActiveBlock ? 1.0 : 0.0;
  } else {
    const dist = Math.abs(val - state.sweepPosition);
    const halfWidth = state.sweepWidth / 2;
    if (dist <= halfWidth) {
      return 1.0 - (dist / halfWidth);
    }
    return 0.0;
  }
}

// Draws the face mesh connections
export function drawFaceMesh(ctx, points, state, boundsSweep, w, h) {
  if (state.sweepEnabled) {
    const buckets = [[], [], [], [], []];

    FaceLandmarker.FACE_LANDMARKS_TESSELATION.forEach(connection => {
      // Exclude connections related to eye landmarks
      if (EYE_LANDMARKS.has(connection.start) || EYE_LANDMARKS.has(connection.end)) return;

      const ptA = points[connection.start];
      const ptB = points[connection.end];

      const factorA = getPointSweepOpacity(ptA, state, boundsSweep);
      const factorB = getPointSweepOpacity(ptB, state, boundsSweep);
      const lineFactor = (factorA + factorB) / 2;

      const bucketIndex = Math.max(0, Math.min(4, Math.floor(lineFactor * 5)));
      buckets[bucketIndex].push({ ptA, ptB });
    });

    buckets.forEach((lines, index) => {
      if (lines.length === 0) return;
      const avgLineFactor = index / 4;
      const opacity = (state.inactiveMeshOpacity * 0.25) + (0.45 - (state.inactiveMeshOpacity * 0.25)) * avgLineFactor;
      if (opacity < 0.01) return;

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
}

// Draws the landmark dots
export function drawLandmarkDots(ctx, points, state, boundsSweep, w, h) {
  if (state.sweepEnabled) {
    for (let i = 0; i < points.length; i++) {
      if (NOSE_BLACKLIST.has(i)) continue;

      const pt = points[i];
      const factor = getPointSweepOpacity(pt, state, boundsSweep);
      const opacity = state.inactiveMeshOpacity + (0.95 - state.inactiveMeshOpacity) * factor;
      if (opacity < 0.01) continue;

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
      ctx.arc(points[i].x * w, points[i].y * h, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Draws the eye contours and the bridge line
export function drawEyeContoursAndBridge(ctx, points, w, h) {
  const rightEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  const leftEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

  function drawEyeContour(indices) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 180, 255, 0.75)";
    ctx.lineWidth = 0.55;
    ctx.setLineDash([2, 2.5]); // Dashed lines for eye contours
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
    ctx.restore();
  }

  drawEyeContour(rightEyeIndices);
  drawEyeContour(leftEyeIndices);

  // Connection bridge over nose
  const rightEyeConnect = { x: points[159].x * w, y: points[159].y * h };
  const leftEyeConnect = { x: points[386].x * w, y: points[386].y * h };
  const midX = (rightEyeConnect.x + leftEyeConnect.x) / 2;
  const distEyes = Math.sqrt(
    Math.pow(leftEyeConnect.x - rightEyeConnect.x, 2) + 
    Math.pow(leftEyeConnect.y - rightEyeConnect.y, 2)
  );
  const cpY = ((rightEyeConnect.y + leftEyeConnect.y) / 2) - (distEyes * 0.22);

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)"; // Changed to white
  ctx.lineWidth = 0.55;
  ctx.moveTo(rightEyeConnect.x, rightEyeConnect.y);
  ctx.quadraticCurveTo(midX, cpY, leftEyeConnect.x, leftEyeConnect.y);
  ctx.stroke();

  // Draw center "TESTING" text above the white curve bridge
  const curveMidX = midX;
  const curveMidY = ((rightEyeConnect.y + leftEyeConnect.y) / 2 + cpY) / 2;

  ctx.save();
  ctx.fillStyle = "#000000"; // Black text
  ctx.font = "bold 9px 'Orbitron', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.translate(curveMidX, curveMidY - 3);
  ctx.scale(-1, 1);
  ctx.fillText("TESTING", 0, 0);
  ctx.restore();

  // Draw eye centers tracking points
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

  ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; // Changed to white
  ctx.beginPath();
  ctx.arc(rightEyeCenter.x, rightEyeCenter.y, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(leftEyeCenter.x, leftEyeCenter.y, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // --- Draw offset lines under the eyes ---
  const dx = leftEyeCenter.x - rightEyeCenter.x;
  const dy = leftEyeCenter.y - rightEyeCenter.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const hx = dx / len;
  const hy = dy / len;
  // Perpendicular downwards vector
  const vx = -hy;
  const vy = hx;
  const offset = len * 0.08;

  function drawOffsetUnderEyeLine(startIdx, endIdx, isRightEye) {
    const ptStart = points[startIdx];
    const ptEnd = points[endIdx];

    const pxStart = ptStart.x * w + vx * offset;
    const pyStart = ptStart.y * h + vy * offset;
    const pxEnd = ptEnd.x * w + vx * offset;
    const pyEnd = ptEnd.y * h + vy * offset;

    // Draw straight under-eye line (Sea Blue)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 136, 255, 0.85)"; // Sea Blue
    ctx.lineWidth = 1.0;
    ctx.shadowColor = "#0088ff";
    ctx.shadowBlur = 4;
    ctx.moveTo(pxStart, pyStart);
    ctx.lineTo(pxEnd, pyEnd);
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    // Draw arrowhead at the outer corner pointing outward (Sea Blue)
    const angle = Math.atan2(pyEnd - pyStart, pxEnd - pxStart);
    const arrowSize = 4.5;
    
    ctx.save();
    if (isRightEye) {
      ctx.translate(pxStart, pyStart);
      ctx.rotate(angle + Math.PI);
    } else {
      ctx.translate(pxEnd, pyEnd);
      ctx.rotate(angle);
    }
    
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 136, 255, 0.95)"; // Sea Blue
    ctx.lineWidth = 1.25;
    ctx.shadowColor = "#0088ff";
    ctx.shadowBlur = 5;
    ctx.moveTo(-arrowSize, -arrowSize / 1.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-arrowSize, arrowSize / 1.5);
    ctx.stroke();
    ctx.restore();

    // Draw text below the line in black (following face movement)
    const midLineX = (pxStart + pxEnd) / 2;
    const midLineY = (pyStart + pyEnd) / 2;
    
    ctx.save();
    ctx.fillStyle = "#000000"; // Changed to black
    ctx.font = "900 5.2px 'Orbitron', monospace"; // Smaller text (5.2px)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    ctx.translate(midLineX, midLineY + 5.5);
    ctx.scale(-1, 1); // Mirror for normal reading
    ctx.fillText(isRightEye ? "EYE_R_TRK" : "EYE_L_TRK", 0, 0);
    ctx.restore();
  }

  drawOffsetUnderEyeLine(33, 133, true);  // Right eye straight under-eye line
  drawOffsetUnderEyeLine(362, 263, false); // Left eye straight under-eye line

  // --- Connection line in the middle (triangular, Sea Blue: 133 -> 168 -> 362) ---
  const pt133 = points[133];
  const pt362 = points[362];
  const pt168 = points[168];
  const midNoseX = (pt133.x + pt362.x) / 2;
  const midNoseY = (pt133.y + pt362.y) / 2;
  
  const peakX = midNoseX + (pt168.x - midNoseX) * 0.45;
  const peakY = midNoseY + (pt168.y - midNoseY) * 0.45;

  ctx.beginPath();
  ctx.strokeStyle = "rgba(0, 136, 255, 0.85)"; // Sea Blue
  ctx.lineWidth = 1.0;
  ctx.shadowColor = "#0088ff";
  ctx.shadowBlur = 4;
  ctx.moveTo(pt133.x * w, pt133.y * h);
  ctx.lineTo(peakX * w, peakY * h);
  ctx.lineTo(pt362.x * w, pt362.y * h);
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

// Draws the outer boundary outline
export function drawFullHeadOutline(ctx, points, bounds, hairPoints, outlineShape, w, h) {
  const { containerLeft, containerRight, containerTop, containerBottom, cx, cy, rx, ry } = bounds;

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.25;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const angleRad = Math.atan2(containerRight.y - containerLeft.y, containerRight.x - containerLeft.x);

  ctx.translate(cx * w, cy * h);
  ctx.rotate(angleRad);

  if (outlineShape === 'diamond') {
    ctx.moveTo(0, -ry * h);
    ctx.lineTo(rx * w, 0);
    ctx.lineTo(0, ry * h);
    ctx.lineTo(-rx * w, 0);
  } else if (outlineShape === 'square') {
    const scaleFactor = 0.82;
    const srx = rx * scaleFactor;
    const sry = ry * scaleFactor;
    ctx.rect(-srx * w, -sry * h, 2 * srx * w, 2 * sry * h);
  } else if (outlineShape === 'round') {
    ctx.ellipse(0, 0, rx * w, rx * w, 0, 0, Math.PI * 2); // Perfect circle using rx
  } else if (outlineShape === 'oval') {
    ctx.ellipse(0, 0, rx * w, ry * h, 0, 0, Math.PI * 2); // Perfect vertical ellipse (lonjong) using rx and ry
  } else if (outlineShape === 'heart') {
    const heartWidthScale = 0.90; // Widened sides from 0.82 to 0.90
    const heartHeightScale = 0.80;
    const hrx = rx * heartWidthScale;
    const hry = ry * heartHeightScale;
    const yShift = hry * 0.12 * h; // Shifted position downwards

    ctx.save();
    ctx.translate(0, yShift);
    ctx.moveTo(0, hry * h * 1.15); // Stretch bottom start point downwards
    for (let angleVal = -Math.PI; angleVal <= Math.PI; angleVal += 0.05) {
      const hx = Math.sin(angleVal) ** 3;
      const hy = (13 * Math.cos(angleVal) - 5 * Math.cos(2 * angleVal) - 2 * Math.cos(3 * angleVal) - Math.cos(4 * angleVal)) / 16;
      const normY = (hy + 1.06) / 1.61;
      const lx = hrx * w * hx;
      let ly = hry * h - 2 * hry * h * normY;
      if (ly > 0) {
        ly = ly * 1.15; // Stretch bottom part downwards
      }
      ctx.lineTo(lx, ly);
    }
    ctx.restore();
  }

  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Draws the standard/fallback oval outline
export function drawFaceOvalContour(ctx, points, w, h) {
  const faceOvalIndices = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
    400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
    54, 103, 67, 109
  ];

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0, 255, 170, 0.85)";
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.shadowColor = "#00ffaa";
  ctx.shadowBlur = 6;
  faceOvalIndices.forEach((idx, i) => {
    const pt = points[idx];
    if (i === 0) {
      ctx.moveTo(pt.x * w, pt.y * h);
    } else {
      ctx.lineTo(pt.x * w, pt.y * h);
    }
  });
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Draws the hair/skull grid
export function drawHairGrid(ctx, points, hairPoints, midHairPoints, state, boundsSweep, w, h) {
  ctx.save();
  for (let i = 0; i < foreheadIndices.length; i++) {
    const origPt = points[foreheadIndices[i]];
    const midPt = midHairPoints[i];
    const extPt = hairPoints[i];

    const factorA = getPointSweepOpacity(origPt, state, boundsSweep);
    const factorMid = getPointSweepOpacity(midPt, state, boundsSweep);
    const factorB = getPointSweepOpacity(extPt, state, boundsSweep);

    // Row 1 (Forehead to Mid)
    const lineFactor1 = (factorA + factorMid) / 2;
    const opacity1 = (state.inactiveMeshOpacity * 0.25) + (0.45 - (state.inactiveMeshOpacity * 0.25)) * lineFactor1;

    // Row 2 (Mid to Hair)
    const lineFactor2 = (factorMid + factorB) / 2;
    const opacity2 = (state.inactiveMeshOpacity * 0.25) + (0.45 - (state.inactiveMeshOpacity * 0.25)) * lineFactor2;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(0, 255, 170, ${opacity1})`;
    ctx.lineWidth = 0.1 + 0.3 * lineFactor1;
    ctx.moveTo(origPt.x * w, origPt.y * h);
    ctx.lineTo(midPt.x * w, midPt.y * h);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = `rgba(0, 255, 170, ${opacity2})`;
    ctx.lineWidth = 0.1 + 0.3 * lineFactor2;
    ctx.moveTo(midPt.x * w, midPt.y * h);
    ctx.lineTo(extPt.x * w, extPt.y * h);
    ctx.stroke();

    if (i < foreheadIndices.length - 1) {
      const nextOrigPt = points[foreheadIndices[i + 1]];
      const nextMidPt = midHairPoints[i + 1];
      const nextExtPt = hairPoints[i + 1];

      const nextFactorA = getPointSweepOpacity(nextOrigPt, state, boundsSweep);
      const nextFactorMid = getPointSweepOpacity(nextMidPt, state, boundsSweep);
      const nextFactorB = getPointSweepOpacity(nextExtPt, state, boundsSweep);

      // Horizontals
      const hFactorMid = (factorMid + nextFactorMid) / 2;
      const hOpacityMid = (state.inactiveMeshOpacity * 0.25) + (0.45 - (state.inactiveMeshOpacity * 0.25)) * hFactorMid;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 255, 170, ${hOpacityMid})`;
      ctx.lineWidth = 0.1 + 0.3 * hFactorMid;
      ctx.moveTo(midPt.x * w, midPt.y * h);
      ctx.lineTo(nextMidPt.x * w, nextMidPt.y * h);
      ctx.stroke();

      const hFactorExt = (factorB + nextFactorB) / 2;
      const hOpacityExt = (state.inactiveMeshOpacity * 0.25) + (0.45 - (state.inactiveMeshOpacity * 0.25)) * hFactorExt;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 255, 170, ${hOpacityExt})`;
      ctx.lineWidth = 0.1 + 0.3 * hFactorExt;
      ctx.moveTo(extPt.x * w, extPt.y * h);
      ctx.lineTo(nextExtPt.x * w, nextExtPt.y * h);
      ctx.stroke();

      // Diagonals
      const dFactor1 = (factorA + nextFactorMid) / 2;
      const dOpacity1 = (state.inactiveMeshOpacity * 0.25) + (0.45 - (state.inactiveMeshOpacity * 0.25)) * dFactor1;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 255, 170, ${dOpacity1 * 0.7})`;
      ctx.lineWidth = 0.05 + 0.2 * dFactor1;
      ctx.moveTo(origPt.x * w, origPt.y * h);
      ctx.lineTo(nextMidPt.x * w, nextMidPt.y * h);
      ctx.stroke();

      const dFactor2 = (factorMid + nextFactorB) / 2;
      const dOpacity2 = (state.inactiveMeshOpacity * 0.25) + (0.45 - (state.inactiveMeshOpacity * 0.25)) * dFactor2;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(0, 255, 170, ${dOpacity2 * 0.7})`;
      ctx.lineWidth = 0.05 + 0.2 * dFactor2;
      ctx.moveTo(midPt.x * w, midPt.y * h);
      ctx.lineTo(nextExtPt.x * w, nextExtPt.y * h);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Draws the static hair wireframe when sweep is disabled
export function drawStaticHairGrid(ctx, points, hairPoints, midHairPoints, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(0, 255, 170, 0.35)";
  ctx.lineWidth = 0.1;
  for (let i = 0; i < foreheadIndices.length; i++) {
    const origPt = points[foreheadIndices[i]];
    const midPt = midHairPoints[i];
    const extPt = hairPoints[i];

    ctx.beginPath();
    ctx.moveTo(origPt.x * w, origPt.y * h);
    ctx.lineTo(midPt.x * w, midPt.y * h);
    ctx.lineTo(extPt.x * w, extPt.y * h);
    ctx.stroke();

    if (i < foreheadIndices.length - 1) {
      const nextMidPt = midHairPoints[i + 1];
      const nextExtPt = hairPoints[i + 1];
      ctx.beginPath();
      ctx.moveTo(midPt.x * w, midPt.y * h);
      ctx.lineTo(nextMidPt.x * w, nextMidPt.y * h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(extPt.x * w, extPt.y * h);
      ctx.lineTo(nextExtPt.x * w, nextExtPt.y * h);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.fillStyle = "rgba(0, 255, 170, 0.65)";
  for (let i = 1; i < foreheadIndices.length - 1; i++) {
    [midHairPoints[i], hairPoints[i]].forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// Draws dots in the hair/skull grid
export function drawHairDots(ctx, hairPoints, midHairPoints, state, boundsSweep, w, h) {
  ctx.save();
  for (let i = 0; i < foreheadIndices.length; i++) {
    if (i === 0 || i === foreheadIndices.length - 1) continue;

    const midPt = midHairPoints[i];
    const extPt = hairPoints[i];

    [midPt, extPt].forEach(pt => {
      const factor = getPointSweepOpacity(pt, state, boundsSweep);
      const opacity = state.inactiveMeshOpacity + (0.95 - state.inactiveMeshOpacity) * factor;
      if (opacity < 0.01) return;

      const radius = 0.4 + 0.8 * factor;

      ctx.fillStyle = `rgba(0, 255, 170, ${opacity})`;
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}


// Draws the countdown text during stateCOUNTDOWN
export function drawCountdownText(ctx, countdownVal, w, h) {
  ctx.save();
  ctx.font = "900 120px 'Orbitron', sans-serif";
  ctx.fillStyle = "#00ffaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#00ffaa";
  ctx.shadowBlur = 25;
  ctx.translate(w / 2, h / 2);
  ctx.scale(-1, 1);
  ctx.fillText(countdownVal, 0, 0);
  ctx.restore();
}

// Draws the laser scanning line during capturing frames
export function drawScanningLaserLine(ctx, currentFrameIdx, boundsSweep, containerBounds, w, h) {
  const { minX, maxX } = boundsSweep;
  const { containerTop, containerBottom } = containerBounds;
  const padding = 15;

  const fMinX = minX * w;
  const fMaxX = maxX * w;
  const fMinY = containerTop.y * h;
  const fMaxY = containerBottom.y * h;
  const faceHeight = fMaxY - fMinY;

  const scanProgress = currentFrameIdx / 30;
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
}



