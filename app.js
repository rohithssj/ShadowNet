// Shadow Net — Main Application (Clock, Router, Pages, Export)

// Global State
const AppState = {
    rawDevices: [], devices: [], report: null,
    alertStates: new Map(), chartInstances: {},
    currentSort: { key: '', dir: 'asc' },
    hasSessionData: false,
    datasetReady: false,
    manualEntryList: [],
    settings: {
        adminName: 'SOC Admin', organization: 'Shadow Net HQ', role: 'Security Analyst',
        riskThreshold: 75, predictionWindow: 2, emailAlerts: true, smsAlerts: false, criticalOnly: false
    }
};

// Boot
document.addEventListener('DOMContentLoaded', async () => {
    initIcons(); initNavbar(); initSearch(); initTheme(); initClock(); initRouter();
});

function runScanEngine() {
    const { devices, report } = ShadowEngines.processDataset(AppState.rawDevices);
    AppState.devices = devices;
    AppState.report = report;
    updateAlertBadge();
}
function initIcons() { if (window.lucide) lucide.createIcons(); }
function refreshIcons() { requestAnimationFrame(() => { if (window.lucide) lucide.createIcons(); }); }

// Navbar & hamburger
function initNavbar() {
    const hamburger = document.getElementById('hamburger-btn');
    const links = document.getElementById('nav-links');
    hamburger.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('.topnav__link').forEach(link => {
        link.addEventListener('click', () => links.classList.remove('open'));
    });
}

// Theme
function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (localStorage.getItem('shadownet-theme') === 'light') { document.body.classList.add('light-mode'); toggle.checked = true; }
    toggle.addEventListener('change', () => {
        document.body.classList.toggle('light-mode', toggle.checked);
        localStorage.setItem('shadownet-theme', toggle.checked ? 'light' : 'dark');
    });
}

// Live clock — updates every second
function initClock() {
    const el = document.getElementById('live-clock');
    function tick() {
        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const d = days[now.getDay()];
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = months[now.getMonth()];
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        el.textContent = `${d} ${dd} ${mm} ${yyyy} | ${hh}:${mi}:${ss}`;
    }
    tick(); setInterval(tick, 1000);
}

// Global search
function initSearch() {
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (!q) { results.classList.remove('visible'); results.innerHTML = ''; return; }
        const matches = AppState.devices.filter(d =>
            [d.ip, d.device_type, d.risk_level, d.business_impact, d.recommendation].some(v => (v || '').toLowerCase().includes(q)));
        if (!matches.length) results.innerHTML = '<div class="search-no-results">No devices found</div>';
        else {
            results.innerHTML = matches.map(d => `
                <div class="search-result-item" data-ip="${d.ip}">
                    <span class="search-result__ip">${d.ip}</span>
                    <span class="search-result__type">${d.device_type}</span>
                    <span class="risk-badge risk-badge--${d.risk_level.toLowerCase()}">${d.risk_level}</span>
                </div>`).join('');
            results.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => { results.classList.remove('visible'); input.value = ''; window.location.hash = '#devices'; });
            });
        }
        results.classList.add('visible');
    });
    document.addEventListener('click', e => { if (!e.target.closest('.topnav__search-wrapper')) results.classList.remove('visible'); });
}

// Alert badge — counts active (non-escalated, non-resolved) HIGH+CRITICAL
function updateAlertBadge() {
    const badge = document.getElementById('alert-badge');
    const n = AppState.devices.filter(d => (d.risk_level === 'HIGH' || d.risk_level === 'CRITICAL') && getAlertStatus(d.ip) === 'active').length;
    badge.textContent = n; badge.style.display = n > 0 ? 'inline-flex' : 'none';
}
function getAlertStatus(ip) {
    const s = AppState.alertStates.get(ip);
    return s ? s.status : 'active';
}

// Router
function initRouter() { window.addEventListener('hashchange', handleRoute); handleRoute(); }
function handleRoute() {
    const hash = (window.location.hash || '#dashboard').replace('#', '');
    const setupPages = ['landing', 'manual-entry', 'upload'];

    // Guard: Redirect if no data and not on a setup page
    if (!AppState.datasetReady && !setupPages.includes(hash)) {
        window.location.hash = '#landing';
        return;
    }

    const content = document.getElementById('content');
    const nav = document.getElementById('topnav');

    // Hide nav on landing and setup if no data
    if (!AppState.datasetReady && (hash === 'landing' || setupPages.includes(hash))) nav.classList.add('topnav--hidden');
    else nav.classList.remove('topnav--hidden');

    Object.values(AppState.chartInstances).forEach(c => c.destroy()); AppState.chartInstances = {};
    document.querySelectorAll('.topnav__link').forEach(l => l.classList.toggle('active', l.dataset.page === hash));
    content.style.animation = 'none'; content.offsetHeight; content.style.animation = '';

    const pages = {
        landing: renderLanding,
        'manual-entry': renderManualEntry,
        upload: renderUpload,
        analytics: renderAnalytics,
        devices: renderDevices,
        alerts: renderAlerts,
        settings: renderSettings
    };

    content.innerHTML = (pages[hash] || renderDashboard)();
    refreshIcons();

    const binds = {
        landing: bindLanding,
        'manual-entry': bindManualEntry,
        upload: bindUpload,
        analytics: bindAnalytics,
        devices: bindDevices,
        alerts: bindAlerts,
        settings: bindSettings
    };
    (binds[hash] || bindDashboard)();
}

// Utilities
function riskBadge(l) { return `<span class="risk-badge risk-badge--${l.toLowerCase()}">${l}</span>`; }
function impactBadge(l) { return `<span class="impact-badge impact-badge--${l.toLowerCase()}">${l}</span>`; }
function animateValue(el, target, dur = 1200) {
    const start = performance.now();
    (function u(t) { const p = Math.min((t - start) / dur, 1); el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target); if (p < 1) requestAnimationFrame(u); })(start);
}
function animateSuffix(el, target, suffix, dur = 1200) {
    const start = performance.now();
    (function u(t) { const p = Math.min((t - start) / dur, 1); el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target) + suffix; if (p < 1) requestAnimationFrame(u); })(start);
}
function heatColor(pct) { return pct >= 75 ? 'rgba(239,68,68,0.35)' : pct >= 50 ? 'rgba(249,115,22,0.3)' : pct >= 25 ? 'rgba(234,179,8,0.25)' : 'rgba(34,197,94,0.18)'; }
function heatText(pct) { return pct >= 75 ? 'var(--clr-critical)' : pct >= 50 ? 'var(--clr-high)' : pct >= 25 ? 'var(--clr-medium)' : 'var(--clr-low)'; }

// Sparkline — draws mini line chart on a small canvas
function drawSparkline(canvasId, data, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = w / 2, ch = h / 2;
    const max = Math.max(...data, 1), min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = cw / (data.length - 1);
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = i * step, y = ch - ((v - min) / range) * (ch - 4) - 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
    // Gradient fill
    ctx.lineTo((data.length - 1) * step, ch); ctx.lineTo(0, ch); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, color.replace(')', ',0.2)').replace('rgb', 'rgba'));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad; ctx.fill();
}


