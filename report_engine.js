function generateSummary(devices) {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  devices.forEach(device => {
    if (device.risk === "CRITICAL") critical++;
    else if (device.risk === "HIGH") high++;
    else if (device.risk === "MEDIUM") medium++;
    else low++;
  });

  return {
    total: devices.length,
    critical,
    high,
    medium,
    low
  };
}

export default generateSummary;