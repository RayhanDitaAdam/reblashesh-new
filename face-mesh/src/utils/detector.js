import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export async function createDetector(onProgress) {
  if (onProgress) onProgress(50);
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
  );

  if (onProgress) onProgress(70);
  
  // Creep loader width upwards during large file fetch
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
