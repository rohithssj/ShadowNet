// ═══════════════════════════════════════════════════════════
// report_engine.js — DELEGATES TO CENTRAL ENGINE (engines.js)
// ═══════════════════════════════════════════════════════════
// This file no longer contains independent report/counting logic.
// All metrics are computed by ShadowEngines.generateReport().
// ═══════════════════════════════════════════════════════════

/**
 * Generate a summary report from processed devices.
 * Delegates entirely to the central ShadowEngines module.
 * @param {Array} processedDevices - Devices already processed by ShadowEngines
 * @returns {Object} Full report with riskDist, securityScore, exposureIndex, etc.
 */
function generateSummary(processedDevices) {
  return ShadowEngines.generateReport(processedDevices);
}

// Node.js / ES module export (if used outside browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = generateSummary;
}