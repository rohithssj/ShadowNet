const CURRENT_YEAR = new Date().getFullYear();

function predictFutureRisk(device) {
  const yearsSincePatch = CURRENT_YEAR - device.last_patch_year;

  if (yearsSincePatch >= 5 && yearsSincePatch < 8) {
    return "⚠ Approaching Critical Risk (Patch aging)";
  }

  if (
    device.os.includes("2008") ||
    device.os.includes("2012")
  ) {
    return "⚠ OS Nearing End-of-Life";
  }

  return null;
}

export default predictFutureRisk;