// ═══════════════════════════════════════════════════════════
// classify.js — DELEGATES TO CENTRAL ENGINE (engines.js)
// ═══════════════════════════════════════════════════════════
// This file no longer contains independent classification rules.
// Device type, lifecycle status, and protocol checks are all
// handled by ShadowEngines.processDevice().
// ═══════════════════════════════════════════════════════════

/**
 * Classify an array of devices.
 * Each device is fully processed by the central engine.
 * @param {Array} devices - Array of raw device objects
 * @returns {Array} Array of fully classified and scored devices
 */
function classifyDevices(devices) {
  return devices.map(device => ShadowEngines.processDevice(device));
}

// Node.js / ES module export (if used outside browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = classifyDevices;
}