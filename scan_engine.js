// ═══════════════════════════════════════════════════════════
// scan_engine.js — DELEGATES TO CENTRAL ENGINE (engines.js)
// ═══════════════════════════════════════════════════════════
// This file no longer orchestrates independent classify/risk/predict
// steps. The entire pipeline is handled by ShadowEngines.processDataset().
// ═══════════════════════════════════════════════════════════

/**
 * Scan network devices.
 * Single call to the centralized processing pipeline.
 * @param {Array} rawDevices - Array of raw device objects
 * @returns {Object} { devices: [...], report: {...} }
 */
function scanNetwork(rawDevices) {
  return ShadowEngines.processDataset(rawDevices);
}

// Node.js / ES module export (if used outside browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = scanNetwork;
}