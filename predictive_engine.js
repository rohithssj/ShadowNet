// ═══════════════════════════════════════════════════════════
// predictive_engine.js — DELEGATES TO CENTRAL ENGINE (engines.js)
// ═══════════════════════════════════════════════════════════
// This file no longer contains independent prediction logic.
// Future risk is computed by ShadowEngines.processDevice() as
// future_risk_percentage and future_risk_level.
// ═══════════════════════════════════════════════════════════

/**
 * Predict future risk for a device.
 * Uses the already-processed risk_score from the central engine.
 * @param {Object} processedDevice - A device already processed by ShadowEngines
 * @returns {Object} { future_risk_percentage, future_risk_level }
 */
function predictFutureRisk(processedDevice) {
  return {
    future_risk_percentage: processedDevice.future_risk_percentage,
    future_risk_level: processedDevice.future_risk_level
  };
}

// Node.js / ES module export (if used outside browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = predictFutureRisk;
}