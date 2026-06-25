export function updateBiometricStatus(posFeedback, subFeedback, isStable) {
  const hudStatus = document.getElementById('hud-status');
  const hudSubstatus = document.getElementById('hud-substatus');

  if (hudStatus) {
    hudStatus.textContent = posFeedback;
    hudStatus.classList.remove('warning', 'stable');
    hudStatus.classList.add(isStable ? 'stable' : 'warning');
  }
  if (hudSubstatus) {
    hudSubstatus.textContent = subFeedback;
  }
}

export function showBiometricHud(show) {
  const biometricHud = document.getElementById('biometric-hud');
  if (biometricHud) {
    if (show) {
      biometricHud.classList.add('show');
    } else {
      biometricHud.classList.remove('show');
    }
  }
}
