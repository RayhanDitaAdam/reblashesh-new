export const foreheadIndices = [
  234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454
];

export const jawIndices = [
  454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234
];

export const EYE_LANDMARKS = new Set([
  // Right eye
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  // Left eye
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
]);

export const NOSE_BLACKLIST = new Set([
  48, 49, 102, 115, 278, 279, 331, 344,
  129, 198, 217, 209, 131, 358, 429, 437, 420, 360,
  2, 97, 326, 98, 327, 218, 219, 220, 235, 236, 363, 456,
  // Right eye
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  // Left eye
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
]);

// Calculates standard and stretched face bounding boxes
export function calculateContainerBounds(points, faceCenterRef, diamondWidthScale, diamondHeightScale, skullExtension) {
  const leftPtOriginal = points[234];
  const rightPtOriginal = points[454];
  const topPtOriginal = points[10];
  const bottomPtOriginal = points[152];

  const containerLeft = {
    x: leftPtOriginal.x + (leftPtOriginal.x - faceCenterRef.x) * diamondWidthScale,
    y: leftPtOriginal.y + (leftPtOriginal.y - faceCenterRef.y) * diamondWidthScale,
    z: leftPtOriginal.z + (leftPtOriginal.z - faceCenterRef.z) * diamondWidthScale
  };
  const containerRight = {
    x: rightPtOriginal.x + (rightPtOriginal.x - faceCenterRef.x) * diamondWidthScale,
    y: rightPtOriginal.y + (rightPtOriginal.y - faceCenterRef.y) * diamondWidthScale,
    z: rightPtOriginal.z + (rightPtOriginal.z - faceCenterRef.z) * diamondWidthScale
  };
  const containerTop = {
    x: topPtOriginal.x + (topPtOriginal.x - faceCenterRef.x) * (skullExtension + diamondHeightScale * 1.5),
    y: topPtOriginal.y + (topPtOriginal.y - faceCenterRef.y) * (skullExtension + diamondHeightScale * 1.5),
    z: topPtOriginal.z + (topPtOriginal.z - faceCenterRef.z) * (skullExtension + diamondHeightScale * 1.5)
  };
  const containerBottom = {
    x: bottomPtOriginal.x + (bottomPtOriginal.x - faceCenterRef.x) * (diamondHeightScale * 0.4),
    y: bottomPtOriginal.y + (bottomPtOriginal.y - faceCenterRef.y) * (diamondHeightScale * 0.4),
    z: bottomPtOriginal.z + (bottomPtOriginal.z - faceCenterRef.z) * (diamondHeightScale * 0.4)
  };

  const cx = (containerLeft.x + containerRight.x) / 2;
  const cy = (containerTop.y + containerBottom.y) / 2;
  const rx = (containerRight.x - containerLeft.x) / 2;
  const ry = (containerBottom.y - containerTop.y) / 2;

  return { containerLeft, containerRight, containerTop, containerBottom, cx, cy, rx, ry };
}

// Maps forehead points onto shapes
export function calculateHairPoints(points, faceCenterRef, bounds, outlineShape, skullExtension, diamondHeightScale) {
  const { containerLeft, containerRight, containerTop, containerBottom, cx, cy, rx, ry } = bounds;

  return foreheadIndices.map((idx, i) => {
    const pt = points[idx];
    
    if (outlineShape === 'natural') {
      const distToCenter = {
        x: pt.x - faceCenterRef.x,
        y: pt.y - faceCenterRef.y,
        z: pt.z - faceCenterRef.z
      };
      return {
        x: pt.x + distToCenter.x * skullExtension,
        y: pt.y + distToCenter.y * skullExtension,
        z: pt.z + distToCenter.z * skullExtension
      };
    }
    else if (outlineShape === 'diamond') {
      if (i <= 8) {
        const t = i / 8;
        return {
          x: containerLeft.x + (containerTop.x - containerLeft.x) * t,
          y: containerLeft.y + (containerTop.y - containerLeft.y) * t,
          z: containerLeft.z + (containerTop.z - containerLeft.z) * t
        };
      } else {
        const t = (i - 8) / 8;
        return {
          x: containerTop.x + (containerRight.x - containerTop.x) * t,
          y: containerTop.y + (containerRight.y - containerTop.y) * t,
          z: containerTop.z + (containerRight.z - containerTop.z) * t
        };
      }
    } 
    else if (outlineShape === 'square') {
      const scaleFactor = 0.82;
      const srx = rx * scaleFactor;
      const sry = ry * scaleFactor;
      
      const sLeft = { x: cx - srx, y: cy, z: containerLeft.z };
      const sRight = { x: cx + srx, y: cy, z: containerRight.z };
      const sTopLeft = { x: cx - srx, y: cy - sry, z: containerLeft.z };
      const sTopRight = { x: cx + srx, y: cy - sry, z: containerRight.z };

      if (i <= 4) {
        const t = i / 4;
        return {
          x: sLeft.x,
          y: sLeft.y + (sTopLeft.y - sLeft.y) * t,
          z: sLeft.z + (sTopLeft.z - sLeft.z) * t
        };
      } else if (i <= 12) {
        const t = (i - 4) / 8;
        return {
          x: sTopLeft.x + (sTopRight.x - sTopLeft.x) * t,
          y: sTopLeft.y,
          z: sTopLeft.z + (sTopRight.z - sTopLeft.z) * t
        };
      } else {
        const t = (i - 12) / 4;
        return {
          x: sTopRight.x,
          y: sTopRight.y + (sRight.y - sTopRight.y) * t,
          z: sTopRight.z + (sRight.z - sTopRight.z) * t
        };
      }
    } 
    else if (outlineShape === 'round') {
      const t = Math.PI - (i / 16) * Math.PI;
      return {
        x: cx + rx * Math.cos(t),
        y: cy - rx * Math.sin(t), // Perfect circle using rx
        z: pt.z
      };
    } 
    else if (outlineShape === 'oval') {
      const t = Math.PI - (i / 16) * Math.PI;
      return {
        x: cx + rx * Math.cos(t),
        y: cy - ry * Math.sin(t), // Perfect vertical ellipse (lonjong) using rx and ry
        z: pt.z
      };
    }
    else if (outlineShape === 'heart') {
      const t = -Math.PI / 2 + (i / 16) * Math.PI;
      const hx = Math.sin(t) ** 3;
      const hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
      const normY = (hy + 1.06) / 1.61;
      
      const heartWidthScale = 0.90; // Widened sides from 0.82 to 0.90
      const heartHeightScale = 0.80;
      const hrx = rx * heartWidthScale;
      const hry = ry * heartHeightScale;
      const yShift = hry * 0.12; // Shifted position downwards

      let ly = hry - 2 * hry * normY;
      if (ly > 0) {
        ly = ly * 1.15; // Stretch bottom part downwards
      }
      
      return {
        x: cx + hrx * hx,
        y: cy + yShift + ly,
        z: pt.z
      };
    } 
    else {
      // fallback
      return pt;
    }
  });
}

// Maps intermediate grid lines
export function calculateMidHairPoints(points, faceCenterRef, hairPoints, outlineShape, skullExtension) {
  return foreheadIndices.map((idx, i) => {
    const pt = points[idx];
    const extPt = hairPoints[i];
    return {
      x: pt.x + (extPt.x - pt.x) * 0.5,
      y: pt.y + (extPt.y - pt.y) * 0.5,
      z: pt.z + (extPt.z - pt.z) * 0.5
    };
  });
}
