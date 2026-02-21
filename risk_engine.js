// ═══════════════════════════════════════════════════════════
// risk_engine.js — DELEGATES TO CENTRAL ENGINE (engines.js)
// ═══════════════════════════════════════════════════════════
// This file no longer contains independent risk logic.
// All calculations are performed by ShadowEngines.processDevice().
// ═══════════════════════════════════════════════════════════

/**
 * Calculate risk for a single device.
 * Delegates entirely to the central ShadowEngines module.
 * @param {Object} device - Raw device object
 * @returns {Object} Fully processed device with risk_score, risk_level, etc.
 */
function calculateRisk(device) {
  return ShadowEngines.processDevice(device);
}

// Node.js / ES module export (if used outside browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = calculateRisk;
}