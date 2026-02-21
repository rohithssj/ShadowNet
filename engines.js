// ═══════════════════════════════════════════════════════════════
// ShadowNet — CENTRAL RISK ENGINE (Single Source of Truth)
// ═══════════════════════════════════════════════════════════════
// ALL risk scoring, classification, and metric computation lives
// here. No other file may perform independent calculations.
// ═══════════════════════════════════════════════════════════════

const ShadowEngines = (() => {
    const CURRENT_YEAR = new Date().getFullYear();

    // ─── Device Type Classification Rules ───
    const deviceTypeRules = [
        { name: "Domain Controller", ports: [53, 88] },
        { name: "Legacy Windows Server", ports: [445] },
        { name: "Network Printer", ports: [9100] },
        { name: "Linux Server", ports: [22] },
        { name: "Application Server", ports: [8080, 8081, 8443] },
        { name: "Backup Server", ports: [21] },
        { name: "Firewall Appliance", ports: [443] },
        { name: "CCTV Camera", ports: [554] },
        { name: "IoT Sensor", ports: [1883] },
        { name: "Kiosk", ports: [3389] },
        { name: "Email Server", ports: [25, 110, 143] },
        { name: "GIS Server", ports: [5432] }
    ];

    // ─── Internal Helpers ───

    function classifyDeviceType(ports) {
        for (const rule of deviceTypeRules) {
            if (rule.ports.every(p => ports.includes(p))) return rule.name;
        }
        return "Unknown Device";
    }

    function parsePorts(raw) {
        if (Array.isArray(raw)) return raw;
        return String(raw).split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    }

    function computeUptimeRisk(uptimeDays) {
        if (uptimeDays > 730) return 80;
        if (uptimeDays > 365) return 50;
        if (uptimeDays > 180) return 25;
        return 10;
    }

    function computePortRisk(ports) {
        if (ports.some(p => [445, 3389, 21, 139].includes(p))) return 90;
        if (ports.some(p => [22, 25, 5900].includes(p))) return 60;
        if (ports.some(p => [443, 3306, 1433].includes(p))) return 40;
        return 20;
    }

    function riskLevelFromScore(score) {
        if (score >= 76) return 'CRITICAL';
        if (score >= 56) return 'HIGH';
        if (score >= 31) return 'MEDIUM';
        return 'LOW';
    }

    function inferBusinessImpact(ports) {
        if (ports.some(p => [443, 3306].includes(p))) return 'CRITICAL';
        if (ports.some(p => [445, 3389].includes(p))) return 'HIGH';
        if (ports.some(p => [22, 25].includes(p))) return 'MEDIUM';
        return 'LOW';
    }

    function generateRecommendation(level) {
        if (level === 'CRITICAL') return 'Immediate patch and isolate';
        if (level === 'HIGH') return 'Urgent update required';
        if (level === 'MEDIUM') return 'Monitor and patch soon';
        return 'Maintain regular updates';
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 1 — processDevice(): Computes EVERYTHING for one device
    // ═══════════════════════════════════════════════════════════
    function processDevice(device) {
        const open_ports = parsePorts(device.open_ports || device.port);
        const uptime_days = parseInt(device.uptime_days || device.uptime) || 0;
        const last_patch_year = parseInt(device.last_patch_year) || CURRENT_YEAR;

        // 1. Lifecycle Age
        const lifecycle_age = CURRENT_YEAR - last_patch_year;

        // 2. Normalized component scores (each 0-100)
        const lifecycle_risk = Math.min((lifecycle_age / 10) * 100, 100);
        const uptime_risk = computeUptimeRisk(uptime_days);
        const port_risk = computePortRisk(open_ports);

        // 3. Weighted Risk Score = (Lifecycle × 0.5) + (Uptime × 0.2) + (Port × 0.3)
        const risk_score = Math.round(
            (lifecycle_risk * 0.5) + (uptime_risk * 0.2) + (port_risk * 0.3)
        );

        // 3. Risk Level
        const risk_level = riskLevelFromScore(risk_score);

        // 4. Forgotten Flag
        const forgotten = uptime_days > 365 && lifecycle_age > 3;

        // 5. Device Type (inferred from ports)
        const device_type = classifyDeviceType(open_ports);

        // 6. Business Impact (inferred from ports)
        const business_impact = inferBusinessImpact(open_ports);

        // 7. Recommendation
        const recommendation = generateRecommendation(risk_level);

        // 8. Future Risk (projected)
        const future_risk_score = Math.min(risk_score + (forgotten ? 10 : 5), 100);
        const future_risk_level = riskLevelFromScore(future_risk_score);

        // 9. Reasons (dynamic and descriptive)
        const dynamicReasons = [];
        if (risk_level === 'CRITICAL' || risk_level === 'HIGH') {
            if (lifecycle_age >= 5) dynamicReasons.push(`Device has not been patched in ${lifecycle_age} years.`);
            else if (lifecycle_age >= 3) dynamicReasons.push("Moderate patch age detected.");

            if (port_risk >= 90) dynamicReasons.push("Exposed high-risk port (445/3389/21/139) detected.");
            else if (port_risk >= 60) dynamicReasons.push("Sensitive service exposed on network.");

            if (uptime_days > 730) dynamicReasons.push(`Extreme uptime detected: ${uptime_days} days without reboot.`);
            else if (uptime_days > 365) dynamicReasons.push("Extended uptime increases system instability risk.");
        } else {
            if (lifecycle_age < 2) dynamicReasons.push("Recently patched and maintained.");
            if (port_risk <= 40) dynamicReasons.push("Low-risk port exposure profile.");
            if (uptime_days <= 180) dynamicReasons.push("System follows regular maintenance cycle.");
        }
        if (dynamicReasons.length === 0) dynamicReasons.push("No significant risks identified in current scan.");

        return {
            ip: device.ip,
            port: device.port,
            protocol: device.protocol,
            last_patch_year,
            uptime_days,
            open_ports,
            lifecycle_age,
            lifecycle_risk,
            uptime_risk,
            port_risk,
            forgotten,
            risk_score,
            risk_percentage: risk_score,
            risk_level,
            business_impact,
            device_type,
            os: device_type,
            recommendation,
            future_risk_percentage: future_risk_score,
            future_risk_level,
            reasons: dynamicReasons,
            location: device.location || 'Network Scan'
        };
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 2 — processDataset(): Batch process + global metrics
    // ═══════════════════════════════════════════════════════════
    function processDataset(rawDevices) {
        // Single loop: process every device once
        const devices = rawDevices.map(d => processDevice(d));

        // Compute global metrics once from processed dataset
        const report = generateReport(devices);

        return { devices, report };
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 3 — generateReport(): Global metrics from processed data
    // ═══════════════════════════════════════════════════════════
    function generateReport(devices) {
        const total = devices.length;
        if (total === 0) {
            return {
                total: 0,
                riskDist: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
                typeDist: {},
                topCritical: [],
                securityScore: 100,
                exposureIndex: 0,
                systemUptime: 100,
                activeAlerts: 0,
                avgResponseTime: 0,
                forgottenDevices: [],
                risksMitigated: 0
            };
        }

        const riskDist = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        const typeDist = {};
        const respTimeMap = { LOW: 48, MEDIUM: 24, HIGH: 8, CRITICAL: 2 };

        let sumInverseRisk = 0;
        let highCritCount = 0;
        let forgottenCount = 0;
        let totalResponseTime = 0;

        // Single pass over already-processed data
        devices.forEach(d => {
            riskDist[d.risk_level]++;
            typeDist[d.device_type] = (typeDist[d.device_type] || 0) + 1;
            sumInverseRisk += (100 - d.risk_score);
            if (d.risk_level === 'HIGH' || d.risk_level === 'CRITICAL') highCritCount++;
            if (d.forgotten) forgottenCount++;
            totalResponseTime += respTimeMap[d.risk_level];
        });

        // 6. Security Score = Average(100 - Risk_Score)
        const securityScore = Math.round(sumInverseRisk / total);

        // 7. Exposure Index = (High + Critical) / Total × 100
        const exposureIndex = Math.round((highCritCount / total) * 100);

        // 8. System Uptime = (Maintained / Total) × 100
        const systemUptime = Math.round(((total - forgottenCount) / total) * 100);

        // 9. Avg Response Time
        const avgResponseTime = (totalResponseTime / total).toFixed(1);

        return {
            total,
            riskDist,
            typeDist,
            topCritical: [...devices].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5),
            securityScore,
            exposureIndex,
            systemUptime,
            activeAlerts: highCritCount,
            avgResponseTime,
            forgottenDevices: devices.filter(d => d.forgotten),
            risksMitigated: riskDist.LOW + riskDist.MEDIUM
        };
    }

    // ═══════════════════════════════════════════════════════════
    // Legacy-compat aliases (used by app.js)
    // ═══════════════════════════════════════════════════════════
    function scanNetwork(rawDevices) {
        return rawDevices.map(d => processDevice(d));
    }

    // ─── Public API ───
    return {
        processDevice,
        processDataset,
        scanNetwork,
        generateReport,
        riskLevelFromScore
    };
})();
