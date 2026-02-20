const CURRENT_YEAR = new Date().getFullYear();

function calculateRisk(device) {
  let riskScore = 0;

  const yearsSincePatch = CURRENT_YEAR - device.last_patch_year;

  // Patch age
  if (yearsSincePatch >= 8) {
    riskScore += 4;
  } else if (yearsSincePatch >= 4) {
    riskScore += 2;
  }

  // Uptime
  if (device.uptime_days > 1000) {
    riskScore += 3;
  } else if (device.uptime_days > 500) {
    riskScore += 2;
  }

  // Legacy OS
  if (
    device.os.includes("2003") ||
    device.os.includes("2008") ||
    device.os.includes("Windows 7")
  ) {
    riskScore += 3;
  }

  // Dangerous protocol
  if (device.protocol.includes("SMBv1")) {
    riskScore += 4;
  }

  // Final classification
  if (riskScore >= 8) return "CRITICAL";
  if (riskScore >= 5) return "HIGH";
  if (riskScore >= 3) return "MEDIUM";
  return "LOW";
}

export default calculateRisk;