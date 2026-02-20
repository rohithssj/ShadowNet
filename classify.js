// Import your devices JSON
const devices = require('./devices.json')
// Mapping table for device type classification
const deviceTypeRules = [
  { name: "Domain Controller", ports: [53, 88], protocol: "LDAP" },
  { name: "Legacy Windows Server", ports: [445], protocol: "SMBv1" },
  { name: "Network Printer", ports: [9100] },
  { name: "Linux Server", ports: [22] },
  { name: "Application Server", ports: [8080, 8081, 8443] },
  { name: "Backup Server", ports: [21, 22] },
  { name: "Firewall Appliance", ports: [443], protocol: "HTTPS" },
  { name: "CCTV Camera", ports: [554] },
  { name: "IoT Sensor", ports: [1883], protocol: "MQTT" },
  { name: "Kiosk", ports: [3389], protocol: "RDP" },
  { name: "Email Server", ports: [25, 110, 143] },
  { name: "GIS Server", ports: [5432], protocol: "PostgreSQL" },
  { name: "Document Scanner", ports: [8082] }
];

// Function to classify device type using mapping table
function classifyDeviceType(device) {
  for (const rule of deviceTypeRules) {
    // Check ports
    const portsMatch = rule.ports.every(port => Array.isArray(device.open_ports) && device.open_ports.includes(port));    // Check protocol if defined
    const protocolMatch = !rule.protocol || (device.protocol && device.protocol.includes(rule.protocol));
    if (portsMatch && protocolMatch) return rule.name;
  }
  return "Unknown Device";
}

// Function to classify lifecycle status
function classifyLifecycle(device) {
  let osYear;

  // Try to extract 4-digit year from OS
  const match = device.os ? device.os.match(/\d{4}/) : null;
  if (match) osYear = parseInt(match[0]);
  // Fallback to last_patch_year if no year in OS
  else if (device.last_patch_year) osYear = device.last_patch_year;
  // Conservative default for unknown devices
  else osYear = 2010;

  if (osYear < 2015) return "Legacy";
  else if (osYear >= 2015 && osYear <= 2020) return "Aging";
  else return "Modern";
}

// Function to check deprecated protocols
function checkDeprecatedProtocol(device) {
  const deprecated = ["SMBv1", "TLS1.0"];
  return deprecated.some(proto => device.protocol && device.protocol.includes(proto));}

// Main classification function
function classifyDevices(devices) {
  return devices.map(device => ({
    ...device,
    deviceType: classifyDeviceType(device),
    lifecycleStatus: classifyLifecycle(device),
    deprecatedProtocol: checkDeprecatedProtocol(device)
  }));
}

// Run classification
const classifiedDevices = classifyDevices(devices);
console.log(classifiedDevices);