// Shadow Net — Main Application (Router, Pages, Search, Export)

// Global State
const AppState = {
    rawDevices: [], devices: [], report: null,
    resolvedAlerts: new Set(), chartInstances: {},
    currentSort: { key: '', dir: 'asc' },
    settings: {
        adminName: 'SOC Admin', organization: 'Shadow Net HQ', role: 'Security Analyst',
        riskThreshold: 75, predictionWindow: 2, emailAlerts: true, smsAlerts: false, criticalOnly: false
    }
};

// Boot — fetch data, init everything
document.addEventListener('DOMContentLoaded', async () => {
    try { const res = await fetch('devices.json'); AppState.rawDevices = await res.json(); }
    catch (e) { console.error('Failed to load devices.json', e); AppState.rawDevices = []; }
    runScanEngine(); initIcons(); initSidebar(); initSearch(); initTheme(); initRouter();
});

function runScanEngine() {
    AppState.devices = ShadowEngines.scanNetwork(AppState.rawDevices);
    AppState.report = ShadowEngines.generateReport(AppState.devices);
    updateAlertBadge();
}

function initIcons() { if (window.lucide) lucide.createIcons(); }
function refreshIcons() { requestAnimationFrame(() => { if (window.lucide) lucide.createIcons(); }); }

// Sidebar toggle
function initSidebar() {
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
}

// Theme toggle
function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (localStorage.getItem('shadownet-theme') === 'light') { document.body.classList.add('light-mode'); toggle.checked = true; }
    toggle.addEventListener('change', () => {
        document.body.classList.toggle('light-mode', toggle.checked);
        localStorage.setItem('shadownet-theme', toggle.checked ? 'light' : 'dark');
    });
}

// Global search — searches across device fields
function initSearch() {
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (!q) { results.classList.remove('visible'); results.innerHTML = ''; return; }
        const matches = AppState.devices.filter(d =>
            [d.ip, d.device_type, d.risk_level, d.business_impact, d.recommendation].some(v => (v || '').toLowerCase().includes(q)));
        if (!matches.length) { results.innerHTML = '<div class="search-no-results">No devices found</div>'; }
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
    document.addEventListener('click', e => { if (!e.target.closest('.header__search-wrapper')) results.classList.remove('visible'); });
}

// Alert badge counter
function updateAlertBadge() {
    const badge = document.getElementById('alert-badge');
    const count = AppState.devices.filter(d => (d.risk_level === 'HIGH' || d.risk_level === 'CRITICAL') && !AppState.resolvedAlerts.has(d.ip)).length;
    badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none';
}

// Hash-based SPA router
function initRouter() { window.addEventListener('hashchange', handleRoute); handleRoute(); }
function handleRoute() {
    const hash = (window.location.hash || '#dashboard').replace('#', '');
    const content = document.getElementById('content');
    Object.values(AppState.chartInstances).forEach(c => c.destroy());
    AppState.chartInstances = {};
    document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === hash));
    const pages = { analytics: renderAnalytics, devices: renderDevices, alerts: renderAlerts, settings: renderSettings };
    content.innerHTML = (pages[hash] || renderDashboard)();
    refreshIcons();
    const binds = { analytics: bindAnalytics, devices: bindDevices, alerts: bindAlerts, settings: bindSettings };
    (binds[hash] || bindDashboard)();
}

// Utility helpers
function riskBadge(level) { return `<span class="risk-badge risk-badge--${level.toLowerCase()}">${level}</span>`; }
function impactBadge(level) { return `<span class="impact-badge impact-badge--${level.toLowerCase()}">${level}</span>`; }
function animateValue(el, target, dur = 1000) {
    const start = performance.now();
    (function u(t) { const p = Math.min((t - start) / dur, 1); el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target); if (p < 1) requestAnimationFrame(u); })(start);
}
function animateSuffix(el, target, suffix, dur = 1000) {
    const start = performance.now();
    (function u(t) { const p = Math.min((t - start) / dur, 1); el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target) + suffix; if (p < 1) requestAnimationFrame(u); })(start);
}
function heatColor(pct) { return pct >= 75 ? 'rgba(239,68,68,0.35)' : pct >= 50 ? 'rgba(249,115,22,0.3)' : pct >= 25 ? 'rgba(234,179,8,0.25)' : 'rgba(34,197,94,0.2)'; }
function heatText(pct) { return pct >= 75 ? 'var(--clr-critical)' : pct >= 50 ? 'var(--clr-high)' : pct >= 25 ? 'var(--clr-medium)' : 'var(--clr-low)'; }


