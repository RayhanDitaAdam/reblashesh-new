let storeState = {
  sweepEnabled: true,
  outlineShape: 'diamond',
  sweepMode: 'smooth',
  sweepWidth: 0.25,
  inactiveMeshOpacity: 0.15,
  skullExtension: 0.45,
  diamondWidthScale: 0.20,
  diamondHeightScale: 0.20,
  sweepDuration: 1.5,
  
  // Dynamic Animation states
  sweepPosition: 0.0,
  activeAxis: 'x',
  sweepPaused: false,
  
  // Biometric State Machine states
  scanState: 'ALIGNING', // 'ALIGNING', 'COUNTDOWN', 'CAPTURING', 'RESULT'
  countdownVal: 3,
  countdownStartTime: 0,
  stabilityStart: 0,
  captureBuffer: [],
};

const subscribers = new Set();

export function getState() {
  return storeState;
}

export function subscribe(callback) {
  subscribers.add(callback);
  // Return cleanup unsubscribe function
  return () => subscribers.delete(callback);
}

export function setState(changes) {
  storeState = { ...storeState, ...changes };
  subscribers.forEach(callback => callback(storeState));
}

export function resetState() {
  setState({
    sweepEnabled: true,
    outlineShape: 'diamond',
    sweepMode: 'smooth',
    sweepWidth: 0.25,
    inactiveMeshOpacity: 0.15,
    skullExtension: 0.45,
    diamondWidthScale: 0.20,
    diamondHeightScale: 0.20,
    sweepDuration: 1.5,
    sweepPosition: 0.0,
    activeAxis: 'x',
    sweepPaused: false,
    scanState: 'ALIGNING',
    countdownVal: 3,
    countdownStartTime: 0,
    stabilityStart: 0,
    captureBuffer: []
  });
}
