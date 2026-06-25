// 3D Distance helper
export function getDistance(ptA, ptB) {
  const dx = ptA.x - ptB.x;
  const dy = ptA.y - ptB.y;
  const dz = ptA.z - ptB.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// 3D Vector Angle helper
export function getAngle(vA, vB) {
  const dot = vA.x * vB.x + vA.y * vB.y + vA.z * vB.z;
  const magA = Math.sqrt(vA.x * vA.x + vA.y * vA.y + vA.z * vA.z);
  const magB = Math.sqrt(vB.x * vB.x + vB.y * vB.y + vB.z * vB.z);
  const cosAngle = dot / (magA * magB);
  // Prevent floating point errors
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}
