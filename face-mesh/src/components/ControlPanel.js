import { getState, setState, resetState, subscribe } from "../state/store.js";

export function initControlPanel() {
  const sweepToggle = document.getElementById("sweep-toggle");
  const outlineShapeSelect = document.getElementById("outline-shape");
  const sweepModeSelect = document.getElementById("sweep-mode");
  const sweepWidthSlider = document.getElementById("sweep-width");
  const meshOpacitySlider = document.getElementById("mesh-opacity");
  const skullExtensionSlider = document.getElementById("skull-extension");
  const diamondWidthSlider = document.getElementById("diamond-width");
  const diamondHeightSlider = document.getElementById("diamond-height");
  const sweepDurationSlider = document.getElementById("sweep-duration");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const resetControlsBtn = document.getElementById("reset-controls-btn");

  const widthValLabel = document.getElementById("width-val");
  const opacityValLabel = document.getElementById("opacity-val");
  const extensionValLabel = document.getElementById("extension-val");
  const diamondWidthValLabel = document.getElementById("diamond-width-val");
  const diamondHeightValLabel = document.getElementById("diamond-height-val");
  const durationValLabel = document.getElementById("duration-val");
  const activeAxisValLabel = document.getElementById("active-axis-val");

  function updateUI(state) {
    if (sweepToggle) sweepToggle.checked = state.sweepEnabled;
    if (outlineShapeSelect) outlineShapeSelect.value = state.outlineShape;
    if (sweepModeSelect) sweepModeSelect.value = state.sweepMode;
    
    if (sweepWidthSlider) sweepWidthSlider.value = Math.round(state.sweepWidth * 100);
    if (widthValLabel) widthValLabel.textContent = `${Math.round(state.sweepWidth * 100)}%`;
    
    if (meshOpacitySlider) meshOpacitySlider.value = state.inactiveMeshOpacity * 100;
    if (opacityValLabel) opacityValLabel.textContent = `${Math.round(state.inactiveMeshOpacity * 100)}%`;

    if (skullExtensionSlider) skullExtensionSlider.value = Math.round(state.skullExtension * 100);
    if (extensionValLabel) extensionValLabel.textContent = `${Math.round(state.skullExtension * 100)}%`;

    if (diamondWidthSlider) diamondWidthSlider.value = Math.round(state.diamondWidthScale * 100);
    if (diamondWidthValLabel) diamondWidthValLabel.textContent = `${Math.round(state.diamondWidthScale * 100)}%`;

    if (diamondHeightSlider) diamondHeightSlider.value = Math.round(state.diamondHeightScale * 100);
    if (diamondHeightValLabel) diamondHeightValLabel.textContent = `${Math.round(state.diamondHeightScale * 100)}%`;
    
    if (sweepDurationSlider) sweepDurationSlider.value = Math.round(state.sweepDuration * 10);
    if (durationValLabel) durationValLabel.textContent = `${state.sweepDuration.toFixed(1)}s`;
    
    if (activeAxisValLabel) activeAxisValLabel.textContent = `${state.activeAxis.toUpperCase()}-AXIS`;

    if (playPauseBtn) {
      playPauseBtn.textContent = state.sweepPaused ? "RESUME SCAN" : "PAUSE SCAN";
      playPauseBtn.style.color = state.sweepPaused ? "#ff3b3b" : "#00ffaa";
      playPauseBtn.style.borderColor = state.sweepPaused ? "rgba(255, 59, 59, 0.3)" : "rgba(0, 255, 170, 0.3)";
    }
  }

  // Subscribe component updates to state changes
  subscribe(updateUI);

  // Sync initial configuration UI
  updateUI(getState());

  // Register GUI Input Event Listeners
  if (sweepToggle) {
    sweepToggle.addEventListener("change", (e) => {
      setState({ sweepEnabled: e.target.checked });
    });
  }
  if (outlineShapeSelect) {
    outlineShapeSelect.addEventListener("change", (e) => {
      setState({ outlineShape: e.target.value });
    });
  }
  if (sweepModeSelect) {
    sweepModeSelect.addEventListener("change", (e) => {
      setState({ sweepMode: e.target.value, sweepPosition: 0.0 });
    });
  }
  if (sweepWidthSlider) {
    sweepWidthSlider.addEventListener("input", (e) => {
      setState({ sweepWidth: parseFloat(e.target.value) / 100 });
    });
  }
  if (meshOpacitySlider) {
    meshOpacitySlider.addEventListener("input", (e) => {
      setState({ inactiveMeshOpacity: parseFloat(e.target.value) / 100 });
    });
  }
  if (skullExtensionSlider) {
    skullExtensionSlider.addEventListener("input", (e) => {
      setState({ skullExtension: parseFloat(e.target.value) / 100 });
    });
  }
  if (diamondWidthSlider) {
    diamondWidthSlider.addEventListener("input", (e) => {
      setState({ diamondWidthScale: parseFloat(e.target.value) / 100 });
    });
  }
  if (diamondHeightSlider) {
    diamondHeightSlider.addEventListener("input", (e) => {
      setState({ diamondHeightScale: parseFloat(e.target.value) / 100 });
    });
  }
  if (sweepDurationSlider) {
    sweepDurationSlider.addEventListener("input", (e) => {
      setState({ sweepDuration: parseFloat(e.target.value) / 10 });
    });
  }
  if (playPauseBtn) {
    playPauseBtn.addEventListener("click", () => {
      const { sweepPaused } = getState();
      setState({ sweepPaused: !sweepPaused });
    });
  }
  if (resetControlsBtn) {
    resetControlsBtn.addEventListener("click", () => {
      resetState();
    });
  }
}