// ─── DASHBOARD PAGE ───
function renderDashboard() {
    const r = AppState.report;
    return `
    <div class="page-header">
        <h2 class="page-header__title"><i data-lucide="layout-dashboard"></i> Dashboard</h2>
        <div class="page-header__actions">
            <button class="btn btn--primary" id="btn-scan"><i data-lucide="radar"></i> Scan Network</button>
            <div class="dropdown-wrapper">
                <button class="btn btn--outline" id="btn-export"><i data-lucide="download"></i> Export Devices</button>
                <div class="dropdown-menu" id="export-menu">
                    <button class="dropdown-item" id="export-csv"><i data-lucide="file-text"></i> CSV</button>
                    <button class="dropdown-item" id="export-excel"><i data-lucide="file-spreadsheet"></i> Excel</button>
                </div>
            </div>
            <button class="btn btn--outline" id="btn-report"><i data-lucide="file-down"></i> Generate Report</button>
        </div>
    </div>
    <div class="cards-grid">
        ${[{ k: 'info', i: 'monitor', v: r.total, l: 'Total Devices', pct: 100 },
        { k: 'critical', i: 'alert-triangle', v: r.riskDist.CRITICAL, l: 'Critical' },
        { k: 'high', i: 'alert-circle', v: r.riskDist.HIGH, l: 'High Risk' },
        { k: 'medium', i: 'info', v: r.riskDist.MEDIUM, l: 'Medium Risk' },
        { k: 'low', i: 'check-circle', v: r.riskDist.LOW, l: 'Low Risk' }].map(c => `
        <div class="metric-card metric-card--${c.k}">
            <div class="metric-card__icon metric-card__icon--${c.k}"><i data-lucide="${c.i}"></i></div>
            <p class="metric-card__value" data-count="${c.v}">0</p>
            <p class="metric-card__label">${c.l}</p>
            <div class="metric-card__bar"><span class="metric-card__bar-fill bar-fill--${c.k}" data-pct="${c.k === 'info' ? 100 : (r.total ? Math.round(c.v / r.total * 100) : 0)}"></span></div>
        </div>`).join('')}
    </div>
    <div class="charts-row">
        <div class="chart-card"><h3 class="chart-card__title"><i data-lucide="pie-chart"></i> Risk Distribution</h3><div class="chart-canvas-wrapper"><canvas id="chart-risk-pie"></canvas></div></div>
        <div class="chart-card"><h3 class="chart-card__title"><i data-lucide="bar-chart-3"></i> Device Type Distribution</h3><div class="chart-canvas-wrapper"><canvas id="chart-type-bar"></canvas></div></div>
    </div>
    <h3 class="section-title"><i data-lucide="grid-3x3"></i> Risk Intensity Heatmap</h3>
    <div class="heatmap-grid">${AppState.devices.map(d => `
        <div class="heatmap-cell" style="background:${heatColor(d.risk_percentage)};color:${heatText(d.risk_percentage)}">
            <div class="heatmap-cell__ip">${d.ip.split('.').pop()}</div><div class="heatmap-cell__pct">${d.risk_percentage}%</div>
        </div>`).join('')}</div>
    <h3 class="section-title"><i data-lucide="shield-alert"></i> Top 5 Critical Devices</h3>
    <div class="table-wrapper"><table class="top5-table">
        <thead><tr><th>IP Address</th><th>Device Type</th><th>Risk %</th><th>Risk Level</th><th>Impact</th></tr></thead>
        <tbody>${r.topCritical.map(d => `<tr>
            <td style="font-weight:600;color:var(--clr-info)">${d.ip}</td><td>${d.device_type}</td>
            <td style="font-weight:700">${d.risk_percentage}%</td><td>${riskBadge(d.risk_level)}</td><td>${impactBadge(d.business_impact)}</td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function bindDashboard() {
    document.querySelectorAll('.metric-card__value[data-count]').forEach(el => animateValue(el, parseInt(el.dataset.count)));
    document.querySelectorAll('.metric-card__bar-fill[data-pct]').forEach(bar => setTimeout(() => bar.style.width = bar.dataset.pct + '%', 300));
    const rd = AppState.report.riskDist;
    AppState.chartInstances.riskPie = new Chart(document.getElementById('chart-risk-pie'), {
        type: 'doughnut', data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [{ data: [rd.CRITICAL, rd.HIGH, rd.MEDIUM, rd.LOW], backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8892a8', font: { family: 'Inter' } } } }, cutout: '65%' }
    });
    const td = AppState.report.typeDist;
    AppState.chartInstances.typeBar = new Chart(document.getElementById('chart-type-bar'), {
        type: 'bar', data: {
            labels: Object.keys(td).map(l => l.length > 18 ? l.slice(0, 16) + '…' : l),
            datasets: [{ data: Object.values(td), backgroundColor: 'rgba(56,189,248,0.5)', borderColor: 'rgba(56,189,248,0.8)', borderWidth: 1, borderRadius: 5 }]
        },
        options: {
            responsive: true, indexAxis: 'y', plugins: { legend: { display: false } },
            scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7b8498' } }, y: { grid: { display: false }, ticks: { color: '#7b8498' } } }
        }
    });
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
}


// ─── ANALYTICS PAGE ───
function renderAnalytics() {
    const r = AppState.report;
    return `
    <div class="page-header"><h2 class="page-header__title"><i data-lucide="bar-chart-3"></i> Security Analytics & Trend Intelligence</h2></div>
    <div class="cards-grid">
        <div class="metric-card metric-card--info"><div class="metric-card__icon metric-card__icon--info"><i data-lucide="shield"></i></div>
            <p class="metric-card__value" data-count="${r.securityScore}">0</p><p class="metric-card__label">Security Score</p></div>
        <div class="metric-card metric-card--low"><div class="metric-card__icon metric-card__icon--low"><i data-lucide="check-circle"></i></div>
            <p class="metric-card__value" data-count="${r.risksMitigated}">0</p><p class="metric-card__label">Risks Mitigated</p></div>
        <div class="metric-card metric-card--high"><div class="metric-card__icon metric-card__icon--high"><i data-lucide="clock"></i></div>
            <p class="metric-card__value analytics-resp-time" data-count="${r.avgResponseTime}">0</p><p class="metric-card__label">Avg Response Time (hrs)</p></div>
        <div class="metric-card metric-card--purple"><div class="metric-card__icon metric-card__icon--purple"><i data-lucide="activity"></i></div>
            <p class="metric-card__value" data-count="${r.systemUptime}" data-suffix="%">0</p><p class="metric-card__label">System Uptime</p></div>
    </div>
    <div class="charts-row">
        <div class="chart-card"><h3 class="chart-card__title"><i data-lucide="pie-chart"></i> Risk Distribution</h3><div class="chart-canvas-wrapper"><canvas id="analytics-pie"></canvas></div></div>
        <div class="chart-card"><h3 class="chart-card__title"><i data-lucide="bar-chart-3"></i> Device Type Distribution</h3><div class="chart-canvas-wrapper"><canvas id="analytics-bar"></canvas></div></div>
    </div>
    <div class="charts-row"><div class="chart-card" style="grid-column:1/-1">
        <h3 class="chart-card__title"><i data-lucide="trending-up"></i> Risk Trend Projection</h3><div class="chart-canvas-wrapper"><canvas id="analytics-trend"></canvas></div>
    </div></div>`;
}

function bindAnalytics() {
    const r = AppState.report;
    document.querySelectorAll('.metric-card__value[data-count]').forEach(el => {
        if (el.dataset.suffix) animateSuffix(el, parseFloat(el.dataset.count), el.dataset.suffix);
        else if (el.classList.contains('analytics-resp-time')) animateSuffix(el, parseFloat(el.dataset.count), 'h');
        else animateValue(el, parseInt(el.dataset.count));
    });
    const rd = r.riskDist;
    AppState.chartInstances.aPie = new Chart(document.getElementById('analytics-pie'), {
        type: 'doughnut', data: {
            labels: ['Critical', 'High', 'Medium', 'Low'],
            datasets: [{ data: [rd.CRITICAL, rd.HIGH, rd.MEDIUM, rd.LOW], backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'], borderWidth: 0 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8892a8' } } }, cutout: '65%' }
    });
    AppState.chartInstances.aBar = new Chart(document.getElementById('analytics-bar'), {
        type: 'bar', data: {
            labels: Object.keys(r.typeDist).map(l => l.length > 18 ? l.slice(0, 16) + '…' : l),
            datasets: [{ data: Object.values(r.typeDist), backgroundColor: 'rgba(167,139,250,0.5)', borderColor: 'rgba(167,139,250,0.8)', borderWidth: 1, borderRadius: 5 }]
        },
        options: {
            responsive: true, indexAxis: 'y', plugins: { legend: { display: false } },
            scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7b8498' } }, y: { grid: { display: false }, ticks: { color: '#7b8498' } } }
        }
    });
    const sorted = [...AppState.devices].sort((a, b) => a.risk_percentage - b.risk_percentage);
    AppState.chartInstances.aTrend = new Chart(document.getElementById('analytics-trend'), {
        type: 'line', data: {
            labels: sorted.map(d => d.ip.split('.').pop()),
            datasets: [
                { label: 'Current Risk %', data: sorted.map(d => d.risk_percentage), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.1)', fill: true, tension: 0.4, pointRadius: 4 },
                { label: 'Future Risk %', data: sorted.map(d => d.future_risk_percentage), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.1)', fill: true, tension: 0.4, pointRadius: 4, borderDash: [6, 3] }
            ]
        },
        options: {
            responsive: true, plugins: { legend: { labels: { color: '#8892a8' } } },
            scales: {
                x: { title: { display: true, text: 'Device (last octet)', color: '#7b8498' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7b8498' } },
                y: { title: { display: true, text: 'Risk %', color: '#7b8498' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7b8498' }, min: 0, max: 100 }
            }
        }
    });
}


// ─── DEVICES PAGE ───
function renderDevices() {
    return `
    <div class="page-header"><h2 class="page-header__title"><i data-lucide="monitor"></i> Device Inventory</h2></div>
    <div class="table-controls">
        <select class="table-filter" id="filter-risk"><option value="">All Risk Levels</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
        <select class="table-filter" id="filter-impact"><option value="">All Impact Levels</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
        <input type="text" class="table-filter" id="filter-search" placeholder="Search table…" />
    </div>
    <div class="table-wrapper"><table class="data-table" id="devices-table">
        <thead><tr><th></th><th data-sort="ip">IP <span class="sort-arrow"></span></th><th data-sort="device_type">Type <span class="sort-arrow"></span></th>
            <th data-sort="risk_level">Risk <span class="sort-arrow"></span></th><th data-sort="risk_percentage">Risk % <span class="sort-arrow"></span></th>
            <th data-sort="future_risk_level">Future Risk <span class="sort-arrow"></span></th><th data-sort="future_risk_percentage">Future % <span class="sort-arrow"></span></th>
            <th data-sort="business_impact">Impact <span class="sort-arrow"></span></th><th>Forgotten</th><th>Recommendation</th></tr></thead>
        <tbody id="devices-tbody"></tbody>
    </table></div>`;
}

function buildDeviceRows(devices) {
    return devices.map((d, i) => `
        <tr class="device-row"><td><button class="expand-btn" data-idx="${i}">▶</button></td>
            <td style="font-weight:600;color:var(--clr-info)">${d.ip}</td><td>${d.device_type}</td>
            <td>${riskBadge(d.risk_level)}</td><td style="font-weight:700">${d.risk_percentage}%</td>
            <td>${riskBadge(d.future_risk_level)}</td><td style="font-weight:700">${d.future_risk_percentage}%</td>
            <td>${impactBadge(d.business_impact)}</td>
            <td>${d.forgotten ? '<span class="forgotten-tag">⚠ Forgotten</span>' : '—'}</td>
            <td style="max-width:220px;white-space:normal;font-size:0.75rem;color:var(--text-secondary)">${d.recommendation}</td></tr>
        <tr class="expand-row" id="expand-${i}" style="display:none"><td colspan="10"><div class="expand-content">
            <strong>Reasons:</strong><ul>${d.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
            <strong>Details:</strong><p>OS: ${d.os} · Ports: ${(d.open_ports || []).join(', ')} · Protocol: ${d.protocol} · Location: ${d.location} · Uptime: ${d.uptime_days} days</p>
        </div></td></tr>`).join('');
}

function bindDevices() {
    const tbody = document.getElementById('devices-tbody');
    let filtered = [...AppState.devices];
    function render() { tbody.innerHTML = buildDeviceRows(filtered); bindExpandButtons(); }
    function applyFilters() {
        const rf = document.getElementById('filter-risk').value, impf = document.getElementById('filter-impact').value;
        const sf = document.getElementById('filter-search').value.trim().toLowerCase();
        filtered = AppState.devices.filter(d => {
            if (rf && d.risk_level !== rf) return false;
            if (impf && d.business_impact !== impf) return false;
            if (sf && !`${d.ip} ${d.device_type} ${d.risk_level} ${d.business_impact} ${d.recommendation} ${d.os} ${d.protocol}`.toLowerCase().includes(sf)) return false;
            return true;
        }); render();
    }
    document.getElementById('filter-risk').addEventListener('change', applyFilters);
    document.getElementById('filter-impact').addEventListener('change', applyFilters);
    document.getElementById('filter-search').addEventListener('input', applyFilters);
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
        const row = document.getElementById(`expand-${btn.dataset.idx}`);
        const vis = row.style.display !== 'none'; row.style.display = vis ? 'none' : 'table-row'; btn.textContent = vis ? '▶' : '▼';
    }));
}


// ─── ALERTS PAGE ───
function renderAlerts() {
    const d = AppState.devices;
    const active = d.filter(x => (x.risk_level === 'HIGH' || x.risk_level === 'CRITICAL') && !AppState.resolvedAlerts.has(x.ip));
    const crit = d.filter(x => x.risk_level === 'CRITICAL' && !AppState.resolvedAlerts.has(x.ip));
    const high = d.filter(x => x.risk_level === 'HIGH' && !AppState.resolvedAlerts.has(x.ip));
    const resolved = d.filter(x => AppState.resolvedAlerts.has(x.ip));
    return `
    <div class="page-header"><h2 class="page-header__title"><i data-lucide="bell"></i> Alert Monitoring & Incident Management</h2></div>
    <div class="alert-tabs">
        <button class="alert-tab active" data-tab="active">Active <span class="alert-tab__count">${active.length}</span></button>
        <button class="alert-tab" data-tab="critical">Critical <span class="alert-tab__count">${crit.length}</span></button>
        <button class="alert-tab" data-tab="high">High <span class="alert-tab__count">${high.length}</span></button>
        <button class="alert-tab" data-tab="resolved">Resolved <span class="alert-tab__count">${resolved.length}</span></button>
    </div>
    <div class="alerts-grid" id="alerts-container"></div>`;
}

function renderAlertCards(list, showActions = true) {
    if (!list.length) return '<p style="color:var(--text-muted);padding:1rem;">No alerts in this category.</p>';
    return list.map(d => `
        <div class="alert-card alert-card--${d.risk_level.toLowerCase()}">
            <div class="alert-card__header"><span class="alert-card__ip">${d.ip}</span>${riskBadge(d.risk_level)}</div>
            <div class="alert-card__meta">Risk: <strong>${d.risk_percentage}%</strong> · Impact: ${impactBadge(d.business_impact)}<br/>Type: ${d.device_type}</div>
            <ul class="alert-card__reasons">${d.reasons.map(r => `<li>${r}</li>`).join('')}</ul>
            <p style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.25rem;">${d.recommendation}</p>
            ${showActions ? `<div class="alert-card__actions">
                <button class="btn btn--success btn--sm alert-action" data-action="resolve" data-ip="${d.ip}"><i data-lucide="check"></i> Resolve</button>
                <button class="btn btn--danger btn--sm alert-action" data-action="escalate" data-ip="${d.ip}"><i data-lucide="arrow-up-right"></i> Escalate</button>
                <button class="btn btn--outline btn--sm alert-action" data-action="assign" data-ip="${d.ip}"><i data-lucide="user-plus"></i> Assign SOC</button>
            </div>` : '<span class="risk-badge risk-badge--low" style="align-self:flex-start">Resolved</span>'}
        </div>`).join('');
}

function bindAlerts() {
    const devices = AppState.devices, container = document.getElementById('alerts-container');
    let activeTab = 'active';
    function getList(tab) {
        if (tab === 'critical') return devices.filter(d => d.risk_level === 'CRITICAL' && !AppState.resolvedAlerts.has(d.ip));
        if (tab === 'high') return devices.filter(d => d.risk_level === 'HIGH' && !AppState.resolvedAlerts.has(d.ip));
        if (tab === 'resolved') return devices.filter(d => AppState.resolvedAlerts.has(d.ip));
        return devices.filter(d => (d.risk_level === 'HIGH' || d.risk_level === 'CRITICAL') && !AppState.resolvedAlerts.has(d.ip));
    }
    function renderTab() {
        container.innerHTML = renderAlertCards(getList(activeTab), activeTab !== 'resolved'); refreshIcons();
        container.querySelectorAll('.alert-action').forEach(btn => btn.addEventListener('click', () => {
            const { action, ip } = btn.dataset;
            if (action === 'resolve') { AppState.resolvedAlerts.add(ip); updateAlertBadge(); handleRoute(); }
            else if (action === 'escalate') alert(`🚨 Alert for ${ip} escalated to senior SOC.`);
            else if (action === 'assign') alert(`👤 Alert for ${ip} assigned to SOC team.`);
        }));
    }
    document.querySelectorAll('.alert-tab').forEach(tab => tab.addEventListener('click', () => {
        document.querySelectorAll('.alert-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active'); activeTab = tab.dataset.tab; renderTab();
    }));
    renderTab();
}


// ─── SETTINGS PAGE ───
function renderSettings() {
    const s = AppState.settings;
    return `
    <div class="page-header"><h2 class="page-header__title"><i data-lucide="settings"></i> Settings</h2></div>
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
        <div class="setting-row"><div class="setting-row__label">Critical Risk Threshold (%)<small>Devices above this are flagged critical</small></div>
            <input class="setting-input" id="set-threshold" type="number" min="50" max="100" value="${s.riskThreshold}" /></div>
        <div class="setting-row"><div class="setting-row__label">Predictive Window (years)<small>How far ahead to project risk</small></div>
            <input class="setting-input" id="set-prediction" type="number" min="1" max="10" value="${s.predictionWindow}" /></div>
    </div></div>
    <div class="settings-panel" id="panel-appearance"><div class="settings-group"><h3 class="settings-group__title">Theme</h3>
        <div class="setting-row"><div class="setting-row__label">Dark / Light Mode</div>
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
        <div class="setting-row"><div class="setting-row__label">Email Alerts<small>Receive email for threats</small></div>
            <label class="mini-toggle"><input type="checkbox" id="set-email" ${s.emailAlerts ? 'checked' : ''} /><span class="mini-toggle__slider"></span></label></div>
        <div class="setting-row"><div class="setting-row__label">SMS Alerts<small>SMS for critical alerts</small></div>
            <label class="mini-toggle"><input type="checkbox" id="set-sms" ${s.smsAlerts ? 'checked' : ''} /><span class="mini-toggle__slider"></span></label></div>
        <div class="setting-row"><div class="setting-row__label">Critical Only<small>Only CRITICAL level</small></div>
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


// ─── EXPORT FUNCTIONS ───
function exportCSV() {
    const h = ['IP', 'Device Type', 'Risk Level', 'Risk %', 'Future Risk', 'Future %', 'Impact', 'Forgotten', 'OS', 'Protocol', 'Open Ports', 'Location', 'Uptime', 'Recommendation'];
    const rows = AppState.devices.map(d => [d.ip, d.device_type, d.risk_level, d.risk_percentage, d.future_risk_level, d.future_risk_percentage, d.business_impact, d.forgotten, d.os, d.protocol, (d.open_ports || []).join(';'), d.location, d.uptime_days, `"${d.recommendation}"`]);
    downloadFile([h.join(','), ...rows.map(r => r.join(','))].join('\n'), 'shadow_net_devices.csv', 'text/csv');
}

function exportExcel() {
    if (!window.XLSX) { alert('SheetJS not loaded.'); return; }
    const data = AppState.devices.map(d => ({
        IP: d.ip, Type: d.device_type, Risk: d.risk_level, 'Risk%': d.risk_percentage,
        'Future Risk': d.future_risk_level, 'Future%': d.future_risk_percentage, Impact: d.business_impact, Forgotten: d.forgotten,
        OS: d.os, Protocol: d.protocol, Ports: (d.open_ports || []).join(', '), Location: d.location, Uptime: d.uptime_days, Recommendation: d.recommendation
    }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Devices'); XLSX.writeFile(wb, 'shadow_net_devices.xlsx');
}

function downloadFile(content, filename, mime) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

// PDF report generation
function generatePDFReport() {
    if (!window.jspdf) { alert('jsPDF not loaded.'); return; }
    const { jsPDF } = window.jspdf, doc = new jsPDF(), r = AppState.report;
    let y = 20;
    doc.setFontSize(20); doc.setTextColor(56, 189, 248); doc.text('Shadow Net — Security Report', 20, y); y += 12;
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y); y += 10;
    doc.setFontSize(13); doc.setTextColor(40); doc.text('Executive Summary', 20, y); y += 8;
    doc.setFontSize(10); doc.setTextColor(60);
    [`Total Devices: ${r.total}`, `Security Score: ${r.securityScore}/100`,
    `Risk: Critical(${r.riskDist.CRITICAL}) High(${r.riskDist.HIGH}) Medium(${r.riskDist.MEDIUM}) Low(${r.riskDist.LOW})`,
    `Active Alerts: ${r.activeAlerts}`, `Forgotten: ${r.forgottenDevices.length}`, `Uptime: ${r.systemUptime}%`
    ].forEach(l => { doc.text(l, 25, y); y += 6; }); y += 6;
    doc.setFontSize(13); doc.setTextColor(40); doc.text('Top 5 Critical Devices', 20, y); y += 8;
    doc.setFontSize(9); r.topCritical.forEach(d => { doc.setTextColor(60); doc.text(`${d.ip} | ${d.device_type} | ${d.risk_percentage}% | ${d.risk_level}`, 25, y); y += 5; }); y += 6;
    if (r.forgottenDevices.length) {
        doc.setFontSize(13); doc.setTextColor(40); doc.text('Forgotten Devices', 20, y); y += 8;
        doc.setFontSize(9); r.forgottenDevices.forEach(d => { doc.setTextColor(60); doc.text(`${d.ip} | ${d.device_type} | ${d.uptime_days} days`, 25, y); y += 5; }); y += 6;
    }
    doc.setFontSize(13); doc.setTextColor(40); doc.text('Recommendations', 20, y); y += 8;
    doc.setFontSize(9);[...new Set(AppState.devices.map(d => d.recommendation))].forEach(rec => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setTextColor(60); const s = doc.splitTextToSize(`• ${rec}`, 165); doc.text(s, 25, y); y += s.length * 5 + 2;
    });
    doc.save('Shadow_Net_Security_Report.pdf');
}
