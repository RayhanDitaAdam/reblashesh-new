export async function setupCamera(videoElement, onLoaded) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true
  });

  videoElement.srcObject = stream;
  videoElement.play();

  return new Promise(resolve => {
    videoElement.onloadedmetadata = () => {
      if (onLoaded) onLoaded();
      resolve();
    };
  });
}
