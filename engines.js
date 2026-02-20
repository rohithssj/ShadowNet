// Shadow Net — Engine Layer (Risk, Predictive, Scan, Report)
const ShadowEngines = (() => {
    const CURRENT_YEAR = new Date().getFullYear();
    const THRESHOLDS = { CRITICAL: 75, HIGH: 50, MEDIUM: 25 };
    const DANGEROUS_PROTOCOLS = ['SMBv1', 'TLS1.0', 'FTP', 'Telnet'];
    const LEGACY_OS_KEYWORDS = ['2003', '2008', 'Windows 7', 'Windows XP'];
    const IMPACT_RULES = {
        CRITICAL: ['Domain Controller', 'Firewall Appliance', 'Email Server', 'Finance Application Server'],
        HIGH: ['Old Database Server', 'HR Management Server', 'Legacy Payroll Server', 'Legacy File Server', 'Old Web Portal Server'],
        MEDIUM: ['Application Server', 'Backup Server', 'GIS Mapping Server', 'Public WiFi Controller', 'Attendance Logging Server']
    };

    // Risk scoring based on patch age, uptime, OS, protocols
    function calculateRiskPercentage(device) {
        let score = 0;
        const MAX_SCORE = 14;
        const yearsSincePatch = CURRENT_YEAR - (device.last_patch_year || CURRENT_YEAR);
        if (yearsSincePatch >= 10) score += 4;
        else if (yearsSincePatch >= 7) score += 3;
        else if (yearsSincePatch >= 4) score += 2;
        else if (yearsSincePatch >= 2) score += 1;
        const uptime = device.uptime_days || 0;
        if (uptime > 1000) score += 3;
        else if (uptime > 500) score += 2;
        else if (uptime > 300) score += 1;
        if (LEGACY_OS_KEYWORDS.some(kw => (device.os || '').toLowerCase().includes(kw.toLowerCase()))) score += 3;
        if (DANGEROUS_PROTOCOLS.some(dp => (device.protocol || '').includes(dp))) score += 4;
        return Math.round((score / MAX_SCORE) * 100);
    }

    function riskLevelFromPercentage(pct) {
        if (pct >= THRESHOLDS.CRITICAL) return 'CRITICAL';
        if (pct >= THRESHOLDS.HIGH) return 'HIGH';
        if (pct >= THRESHOLDS.MEDIUM) return 'MEDIUM';
        return 'LOW';
    }

    function classifyBusinessImpact(device) {
        const type = device.device_type || '';
        for (const [level, types] of Object.entries(IMPACT_RULES)) {
            if (types.some(t => type.includes(t))) return level;
        }
        return 'LOW';
    }

    function isForgotten(device) {
        return (device.uptime_days || 0) > 700 && (CURRENT_YEAR - (device.last_patch_year || CURRENT_YEAR)) > 5;
    }

    // Human-readable reasons for risk score
    function generateReasons(device) {
        const reasons = [];
        const yrs = CURRENT_YEAR - (device.last_patch_year || CURRENT_YEAR);
        if (yrs >= 7) reasons.push(`Not patched in ${yrs} years`);
        else if (yrs >= 4) reasons.push(`Last patched ${yrs} years ago`);
        if ((device.uptime_days || 0) > 1000) reasons.push(`Running ${device.uptime_days} days without restart`);
        else if ((device.uptime_days || 0) > 500) reasons.push(`Uptime ${device.uptime_days} days — infrequent maintenance`);
        if (LEGACY_OS_KEYWORDS.some(kw => (device.os || '').includes(kw))) reasons.push(`Legacy OS: ${device.os}`);
        if (DANGEROUS_PROTOCOLS.some(dp => (device.protocol || '').includes(dp))) reasons.push(`Insecure protocol: ${device.protocol}`);
        if ((device.open_ports || []).length > 3) reasons.push(`${device.open_ports.length} open ports`);
        if (!reasons.length) reasons.push('Meets baseline security requirements');
        return reasons;
    }

    function generateRecommendation(device, riskLevel, forgotten) {
        if (riskLevel === 'CRITICAL') return 'IMMEDIATE: Isolate, patch, and run vulnerability assessment.';
        if (riskLevel === 'HIGH') return 'URGENT: Patch and upgrade protocols within 48 hours.';
        if (forgotten) return 'REVIEW: Validate necessity — decommission or bring into management.';
        if (riskLevel === 'MEDIUM') return 'MONITOR: Schedule patching and review open ports.';
        return 'MAINTAIN: Continue standard monitoring.';
    }

    // Predictive engine — projects future risk
    function predictFutureRisk(pct, impact, forgotten) {
        let future = pct + (forgotten ? 15 : 0) + (impact === 'CRITICAL' ? 10 : 0);
        future = Math.min(future, 100);
        return { future_risk_percentage: future, future_risk_level: riskLevelFromPercentage(future) };
    }

    // Scan engine — processes all devices through the pipeline
    function scanNetwork(rawDevices) {
        return rawDevices.filter(d => d.ip).map(device => {
            const risk_percentage = calculateRiskPercentage(device);
            const risk_level = riskLevelFromPercentage(risk_percentage);
            const business_impact = classifyBusinessImpact(device);
            const forgotten = isForgotten(device);
            const reasons = generateReasons(device);
            const recommendation = generateRecommendation(device, risk_level, forgotten);
            const pred = predictFutureRisk(risk_percentage, business_impact, forgotten);
            return {
                ...device, risk_percentage, risk_level, business_impact, forgotten, reasons, recommendation,
                future_risk_percentage: pred.future_risk_percentage, future_risk_level: pred.future_risk_level
            };
        });
    }

    // Report engine — summary metrics from processed devices
    function generateReport(devices) {
        const total = devices.length;
        const riskDist = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        devices.forEach(d => { riskDist[d.risk_level] = (riskDist[d.risk_level] || 0) + 1; });
        const typeDist = {};
        devices.forEach(d => { typeDist[d.device_type] = (typeDist[d.device_type] || 0) + 1; });
        const topCritical = [...devices].sort((a, b) => b.risk_percentage - a.risk_percentage).slice(0, 5);
        const activeAlerts = devices.filter(d => d.risk_level === 'HIGH' || d.risk_level === 'CRITICAL').length;
        const forgottenDevices = devices.filter(d => d.forgotten);
        const securityScore = total > 0 ? Math.round(devices.reduce((s, d) => s + (100 - d.risk_percentage), 0) / total) : 100;
        const risksMitigated = (riskDist.LOW || 0) + (riskDist.MEDIUM || 0);
        const responseTimeMap = { LOW: 48, MEDIUM: 24, HIGH: 8, CRITICAL: 2 };
        const avgResponseTime = total > 0 ? (devices.reduce((s, d) => s + (responseTimeMap[d.risk_level] || 48), 0) / total).toFixed(1) : 0;
        const systemUptime = total > 0 ? Math.round((devices.filter(d => !d.forgotten).length / total) * 100) : 100;
        return { total, riskDist, typeDist, topCritical, activeAlerts, forgottenDevices, securityScore, risksMitigated, avgResponseTime, systemUptime };
    }

    return { scanNetwork, generateReport, predictFutureRisk, calculateRiskPercentage, riskLevelFromPercentage };
})();
