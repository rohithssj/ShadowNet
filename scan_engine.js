const devices = require('./devices.json');
import calculateRisk from './risk_engine.js';
import predictFutureRisk from './predictive_engine.js';
import classifyDevices from './classify.js';
import generateSummary from './report_engine.js';

function scanNetwork() {
  console.log("Starting Passive Network Scan...\n");

  // Step 1: classify devices (type, lifecycle, deprecated protocols)
  const classifiedDevices = classifyDevices(devices);

  // Step 2: simulate passive discovery
  const discoveredDevices = classifiedDevices.filter(() => Math.random() < 0.7); // 70% chance to discover

  // Step 3: apply risk and prediction
  const processedDevices = discoveredDevices.map(device => {
    const risk = calculateRisk(device);
    const prediction = predictFutureRisk(device);
    return {
      ...device,
      risk,
      prediction
    };
  });

  // Step 4: generate summary
  const summary = generateSummary(processedDevices);

  return { processedDevices, summary };
}

// Run scan
const result = scanNetwork();
console.log(result.processedDevices);
console.log(result.summary);