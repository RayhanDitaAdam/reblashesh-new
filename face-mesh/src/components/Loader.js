export function updateProgress(targetPercentage) {
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

export function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
      }, 800);
    }, 1000); // 1s buffer for preloader UX
  }
}