// ─── DASHBOARD (Executive Overview) ───
function renderDashboard() {
    const r = AppState.report;
    const d = AppState.devices;
    const highCrit = r.riskDist.HIGH + r.riskDist.CRITICAL;
    const highRiskPct = r.total ? Math.round((highCrit / r.total) * 100) : 0;
    const avgRisk = d.length ? Math.round(d.reduce((s, x) => s + x.risk_percentage, 0) / d.length) : 0;
    const forgotten = d.filter(x => x.forgotten);
    const forgottenPct = r.total ? Math.round((forgotten.length / r.total) * 100) : 0;
    const maintained = r.total - forgotten.length;

    // Device type sorted descending
    const typeSorted = Object.entries(r.typeDist).sort((a, b) => b[1] - a[1]);
    const top3Pct = r.total ? Math.round(typeSorted.slice(0, 3).reduce((s, e) => s + e[1], 0) / r.total * 100) : 0;
    const dominantType = typeSorted[0] ? typeSorted[0][0] : 'N/A';
    const dominantPct = r.total && typeSorted[0] ? Math.round(typeSorted[0][1] / r.total * 100) : 0;

    const cards = [
        { k: 'info', i: 'shield', v: r.securityScore, l: 'Security Score', suffix: '%' },
        { k: 'critical', i: 'zap', v: r.exposureIndex, l: 'Exposure Index', suffix: '%' },
        { k: 'high', i: 'activity', v: r.systemUptime, l: 'System Uptime', suffix: '%' },
        { k: 'medium', i: 'alert-triangle', v: r.activeAlerts, l: 'Active Alerts' },
        { k: 'low', i: 'clock', v: r.avgResponseTime, l: 'Avg Resp Time', suffix: 'h' }
    ];
    return `
    <div class="page-header">
        <h2 class="page-header__title"><i data-lucide="layout-dashboard"></i> Security Operations Dashboard</h2>
        <div class="page-header__actions">
            <button class="btn btn--primary" id="btn-scan"><i data-lucide="radar"></i> Scan Network</button>
            <div class="dropdown-wrapper">
                <button class="btn btn--outline" id="btn-export"><i data-lucide="download"></i> Export</button>
                <div class="dropdown-menu" id="export-menu">
                    <button class="dropdown-item" id="export-csv"><i data-lucide="file-text"></i> CSV</button>
                    <button class="dropdown-item" id="export-excel"><i data-lucide="file-spreadsheet"></i> Excel</button>
                </div>
            </div>
            <button class="btn btn--outline" id="btn-report"><i data-lucide="file-down"></i> PDF Report</button>
        </div>
    </div>
    <div class="cards-grid">${cards.map((c, idx) => `
        <div class="metric-card metric-card--${c.k}">
            <div class="metric-card__top">
                <div class="metric-card__icon metric-card__icon--${c.k}"><i data-lucide="${c.i}"></i></div>
                ${c.k === 'critical' && c.v > 50 ? '<span class="status-pulse"></span>' : ''}
            </div>
            <p class="metric-card__value" data-count="${c.v}" ${c.suffix ? `data-suffix="${c.suffix}"` : ''}>0</p>
            <p class="metric-card__label">${c.l}</p>
            <canvas class="metric-card__sparkline" id="spark-${idx}"></canvas>
            <div class="metric-card__bar"><span class="metric-card__bar-fill bar-fill--${c.k}" data-pct="${c.v}"></span></div>
        </div>`).join('')}</div>

    <div class="dash-row-2">
        <div class="dash-col dash-col--risk">
            <h3 class="section-title"><i data-lucide="pie-chart"></i> Risk Distribution</h3>
            <div class="chart-card chart-card--donut">
                <div class="donut-wrapper donut-wrapper--lg">
                    <canvas id="chart-risk-donut"></canvas>
                    <div class="donut-center">
                        <span class="donut-center__value">${r.total}</span>
                        <span class="donut-center__label">DEVICES</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="dash-col dash-col--comp">
            <h3 class="section-title"><i data-lucide="bar-chart-3"></i> Device Composition</h3>
            <div class="chart-card"><div class="chart-canvas-wrapper chart-canvas-wrapper--bar"><canvas id="chart-type-bar"></canvas></div></div>
            <p class="chart-summary">Top 3 types = <strong>${top3Pct}%</strong> of fleet. Dominant: <strong>${dominantType}</strong> (${dominantPct}%).</p>
        </div>
    </div>

    <h3 class="section-title section-title--critical"><span class="critical-pulse-dot"></span><i data-lucide="shield-alert"></i> Top 5 Critical Devices</h3>
    <div class="critical-devices-grid">
        ${r.topCritical.map((dev, i) => `
        <div class="crit-device-card">
            <div class="crit-device-card__strip"></div>
            <div class="crit-device-card__body">
                <div class="crit-device-card__header">
                    <span class="crit-device-card__ip">${dev.ip}</span>
                    <span class="crit-device-card__risk-pct">${dev.risk_percentage}%</span>
                </div>
                <div class="crit-device-card__badges">
                    ${riskBadge(dev.risk_level)}
                    ${impactBadge(dev.business_impact)}
                    <span class="crit-device-card__type">${dev.device_type}</span>
                </div>
                <ul class="crit-device-card__reasons" id="crit-reasons-${i}">
                    ${dev.reasons.slice(0, 2).map(r => `<li>${r}</li>`).join('')}
                    ${dev.reasons.length > 2 ? `<li class="crit-reason-more" data-idx="${i}">+${dev.reasons.length - 2} more…</li>` : ''}
                </ul>
                <p class="crit-device-card__rec"><i data-lucide="lightbulb"></i> ${dev.recommendation}</p>
            </div>
        </div>`).join('')}
    </div>`;
}
function bindDashboard() {
    const ff = 'IBM Plex Sans';
    const ttOpts = { backgroundColor: 'rgba(11,15,26,0.95)', titleFont: { family: ff, size: 11 }, bodyFont: { family: ff, size: 12 }, borderColor: 'rgba(56,189,248,0.2)', borderWidth: 1, padding: 10 };
    const r = AppState.report;

    document.querySelectorAll('.metric-card__value[data-count]').forEach(el => animateValue(el, parseInt(el.dataset.count)));
    document.querySelectorAll('.metric-card__bar-fill[data-pct]').forEach(bar => setTimeout(() => bar.style.width = bar.dataset.pct + '%', 300));

    // Sparklines
    const sorted = [...AppState.devices].sort((a, b) => a.risk_percentage - b.risk_percentage);
    const riskVals = sorted.map(d => d.risk_percentage);
    const colors = ['rgb(56,189,248)', 'rgb(239,68,68)', 'rgb(249,115,22)', 'rgb(234,179,8)', 'rgb(34,197,94)'];
    const sparkData = [riskVals,
        sorted.filter(d => d.risk_level === 'CRITICAL').map(d => d.risk_percentage).concat(riskVals.slice(0, 5)),
        sorted.filter(d => d.risk_level === 'HIGH').map(d => d.risk_percentage).concat(riskVals.slice(0, 5)),
        sorted.filter(d => d.risk_level === 'MEDIUM').map(d => d.risk_percentage).concat(riskVals.slice(0, 5)),
        sorted.filter(d => d.risk_level === 'LOW').map(d => d.risk_percentage).concat(riskVals.slice(0, 5))];
    setTimeout(() => { for (let i = 0; i < 5; i++) drawSparkline(`spark-${i}`, sparkData[i].length > 2 ? sparkData[i] : riskVals, colors[i]); }, 200);



    // Donut — clean, legend below, hover-only values
    const rd = r.riskDist;
    AppState.chartInstances.riskDonut = new Chart(document.getElementById('chart-risk-donut'), {
        type: 'doughnut',
        data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [{ data: [rd.CRITICAL, rd.HIGH, rd.MEDIUM, rd.LOW], backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'], borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom', labels: {
                        color: '#7a8599', padding: 18, font: { family: ff, size: 12 }, usePointStyle: true, pointStyleWidth: 10
                    }
                },
                tooltip: { ...ttOpts, callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} devices (${r.total ? Math.round(ctx.raw / r.total * 100) : 0}%)` } }
            }, cutout: '66%'
        }
    });

    // Device type bar — sorted descending, top 8 only
    const typeSorted = Object.entries(r.typeDist).sort((a, b) => b[1] - a[1]).slice(0, 8);
    AppState.chartInstances.typeBar = new Chart(document.getElementById('chart-type-bar'), {
        type: 'bar', data: {
            labels: typeSorted.map(e => e[0].length > 18 ? e[0].slice(0, 16) + '…' : e[0]),
            datasets: [{ data: typeSorted.map(e => e[1]), backgroundColor: 'rgba(56,189,248,0.45)', borderColor: 'rgba(56,189,248,0.7)', borderWidth: 1, borderRadius: 4, hoverBackgroundColor: 'rgba(56,189,248,0.7)' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip: ttOpts },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#7a8599', font: { family: ff, size: 10 } } },
                y: { grid: { display: false }, ticks: { color: '#7a8599', font: { family: ff, size: 10 } } }
            }
        }
    });

    // Buttons
    document.getElementById('btn-scan').addEventListener('click', () => {
        const btn = document.getElementById('btn-scan');
        btn.innerHTML = '<i data-lucide="loader"></i> Scanning…'; btn.classList.add('scanning-pulse'); refreshIcons();
        setTimeout(() => { runScanEngine(); handleRoute(); }, 1500);
    });
    document.getElementById('btn-export').addEventListener('click', e => { e.stopPropagation(); document.getElementById('export-menu').classList.toggle('visible'); });
    document.addEventListener('click', () => document.getElementById('export-menu')?.classList.remove('visible'), { once: true });
    document.getElementById('export-csv')?.addEventListener('click', exportCSV);
    document.getElementById('export-excel')?.addEventListener('click', exportExcel);
    document.getElementById('btn-report').addEventListener('click', generatePDFReport);

    // Critical device expand reasons
    document.querySelectorAll('.crit-reason-more').forEach(el => el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const dev = r.topCritical[idx];
        if (dev) {
            const ul = document.getElementById(`crit-reasons-${idx}`);
            ul.innerHTML = dev.reasons.map(r => `<li>${r}</li>`).join('');
        }
    }));
}


// ─── ANALYTICS (Deep Forensic Insight) ───
function renderAnalytics() {
    const r = AppState.report;
    const d = AppState.devices;
    const avgCurrent = d.length ? Math.round(d.reduce((s, x) => s + x.risk_score, 0) / d.length) : 0;
    const avgFuture = d.length ? Math.round(d.reduce((s, x) => s + x.future_risk_percentage, 0) / d.length) : 0;
    const deltaRisk = avgFuture - avgCurrent;

    const increasing = d.filter(x => x.future_risk_percentage > x.risk_score).length;
    const decreasing = d.filter(x => x.future_risk_percentage < x.risk_score).length;
    const stable = d.filter(x => x.future_risk_percentage === x.risk_score).length;

    const forgotten = d.filter(x => x.forgotten);
    const active = d.filter(x => !x.forgotten);
    const fAvg = forgotten.length ? Math.round(forgotten.reduce((s, x) => s + x.risk_score, 0) / forgotten.length) : 0;
    const aAvg = active.length ? Math.round(active.reduce((s, x) => s + x.risk_score, 0) / active.length) : 0;
    const riskDiff = fAvg > aAvg ? (fAvg - aAvg) : 0;

    const impactCritPct = d.filter(x => x.business_impact === 'CRITICAL' && (x.risk_level === 'HIGH' || x.risk_level === 'CRITICAL')).length;
    const impactCritTotal = d.filter(x => x.business_impact === 'CRITICAL').length;
    const impactHighPct = impactCritTotal ? Math.round(impactCritPct / impactCritTotal * 100) : 0;
    const impacts = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const highestImpact = impacts.find(imp => d.some(x => x.business_impact === imp)) || 'N/A';

    return `
    <div class="page-header"><h2 class="page-header__title"><i data-lucide="bar-chart-3"></i> Security Analytics & Deep Investigation</h2></div>
    <div class="cards-grid">
        <div class="metric-card metric-card--info"><div class="metric-card__top"><div class="metric-card__icon metric-card__icon--info"><i data-lucide="shield"></i></div></div>
            <p class="metric-card__value" data-count="${r.securityScore}">0</p><p class="metric-card__label">Security Score</p></div>
        <div class="metric-card metric-card--low"><div class="metric-card__top"><div class="metric-card__icon metric-card__icon--low"><i data-lucide="check-circle"></i></div></div>
            <p class="metric-card__value" data-count="${r.risksMitigated}">0</p><p class="metric-card__label">Risks Mitigated</p></div>
        <div class="metric-card metric-card--high"><div class="metric-card__top"><div class="metric-card__icon metric-card__icon--high"><i data-lucide="clock"></i></div></div>
            <p class="metric-card__value analytics-resp" data-count="${r.avgResponseTime}">0</p><p class="metric-card__label">Avg Response (hrs)</p></div>
        <div class="metric-card metric-card--purple"><div class="metric-card__top"><div class="metric-card__icon metric-card__icon--purple"><i data-lucide="activity"></i></div></div>
            <p class="metric-card__value" data-count="${r.systemUptime}" data-suffix="%">0</p><p class="metric-card__label">System Uptime</p></div>
    </div>

    <h3 class="section-title"><i data-lucide="layers"></i> Risk by Business Impact</h3>
    <div class="impact-summary-panel">
        <div class="impact-summary__item"><span class="impact-summary__label">Highest Impacted</span><span class="impact-summary__value">${highestImpact}</span></div>
        <div class="impact-summary__item"><span class="impact-summary__label">Critical Devices in High Impact</span><span class="impact-summary__value">${impactHighPct}%</span></div>
        <div class="impact-summary__item"><span class="impact-summary__label">Critical-Impact Assets</span><span class="impact-summary__value">${impactCritTotal}</span></div>
    </div>
    <div class="chart-card chart-card--wide"><div class="chart-canvas-wrapper chart-canvas-wrapper--tall"><canvas id="a-impact-stack"></canvas></div></div>

    <h3 class="section-title"><i data-lucide="history"></i> Lifecycle Risk Correlation</h3>
    <div class="chart-card chart-card--lifecycle"><div class="chart-canvas-wrapper chart-canvas-wrapper--lifecycle"><canvas id="a-lifecycle"></canvas></div></div>
    <p class="chart-insight"><i data-lucide="alert-circle"></i> Forgotten systems show <strong style="color:var(--clr-critical)">${riskDiff}%</strong> higher average risk. Forgotten avg: <strong>${fAvg}%</strong> vs Active avg: <strong style="color:var(--clr-low)">${aAvg}%</strong>. Total: ${forgotten.length} forgotten, ${active.length} maintained.</p>

    <h3 class="section-title"><i data-lucide="trending-up"></i> Risk Escalation Summary</h3>
    <div class="escalation-row">
        <div class="esc-card esc-card--danger"><i data-lucide="trending-up"></i>
            <span class="esc-card__value">${increasing}</span>
            <span class="esc-card__label">Increasing Risk</span><span class="esc-card__arrow">↑</span></div>
        <div class="esc-card esc-card--neutral"><i data-lucide="minus"></i>
            <span class="esc-card__value">${stable}</span>
            <span class="esc-card__label">Stable</span><span class="esc-card__arrow">→</span></div>
        <div class="esc-card esc-card--success"><i data-lucide="trending-down"></i>
            <span class="esc-card__value">${decreasing}</span>
            <span class="esc-card__label">Decreasing Risk</span><span class="esc-card__arrow">↓</span></div>
    </div>

    <h3 class="section-title"><i data-lucide="activity"></i> Risk Trajectory per Device</h3>
    <div class="chart-card trajectory-card">
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;flex-wrap:wrap">
            <span class="chart-card__title" style="margin-bottom:0"><i data-lucide="activity"></i> Current vs Projected Risk</span>
            <span class="delta-badge delta-badge--${deltaRisk > 0 ? 'danger' : 'success'}">Projected: ${deltaRisk >= 0 ? '+' : ''}${deltaRisk}% avg</span>
        </div>
        <div class="chart-canvas-wrapper trajectory-chart-wrapper"><canvas id="a-trend"></canvas></div>
    </div>`;
}

function bindAnalytics() {
    const ff = 'IBM Plex Sans';
    const ttOpts = { backgroundColor: 'rgba(11,15,26,0.95)', titleFont: { family: ff, size: 11 }, bodyFont: { family: ff }, borderColor: 'rgba(56,189,248,0.2)', borderWidth: 1, padding: 10 };
    const r = AppState.report, d = AppState.devices;

    document.querySelectorAll('.metric-card__value[data-count]').forEach(el => {
        if (el.dataset.suffix) animateSuffix(el, parseFloat(el.dataset.count), el.dataset.suffix);
        else if (el.classList.contains('analytics-resp')) animateSuffix(el, parseFloat(el.dataset.count), 'h');
        else animateValue(el, parseInt(el.dataset.count));
    });

    // 1) Risk by Business Impact (stacked bar)
    const impacts = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const riskLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const riskColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
    AppState.chartInstances.aImpact = new Chart(document.getElementById('a-impact-stack'), {
        type: 'bar',
        data: {
            labels: impacts.map(l => l.charAt(0) + l.slice(1).toLowerCase() + ' Impact'),
            datasets: riskLevels.map((rl, i) => ({
                label: rl.charAt(0) + rl.slice(1).toLowerCase(),
                data: impacts.map(imp => d.filter(x => x.business_impact === imp && x.risk_level === rl).length),
                backgroundColor: riskColors[i], borderRadius: 2, borderWidth: 0
            }))
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#7a8599', padding: 16, font: { family: ff }, usePointStyle: true } },
                tooltip: { ...ttOpts, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} devices` } }
            },
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: '#7a8599', font: { family: ff, size: 11 } } },
                y: { stacked: true, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#7a8599', stepSize: 1 } }
            }
        }
    });

    // 2) Lifecycle (forgotten vs active)
    const forgotten = d.filter(x => x.forgotten), active = d.filter(x => !x.forgotten);
    const fAvg = forgotten.length ? Math.round(forgotten.reduce((s, x) => s + x.risk_percentage, 0) / forgotten.length) : 0;
    const aAvg = active.length ? Math.round(active.reduce((s, x) => s + x.risk_percentage, 0) / active.length) : 0;
    const fFut = forgotten.length ? Math.round(forgotten.reduce((s, x) => s + x.future_risk_percentage, 0) / forgotten.length) : 0;
    const aFut = active.length ? Math.round(active.reduce((s, x) => s + x.future_risk_percentage, 0) / active.length) : 0;
    AppState.chartInstances.aLifecycle = new Chart(document.getElementById('a-lifecycle'), {
        type: 'bar',
        data: {
            labels: ['Forgotten Devices', 'Active Devices'],
            datasets: [
                { label: 'Current Avg Risk %', data: [fAvg, aAvg], backgroundColor: ['rgba(239,68,68,0.6)', 'rgba(34,197,94,0.5)'], borderRadius: 6, borderWidth: 0, barPercentage: 0.5 },
                {
                    label: 'Projected Avg Risk %', data: [fFut, aFut], backgroundColor: ['rgba(239,68,68,0.25)', 'rgba(34,197,94,0.2)'], borderRadius: 6, borderWidth: 1,
                    borderColor: ['rgba(239,68,68,0.5)', 'rgba(34,197,94,0.4)'], borderDash: [4, 3], barPercentage: 0.5
                }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#7a8599', padding: 16, font: { family: ff } } },
                tooltip: { ...ttOpts, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}%` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#7a8599', font: { family: ff } } },
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#7a8599', callback: v => v + '%' }, min: 0, max: 100 }
            }
        }
    });

    // 3) Risk Trajectory — full-width, 450-500px
    const sorted = [...d].sort((a, b) => a.risk_percentage - b.risk_percentage);
    AppState.chartInstances.aTrend = new Chart(document.getElementById('a-trend'), {
        type: 'line',
        data: {
            labels: sorted.map(x => x.ip.split('.').pop()),
            datasets: [
                {
                    label: 'Current Risk %', data: sorted.map(x => x.risk_percentage), borderColor: '#38bdf8',
                    backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, 'rgba(56,189,248,0.25)'); g.addColorStop(1, 'transparent'); return g; },
                    fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#38bdf8', pointHoverRadius: 8, pointBorderColor: 'rgba(56,189,248,0.3)', pointBorderWidth: 3
                },
                {
                    label: 'Projected Risk %', data: sorted.map(x => x.future_risk_percentage), borderColor: '#f43f5e',
                    backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, 'rgba(244,63,94,0.18)'); g.addColorStop(1, 'transparent'); return g; },
                    fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: '#f43f5e', borderDash: [6, 3], pointHoverRadius: 8, pointBorderColor: 'rgba(244,63,94,0.3)', pointBorderWidth: 3
                }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { labels: { color: '#7a8599', font: { family: ff } } },
                tooltip: {
                    ...ttOpts, callbacks: {
                        afterBody: (items) => {
                            const idx = items[0].dataIndex; const x = sorted[idx];
                            const delta = x.future_risk_percentage - x.risk_percentage;
                            return `IP: ${x.ip}\nDevice: ${x.device_type}\nLevel: ${x.risk_level}\nDelta: ${delta >= 0 ? '+' : ''}${delta}%`;
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Device (last octet)', color: '#7a8599', font: { family: ff, size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#7a8599' } },
                y: { title: { display: true, text: 'Risk %', color: '#7a8599', font: { family: ff, size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#7a8599' }, min: 0, max: 100 }
            }
        }
    });
}


// ─── DEVICES ───
function renderDevices() {
    return `
    <div class="page-header" > <h2 class="page-header__title"><i data-lucide="monitor"></i> Device Inventory</h2></div>
    <div class="filter-pills">
        <button class="filter-pill filter-pill--all active" data-risk="">ALL</button>
        <button class="filter-pill filter-pill--low" data-risk="LOW">LOW</button>
        <button class="filter-pill filter-pill--medium" data-risk="MEDIUM">MEDIUM</button>
        <button class="filter-pill filter-pill--high" data-risk="HIGH">HIGH</button>
        <button class="filter-pill filter-pill--critical" data-risk="CRITICAL">CRITICAL</button>
        <input type="text" class="table-filter" id="filter-search" placeholder="Search devices…" style="margin-left:auto" />
    </div>
    <div class="table-wrapper"><table class="data-table" id="devices-table">
        <thead><tr><th></th>
            <th data-sort="ip">IP <span class="sort-arrow"></span></th>
            <th data-sort="device_type">Type <span class="sort-arrow"></span></th>
            <th data-sort="risk_level">Risk <span class="sort-arrow"></span></th>
            <th data-sort="risk_score">Score <span class="sort-arrow"></span></th>
            <th data-sort="business_impact">Impact <span class="sort-arrow"></span></th>
            <th data-sort="last_patch_year">Patch <span class="sort-arrow"></span></th>
            <th data-sort="uptime_days">Uptime <span class="sort-arrow"></span></th>
            <th data-sort="forgotten">Status <span class="sort-arrow"></span></th>
            <th>Recommendation</th></tr></thead>
        <tbody id="devices-tbody"></tbody>
    </table></div>`;
}

function buildDeviceRows(devices) {
    return devices.map((d, i) => `
    <tr class="device-row"><td><button class="expand-btn" data-idx="${i}">▶</button></td>
            <td style="font-family:var(--font-mono);font-weight:600;color:var(--clr-info)">${d.ip}</td>
            <td>${d.device_type}</td>
            <td>${riskBadge(d.risk_level)}</td>
            <td style="font-weight:700">${d.risk_score}%</td>
            <td>${impactBadge(d.business_impact)}</td>
            <td>${d.last_patch_year}</td>
            <td>${d.uptime_days}d</td>
            <td>${d.forgotten ? '<span class="forgotten-tag"><span class="forgotten-dot"></span>Forgotten</span>' : '<span style="color:var(--clr-low);font-size:0.72rem">●  Active</span>'}</td>
            <td style="max-width:200px;white-space:normal;font-size:0.72rem;color:var(--text-secondary)">${d.recommendation}</td></tr>
    <tr class="expand-row" id="expand-${i}"><td colspan="10"><div class="expand-content" id="expand-content-${i}">
        <strong>Inferred Reasons:</strong><ul>${d.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
        <strong>Details:</strong><p>Ports: ${(d.open_ports || []).join(', ')} · Protocol: ${d.protocol} · Lifecycle Age: ${d.lifecycle_age} years</p>
    </div></td></tr>`).join('');
}

function bindDevices() {
    const tbody = document.getElementById('devices-tbody');
    let filtered = [...AppState.devices];
    let activeRisk = '';
    function render() { tbody.innerHTML = buildDeviceRows(filtered); bindExpandButtons(); }
    function applyFilters() {
        const sf = document.getElementById('filter-search').value.trim().toLowerCase();
        filtered = AppState.devices.filter(d => {
            if (activeRisk && d.risk_level !== activeRisk) return false;
            if (sf && !`${d.ip} ${d.device_type} ${d.risk_level} ${d.business_impact} ${d.recommendation} ${d.os} ${d.protocol} `.toLowerCase().includes(sf)) return false;
            return true;
        }); render();
    }
    // Filter pills
    document.querySelectorAll('.filter-pill').forEach(pill => pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active'); activeRisk = pill.dataset.risk; applyFilters();
    }));
    document.getElementById('filter-search').addEventListener('input', applyFilters);
    // Sorting
    document.querySelectorAll('#devices-table thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            AppState.currentSort = AppState.currentSort.key === key ? { key, dir: AppState.currentSort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
            filtered.sort((a, b) => {
                let va = a[key], vb = b[key];
                if (typeof va === 'number') return AppState.currentSort.dir === 'asc' ? va - vb : vb - va;
                return AppState.currentSort.dir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
            }); render();
        });
    }); render();
}

function bindExpandButtons() {
    document.querySelectorAll('.expand-btn').forEach(btn => btn.addEventListener('click', () => {
        const content = document.getElementById(`expand - content - ${btn.dataset.idx} `);
        const open = content.classList.contains('open');
        content.classList.toggle('open'); btn.textContent = open ? '▶' : '▼';
    }));
}


// ─── ALERTS (SOC Feed with Escalation Workflow) ───
function alertCounts() {
    const d = AppState.devices;
    const highCrit = d.filter(x => x.risk_level === 'HIGH' || x.risk_level === 'CRITICAL');
    const active = highCrit.filter(x => getAlertStatus(x.ip) === 'active');
    const escalated = highCrit.filter(x => getAlertStatus(x.ip) === 'escalated');
    const resolved = d.filter(x => getAlertStatus(x.ip) === 'resolved');
    const crit = highCrit.filter(x => x.risk_level === 'CRITICAL' && getAlertStatus(x.ip) !== 'resolved');
    const high = highCrit.filter(x => x.risk_level === 'HIGH' && getAlertStatus(x.ip) !== 'resolved');
    return { active: active.length, escalated: escalated.length, resolved: resolved.length, critical: crit.length, high: high.length };
}

function renderAlerts() {
    const c = alertCounts();
    return `
    <div class="page-header"><h2 class="page-header__title"><i data-lucide="bell"></i> SOC Alert Feed & Incident Management</h2></div>
    <div class="alert-tabs">
        <button class="alert-tab active" data-tab="active">Active <span class="alert-tab__count" id="cnt-active">${c.active}</span></button>
        <button class="alert-tab" data-tab="critical">Critical <span class="alert-tab__count" id="cnt-critical">${c.critical}</span></button>
        <button class="alert-tab" data-tab="high">High <span class="alert-tab__count" id="cnt-high">${c.high}</span></button>
        <button class="alert-tab" data-tab="escalated">Escalated <span class="alert-tab__count" id="cnt-escalated">${c.escalated}</span></button>
        <button class="alert-tab" data-tab="resolved">Resolved <span class="alert-tab__count" id="cnt-resolved">${c.resolved}</span></button>
    </div>
    <div class="alerts-feed" id="alerts-container"></div>`;
}

function renderAlertCards(list, tabName) {
    if (!list.length) return '<p style="color:var(--text-muted);padding:1rem;font-family:var(--font-mono)">No alerts in this category.</p>';
    return list.map(d => {
        const status = getAlertStatus(d.ip);
        const meta = AppState.alertStates.get(d.ip);
        const isEsc = status === 'escalated';
        const isRes = status === 'resolved';
        const cardClass = `alert-card alert-card--${d.risk_level.toLowerCase()} ${isEsc ? 'alert-card--escalated' : ''} ${isRes ? 'alert-card--resolved' : ''} ${d.risk_level === 'CRITICAL' && !isRes ? 'pulse-active' : ''}`;

        let statusBadge = '';
        if (isEsc) statusBadge = '<span class="escalation-badge"><i data-lucide="arrow-up-right"></i> Escalated</span>';
        else if (isRes) statusBadge = '<span class="risk-badge risk-badge--low" style="align-self:flex-start">Resolved</span>';

        let metaHtml = '';
        if (isEsc && meta) {
            metaHtml = `<div class="escalation-meta">
                <div class="escalation-meta__row"><i data-lucide="clock"></i> ${meta.escalatedAt || 'N/A'}</div>
                <div class="escalation-meta__row"><i data-lucide="layers"></i> ${meta.tier || 'Tier 2'}</div>
                <div class="escalation-meta__row"><i data-lucide="message-circle"></i> ${meta.reason || 'Escalated to SOC'}</div>
                <div class="escalation-meta__label">Escalated to ${meta.tier || 'Tier-2'} SOC</div>
            </div>`;
        }

        let actions = '';
        if (status === 'active') {
            actions = `<div class="alert-card__actions">
                <button class="btn btn--success btn--sm alert-action" data-action="resolve" data-ip="${d.ip}"><i data-lucide="check"></i> Resolve</button>
                <button class="btn btn--escalate btn--sm alert-action" data-action="escalate" data-ip="${d.ip}"><i data-lucide="arrow-up-right"></i> Escalate</button>
                <button class="btn btn--outline btn--sm alert-action" data-action="assign" data-ip="${d.ip}"><i data-lucide="user-plus"></i> Assign</button>
            </div>`;
        } else if (status === 'escalated') {
            actions = `<div class="alert-card__actions">
                <button class="btn btn--success btn--sm alert-action" data-action="resolve" data-ip="${d.ip}"><i data-lucide="check"></i> Resolve</button>
                <button class="btn btn--outline btn--sm alert-action" data-action="assign" data-ip="${d.ip}"><i data-lucide="user-plus"></i> Assign</button>
            </div>`;
        }

        return `<div class="${cardClass}">
            <div class="alert-card__header"><span class="alert-card__ip">${d.ip}</span>${riskBadge(d.risk_level)}${statusBadge}</div>
            <div class="alert-card__meta">Risk: <strong>${d.risk_percentage}%</strong> · Impact: ${impactBadge(d.business_impact)} · ${d.device_type}</div>
            <ul class="alert-card__reasons">${d.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
            <p style="font-size:0.72rem;color:var(--text-secondary);margin-top:0.15rem">${d.recommendation}</p>
            ${metaHtml}
            ${actions}
        </div>`;
    }).join('');
}

function bindAlerts() {
    const devices = AppState.devices, container = document.getElementById('alerts-container');
    let activeTab = 'active';
    const highCrit = devices.filter(d => d.risk_level === 'HIGH' || d.risk_level === 'CRITICAL');

    function getList(tab) {
        if (tab === 'active') return highCrit.filter(d => getAlertStatus(d.ip) === 'active');
        if (tab === 'critical') return highCrit.filter(d => d.risk_level === 'CRITICAL' && getAlertStatus(d.ip) !== 'resolved');
        if (tab === 'high') return highCrit.filter(d => d.risk_level === 'HIGH' && getAlertStatus(d.ip) !== 'resolved');
        if (tab === 'escalated') return highCrit.filter(d => getAlertStatus(d.ip) === 'escalated');
        if (tab === 'resolved') return devices.filter(d => getAlertStatus(d.ip) === 'resolved');
        return highCrit.filter(d => getAlertStatus(d.ip) === 'active');
    }

    function updateCounters() {
        const c = alertCounts();
        const ids = { active: c.active, critical: c.critical, high: c.high, escalated: c.escalated, resolved: c.resolved };
        Object.entries(ids).forEach(([k, v]) => {
            const el = document.getElementById(`cnt-${k}`);
            if (el) el.textContent = v;
        });
    }

    function renderTab() {
        container.innerHTML = renderAlertCards(getList(activeTab), activeTab);
        refreshIcons();
        container.querySelectorAll('.alert-action').forEach(btn => btn.addEventListener('click', () => {
            const { action, ip } = btn.dataset;
            if (action === 'resolve') {
                AppState.alertStates.set(ip, { status: 'resolved', resolvedAt: new Date().toLocaleString() });
                updateCounters(); updateAlertBadge(); renderTab();
            } else if (action === 'escalate') {
                const now = new Date();
                AppState.alertStates.set(ip, {
                    status: 'escalated',
                    escalatedAt: now.toLocaleString(),
                    tier: 'Tier-2',
                    reason: 'Requires senior SOC investigation',
                    level: 2
                });
                updateCounters(); updateAlertBadge(); renderTab();
            } else if (action === 'assign') {
                alert(`👤 Alert for ${ip} assigned to SOC team.`);
            }
        }));
    }

    document.querySelectorAll('.alert-tab').forEach(tab => tab.addEventListener('click', () => {
        document.querySelectorAll('.alert-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active'); activeTab = tab.dataset.tab; renderTab();
    }));
    renderTab();
}


// ─── SETTINGS ───
function renderSettings() {
    const s = AppState.settings;
    return `
    <div class="page-header" > <h2 class="page-header__title"><i data-lucide="settings"></i> Configuration</h2></div>
    <div class="settings-tabs">
        <button class="settings-tab active" data-stab="profile">Profile</button>
        <button class="settings-tab" data-stab="system">System</button>
        <button class="settings-tab" data-stab="appearance">Appearance</button>
        <button class="settings-tab" data-stab="notifications">Notifications</button>
    </div>
    <div class="settings-panel active" id="panel-profile"><div class="settings-group"><h3 class="settings-group__title">Admin Profile</h3>
        <div class="setting-row"><div class="setting-row__label">Admin Name</div><input class="setting-input" id="set-name" value="${s.adminName}" /></div>
        <div class="setting-row"><div class="setting-row__label">Organization</div><input class="setting-input" id="set-org" value="${s.organization}" /></div>
        <div class="setting-row"><div class="setting-row__label">Role</div><input class="setting-input" id="set-role" value="${s.role}" /></div>
    </div></div>
    <div class="settings-panel" id="panel-system"><div class="settings-group"><h3 class="settings-group__title">Risk Configuration</h3>
        <div class="setting-row"><div class="setting-row__label">Critical Threshold (%)<small>Devices above this → critical</small></div>
            <input class="setting-input" id="set-threshold" type="number" min="50" max="100" value="${s.riskThreshold}" /></div>
        <div class="setting-row"><div class="setting-row__label">Prediction Window (yrs)<small>Future risk projection</small></div>
            <input class="setting-input" id="set-prediction" type="number" min="1" max="10" value="${s.predictionWindow}" /></div>
    </div></div>
    <div class="settings-panel" id="panel-appearance"><div class="settings-group"><h3 class="settings-group__title">Theme</h3>
        <div class="setting-row"><div class="setting-row__label">Dark Cyber / Light Minimal</div>
            <label class="mini-toggle"><input type="checkbox" id="set-theme" ${document.body.classList.contains('light-mode') ? 'checked' : ''} /><span class="mini-toggle__slider"></span></label></div>
        <div class="setting-row"><div class="setting-row__label">Accent Colour</div>
            <div class="accent-swatches">
                <div class="accent-swatch active" style="background:#38bdf8" data-accent="#38bdf8"></div>
                <div class="accent-swatch" style="background:#a78bfa" data-accent="#a78bfa"></div>
                <div class="accent-swatch" style="background:#f43f5e" data-accent="#f43f5e"></div>
                <div class="accent-swatch" style="background:#22c55e" data-accent="#22c55e"></div>
                <div class="accent-swatch" style="background:#f97316" data-accent="#f97316"></div>
            </div></div>
    </div></div>
    <div class="settings-panel" id="panel-notifications"><div class="settings-group"><h3 class="settings-group__title">Alert Notifications</h3>
        <div class="setting-row"><div class="setting-row__label">Email Alerts<small>Threats via email</small></div>
            <label class="mini-toggle"><input type="checkbox" id="set-email" ${s.emailAlerts ? 'checked' : ''} /><span class="mini-toggle__slider"></span></label></div>
        <div class="setting-row"><div class="setting-row__label">SMS Alerts<small>Critical via SMS</small></div>
            <label class="mini-toggle"><input type="checkbox" id="set-sms" ${s.smsAlerts ? 'checked' : ''} /><span class="mini-toggle__slider"></span></label></div>
        <div class="setting-row"><div class="setting-row__label">Critical Only<small>CRITICAL level only</small></div>
            <label class="mini-toggle"><input type="checkbox" id="set-critical-only" ${s.criticalOnly ? 'checked' : ''} /><span class="mini-toggle__slider"></span></label></div>
    </div></div>`;
}

function bindSettings() {
    document.querySelectorAll('.settings-tab').forEach(tab => tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active'); document.getElementById(`panel-${tab.dataset.stab}`).classList.add('active');
    }));
    document.getElementById('set-name')?.addEventListener('input', e => AppState.settings.adminName = e.target.value);
    document.getElementById('set-org')?.addEventListener('input', e => AppState.settings.organization = e.target.value);
    document.getElementById('set-role')?.addEventListener('input', e => AppState.settings.role = e.target.value);
    document.getElementById('set-threshold')?.addEventListener('input', e => AppState.settings.riskThreshold = parseInt(e.target.value) || 75);
    document.getElementById('set-prediction')?.addEventListener('input', e => AppState.settings.predictionWindow = parseInt(e.target.value) || 2);
    document.getElementById('set-theme')?.addEventListener('change', e => {
        const t = document.getElementById('theme-toggle'); t.checked = e.target.checked; t.dispatchEvent(new Event('change'));
    });
    document.querySelectorAll('.accent-swatch').forEach(s => s.addEventListener('click', () => {
        document.querySelectorAll('.accent-swatch').forEach(x => x.classList.remove('active'));
        s.classList.add('active'); document.documentElement.style.setProperty('--clr-info', s.dataset.accent);
    }));
    document.getElementById('set-email')?.addEventListener('change', e => AppState.settings.emailAlerts = e.target.checked);
    document.getElementById('set-sms')?.addEventListener('change', e => AppState.settings.smsAlerts = e.target.checked);
    document.getElementById('set-critical-only')?.addEventListener('change', e => AppState.settings.criticalOnly = e.target.checked);
}


// ─── EXPORTS ───
function exportCSV() {
    const h = ['IP', 'Type', 'Risk', 'Score%', 'Impact', 'PatchYear', 'Uptime', 'Status', 'Protocol', 'Ports', 'Recommendation'];
    const rows = AppState.devices.map(d => [d.ip, d.device_type, d.risk_level, d.risk_score, d.business_impact, d.last_patch_year, d.uptime_days,
    d.forgotten ? 'Forgotten' : 'Active', d.protocol, (d.open_ports || []).join(';'), `"${d.recommendation}"`]);
    downloadFile([h.join(','), ...rows.map(r => r.join(','))].join('\n'), 'shadownet_devices.csv', 'text/csv');
}
function exportExcel() {
    if (!window.XLSX) { alert('SheetJS not loaded.'); return; }
    const data = AppState.devices.map(d => ({
        IP: d.ip, Type: d.device_type, Risk: d.risk_level, 'Score%': d.risk_score,
        Impact: d.business_impact, PatchYear: d.last_patch_year, Uptime: d.uptime_days,
        Status: d.forgotten ? 'Forgotten' : 'Active', Protocol: d.protocol, Ports: (d.open_ports || []).join(', '), Recommendation: d.recommendation
    }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Devices'); XLSX.writeFile(wb, 'shadownet_devices.xlsx');
}
function downloadFile(content, filename, mime) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = filename; a.click(); URL.revokeObjectURL(a.href); }

function generatePDFReport() {
    if (!window.jspdf) { alert('jsPDF not loaded.'); return; }
    const { jsPDF } = window.jspdf, doc = new jsPDF(), r = AppState.report; let y = 20;
    doc.setFontSize(20); doc.setTextColor(56, 189, 248); doc.text('ShadowNet — Security Report', 20, y); y += 12;
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated: ${new Date().toLocaleString()} `, 20, y); y += 10;
    doc.setFontSize(13); doc.setTextColor(40); doc.text('Executive Summary', 20, y); y += 8;
    doc.setFontSize(10); doc.setTextColor(60);
    [`Total Devices: ${r.total} `, `Security Score: ${r.securityScore}/100`,
    `Risk: Critical(${r.riskDist.CRITICAL}) High(${r.riskDist.HIGH}) Medium(${r.riskDist.MEDIUM}) Low(${r.riskDist.LOW})`,
    `Active Alerts: ${r.activeAlerts}`, `Forgotten: ${r.forgottenDevices.length}`, `Uptime: ${r.systemUptime}%`
    ].forEach(l => { doc.text(l, 25, y); y += 6; }); y += 6;
    doc.setFontSize(13); doc.setTextColor(40); doc.text('Top 5 Critical Devices', 20, y); y += 8;
    doc.setFontSize(9); r.topCritical.forEach(d => { doc.setTextColor(60); doc.text(`${d.ip} | ${d.device_type} | ${d.risk_percentage}% | ${d.risk_level}`, 25, y); y += 5; }); y += 6;
    if (r.forgottenDevices.length) {
        doc.setFontSize(13); doc.setTextColor(40); doc.text('Forgotten Devices', 20, y); y += 8;
        doc.setFontSize(9); r.forgottenDevices.forEach(d => { doc.setTextColor(60); doc.text(`${d.ip} | ${d.device_type} | ${d.uptime_days}d`, 25, y); y += 5; }); y += 6;
    }
    doc.setFontSize(13); doc.setTextColor(40); doc.text('Recommendations', 20, y); y += 8;
    doc.setFontSize(9);[...new Set(AppState.devices.map(d => d.recommendation))].forEach(rec => {
        if (y > 270) { doc.addPage(); y = 20; } doc.setTextColor(60); const s = doc.splitTextToSize(`• ${rec}`, 165); doc.text(s, 25, y); y += s.length * 5 + 2;
    });
    doc.save('ShadowNet_Security_Report.pdf');
}

// ─── GATEWAY: LANDING PAGE ───
function renderLanding() {
    return `
    <div class="gateway-page">
        <div class="gateway-header">
            <h1 class="gateway-title">Data Selection Gateway</h1>
            <p class="gateway-subtitle">Choose how you want to provide network metadata to initialize the dashboard.</p>
        </div>
        <div class="landing-grid">
            <div class="landing-card" id="card-manual">
                <div class="landing-card__icon"><i data-lucide="edit-3"></i></div>
                <h3 class="landing-card__title">Manual Data Entry</h3>
                <p class="landing-card__desc">Manually input device details one by one via a structured form. Best for small networks.</p>
                <button class="btn btn--primary">Continue</button>
            </div>
            <div class="landing-card" id="card-upload">
                <div class="landing-card__icon"><i data-lucide="file-up"></i></div>
                <h3 class="landing-card__title">Upload CSV / Excel File</h3>
                <p class="landing-card__desc">Import your entire network dataset in seconds. Supports .csv and .xlsx formats.</p>
                <button class="btn btn--primary">Continue</button>
            </div>
        </div>
    </div>`;
}

function bindLanding() {
    document.getElementById('card-manual').addEventListener('click', () => window.location.hash = '#manual-entry');
    document.getElementById('card-upload').addEventListener('click', () => window.location.hash = '#upload');
}

// ─── GATEWAY: MANUAL ENTRY ───
function renderManualEntry() {
    return `
    <div class="gateway-page">
        <div class="gateway-header">
            <h1 class="gateway-title">Manual Device Data Entry</h1>
            <p class="gateway-subtitle">Quickly input details for 5 essential fields. Intelligence is generated automatically.</p>
        </div>
        
        <div class="manual-entry-container">
            <form class="manual-form" id="manual-form">
                <div class="form-group">
                    <label class="form-label">IP Address</label>
                    <input type="text" class="form-input" name="ip" placeholder="e.g., 10.0.0.1" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Ports (Comma separated)</label>
                    <input type="text" class="form-input" name="port" placeholder="e.g., 80, 443" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Protocol</label>
                    <input type="text" class="form-input" name="protocol" placeholder="e.g., TCP" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Last Patch Year</label>
                    <input type="number" class="form-input" name="last_patch_year" value="${new Date().getFullYear()}" required />
                </div>
                <div class="form-group">
                    <label class="form-label">Uptime (Total Days)</label>
                    <input type="number" class="form-input" name="uptime" value="0" required />
                </div>
                
                <div class="form-group form-group--full" style="display:flex; gap: 1rem; margin-top: 1rem;">
                    <button type="submit" class="btn btn--outline" style="flex:1"><i data-lucide="plus"></i> Add Device</button>
                    <button type="button" class="btn btn--outline" onclick="window.location.hash='#landing'"><i data-lucide="arrow-left"></i> Back</button>
                </div>
            </form>

            <div class="device-list-container">
                <h3 class="device-list-title">Added Devices (${AppState.manualEntryList.length})</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>IP</th>
                                <th>Ports</th>
                                <th>Protocol</th>
                                <th>Patch Year</th>
                                <th>Uptime</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="manual-device-list">
                            ${AppState.manualEntryList.map((d, i) => `
                                <tr>
                                    <td>${d.ip}</td>
                                    <td>${d.port}</td>
                                    <td>${d.protocol}</td>
                                    <td>${d.last_patch_year}</td>
                                    <td>${d.uptime_days}d</td>
                                    <td>
                                        <button class="btn btn--sm btn--danger" onclick="deleteManualDevice(${i})"><i data-lucide="trash-2"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                            ${AppState.manualEntryList.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">No devices added yet.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
                
                <div style="margin-top: 2rem; display: flex; justify-content: center;">
                    <button class="btn btn--primary btn--lg" id="btn-process-manual" ${AppState.manualEntryList.length === 0 ? 'disabled' : ''}>
                        <i data-lucide="play"></i> Process & Launch Dashboard
                    </button>
                </div>
            </div>
        </div>
    </div>`;
}

function bindManualEntry() {
    const form = document.getElementById('manual-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const device = {
            ip: fd.get('ip'),
            port: fd.get('port'),
            protocol: fd.get('protocol'),
            last_patch_year: parseInt(fd.get('last_patch_year')),
            uptime_days: parseInt(fd.get('uptime')),
            device_type: 'Unknown' // Fallback for list display before inference
        };
        AppState.manualEntryList.push(device);
        handleRoute();
    });

    document.getElementById('btn-process-manual')?.addEventListener('click', () => {
        processAndLaunch(AppState.manualEntryList);
    });
}

window.deleteManualDevice = (i) => {
    AppState.manualEntryList.splice(i, 1);
    handleRoute();
};

window.editManualDevice = (i) => {
    const d = AppState.manualEntryList[i];
    const form = document.getElementById('manual-form');
    if (!form) return;
    form.ip.value = d.ip;
    form.port.value = d.port;
    form.protocol.value = d.protocol;
    form.last_patch_year.value = d.last_patch_year;
    form.uptime.value = d.uptime_days;

    AppState.manualEntryList.splice(i, 1);
    handleRoute();
};

// ─── GATEWAY: UPLOAD PAGE ───
function renderUpload() {
    return `
    <div class="gateway-page">
        <div class="gateway-header">
            <h1 class="gateway-title">Upload Network Dataset</h1>
            <p class="gateway-subtitle">Select a .csv or .xlsx file containing your device metadata.</p>
        </div>
        
        <div class="upload-container">
            <div class="drop-zone" id="drop-zone">
                <div class="drop-zone__icon"><i data-lucide="cloud-upload"></i></div>
                <p class="drop-zone__text">Drag & drop your file here or <strong>browse files</strong></p>
                <input type="file" id="file-input" accept=".csv, .xlsx" style="display:none" />
            </div>

            <div class="upload-instructions">
                <h4>Required CSV/Excel Format</h4>
                <div class="col-grid">
                    <span class="col-item">ip</span>
                    <span class="col-item">port</span>
                    <span class="col-item">protocol</span>
                    <span class="col-item">last_patch_year</span>
                    <span class="col-item">uptime</span>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1rem;">
                    * All 5 columns are required. Intelligence is automatically derived from these primitives.
                </p>
            </div>

            <div id="upload-preview" style="display:none">
                <h3 class="device-list-title">File Preview</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr id="preview-head"></tr></thead>
                        <tbody id="preview-body"></tbody>
                    </table>
                </div>
                <div style="margin-top: 2rem; display: flex; justify-content: center; gap: 1.5rem;">
                    <button class="btn btn--primary btn--lg" id="btn-confirm-import">
                        <i data-lucide="check-check"></i> Confirm Import
                    </button>
                    <button class="btn btn--outline btn--lg" onclick="handleRoute()">
                        <i data-lucide="x"></i> Cancel
                    </button>
                </div>
            </div>
            
            <button class="btn btn--outline" style="margin-top: 2rem;" onclick="window.location.hash='#landing'">
                <i data-lucide="arrow-left"></i> Back
            </button>
        </div>
    </div>`;
}

function bindUpload() {
    const dz = document.getElementById('drop-zone');
    const fi = document.getElementById('file-input');

    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drop-zone--active'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drop-zone--active'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('drop-zone--active');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fi.addEventListener('change', () => { if (fi.files.length) handleFile(fi.files[0]); });
}

let pendingUploadData = null;

async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
        alert('Invalid file type. Please upload a .csv or .xlsx file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = e.target.result;
        let json = [];

        try {
            if (ext === 'xlsx') {
                const wb = XLSX.read(data, { type: 'binary' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                json = XLSX.utils.sheet_to_json(sheet);
            } else {
                const text = data;
                const rows = text.split('\n').map(r => r.split(',').map(c => c.trim()));
                const headers = rows[0];
                for (let i = 1; i < rows.length; i++) {
                    if (rows[i].length < headers.length) continue;
                    let obj = {};
                    headers.forEach((h, idx) => obj[h] = rows[i][idx]);
                    json.push(obj);
                }
            }

            validateAndPreview(json);
        } catch (err) {
            console.error(err);
            alert('Failed to parse file. Check format.');
        }
    };

    if (ext === 'xlsx') reader.readAsBinaryString(file);
    else reader.readAsText(file);
}

function validateAndPreview(data) {
    const REQUIRED = ['ip', 'port', 'protocol', 'last_patch_year', 'uptime'];
    if (!data.length) { alert('File is empty.'); return; }

    const headers = Object.keys(data[0]);
    const missing = REQUIRED.filter(r => !headers.includes(r));
    if (missing.length) {
        alert(`Missing required columns: ${missing.join(', ')}`);
        return;
    }

    pendingUploadData = data.map(d => ({
        ...d,
        port: d.port,
        last_patch_year: parseInt(d.last_patch_year),
        uptime_days: parseInt(d.uptime),
        device_type: 'Unknown',
        location: 'File Upload'
    }));

    // Show Preview
    const dz = document.getElementById('drop-zone');
    if (dz) dz.style.display = 'none';
    const ui = document.querySelector('.upload-instructions');
    if (ui) ui.style.display = 'none';
    const preview = document.getElementById('upload-preview');
    if (preview) preview.style.display = 'block';

    document.getElementById('preview-head').innerHTML = REQUIRED.map(h => `<th>${h}</th>`).join('');
    document.getElementById('preview-body').innerHTML = pendingUploadData.slice(0, 5).map(d => `
        <tr>
            <td>${d.ip}</td>
            <td>${d.port}</td>
            <td>${d.protocol}</td>
            <td>${d.last_patch_year}</td>
            <td>${d.uptime_days}d</td>
        </tr>
    `).join('') + (pendingUploadData.length > 5 ? `<tr><td colspan="5" style="text-align:center">... and ${pendingUploadData.length - 5} more devices</td></tr>` : '');

    document.getElementById('btn-confirm-import')?.addEventListener('click', () => {
        processAndLaunch(pendingUploadData);
    });

    refreshIcons();
}

// ─── DATA PROCESSING CORE ───
function processAndLaunch(rawData) {
    // Centralized pipeline — processDataset handles everything
    AppState.rawDevices = rawData;
    AppState.hasSessionData = true;
    AppState.datasetReady = true;

    runScanEngine();

    // Immediate Redirect
    window.location.hash = '#dashboard';
    console.log(`Successfully processed ${AppState.devices.length} devices.`);
}



