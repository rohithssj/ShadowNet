/**
 * ShadowNet — Professional Frontend-Only SOC Dashboard
 * Pure browser-based cybersecurity monitoring
 * No backend, no database, no API calls
 */

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL APPLICATION STATE (Single source of truth)
// ═══════════════════════════════════════════════════════════════════════

const AppState = {
    devices: [],
    alertStates: new Map(), // ip -> {status: 'active'|'resolved'|'escalated', timestamp}
    chartInstances: {},
    currentUser: null,
    settings: {
        riskThreshold: 75,
        predictionWindow: 2,
        adminName: 'SOC Admin',
        organization: 'ShadowNet HQ',
        role: 'Security Analyst',
        darkMode: localStorage.getItem('shadownet-dark') === 'true',
        accentColor: localStorage.getItem('shadownet-accent') || '#00ff96'
    }
};

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavbar();
    initRouter();
    bindGlobalFeatures();
    handleRoute();
});

// ═══════════════════════════════════════════════════════════════════════
// THEME MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    // Apply saved theme
    if (!AppState.settings.darkMode) {
        document.body.classList.add('light-mode');
        toggle.checked = true;
    } else {
        document.body.classList.remove('light-mode');
        toggle.checked = false;
    }

    // Apply accent color
    document.documentElement.style.setProperty('--accent-color', AppState.settings.accentColor);

    toggle.addEventListener('change', (e) => {
        AppState.settings.darkMode = !e.target.checked;
        if (e.target.checked) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('shadownet-dark', AppState.settings.darkMode);
    });
}

// ═══════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════

function initNavbar() {
    const hamburger = document.getElementById('hamburger-btn');
    const navLinks = document.getElementById('nav-links');
    const logoutBtn = document.getElementById('btn-logout');
    const clock = document.getElementById('live-clock');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            navLinks?.classList.toggle('open');
        });
    }

    if (navLinks) {
        navLinks.querySelectorAll('.topnav__link').forEach(link => {
            link.addEventListener('click', () => navLinks.classList.remove('open'));
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Logout from ShadowNet SOC?')) {
                window.location.href = 'login.html';
            }
        });
    }

    // Live clock
    if (clock) {
        function updateClock() {
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
            clock.textContent = `${d} ${dd} ${mm} ${yyyy} | ${hh}:${mi}:${ss}`;
        }
        updateClock();
        setInterval(updateClock, 1000);
    }

    // Global search
    initSearch();

    // Alert badge
    updateAlertBadge();
}

function initSearch() {
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (!q) {
            results.classList.remove('visible');
            results.innerHTML = '';
            return;
        }

        const matches = AppState.devices.filter(d =>
            [d.ip, d.device_type, d.risk_level, d.business_impact].some(v => 
                (v || '').toString().toLowerCase().includes(q)
            )
        );

        if (!matches.length) {
            results.innerHTML = '<div class="search-no-results">No devices found</div>';
        } else {
            results.innerHTML = matches.map(d => `
                <div class="search-result-item" data-ip="${d.ip}">
                    <strong>${d.ip}</strong> • ${d.device_type} 
                    <span class="risk-badge risk-badge--${d.risk_level.toLowerCase()}">${d.risk_level}</span>
                </div>
            `).join('');

            results.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = '';
                    results.classList.remove('visible');
                    window.location.hash = '#devices';
                });
            });
        }
        results.classList.add('visible');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.topnav__search-wrapper')) {
            results.classList.remove('visible');
        }
    });
}

function updateAlertBadge() {
    const badge = document.getElementById('alert-badge');
    if (!badge) return;
    const criticalCount = AppState.devices.filter(d => 
        (d.risk_level === 'CRITICAL' || d.risk_level === 'HIGH') &&
        getAlertStatus(d.ip) === 'active'
    ).length;
    badge.textContent = criticalCount;
    badge.style.display = criticalCount > 0 ? 'inline-flex' : 'none';
}

function getAlertStatus(ip) {
    const state = AppState.alertStates.get(ip);
    return state ? state.status : 'active';
}

// ═══════════════════════════════════════════════════════════════════════
// ROUTER (Hash-based SPA)
// ═══════════════════════════════════════════════════════════════════════

function initRouter() {
    window.addEventListener('hashchange', handleRoute);
}

function handleRoute() {
    const hash = (window.location.hash || '#dashboard').replace('#', '') || 'dashboard';
    const content = document.getElementById('content');
    if (!content) return;

    // Clear previous chart instances
    Object.values(AppState.chartInstances).forEach(chart => {
        if (chart && chart.destroy) chart.destroy();
    });
    AppState.chartInstances = {};

    // Update active nav link
    document.querySelectorAll('.topnav__link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === hash);
    });

    // Render page
    const pages = {
        'dashboard': renderDashboard,
        'analytics': renderAnalytics,
        'devices': renderDevices,
        'alerts': renderAlerts,
        'settings': renderSettings,
        'data-input': renderDataInput
    };

    const renderFn = pages[hash] || renderDashboard;
    content.innerHTML = renderFn();
    refreshIcons();

    // Bind page-specific handlers
    const binds = {
        'dashboard': bindDashboard,
        'analytics': bindAnalytics,
        'devices': bindDevices,
        'alerts': bindAlerts,
        'settings': bindSettings,
        'data-input': bindDataInput
    };

    const bindFn = binds[hash];
    if (bindFn) bindFn();
}

function refreshIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL FEATURES
// ═══════════════════════════════════════════════════════════════════════

function bindGlobalFeatures() {
    // Export buttons on dashboard
    document.addEventListener('click', (e) => {
        if (e.target.closest('#export-csv')) {
            exportCSV();
        }
        if (e.target.closest('#export-excel')) {
            exportExcel();
        }
        if (e.target.closest('#export-pdf')) {
            exportPDF();
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD PAGE (Professional Design - UNCHANGED)
// ═══════════════════════════════════════════════════════════════════════

function renderDashboard() {
    if (!AppState.devices.length) {
        return `
            <div class="page-header">
                <h2 class="page-header__title"><i data-lucide="layout-dashboard"></i> Security Operations Dashboard</h2>
                <div class="page-header__actions">
                    <button class="btn btn--outline" id="export-pdf" title="Download PDF Report" style="opacity:0.5;cursor:not-allowed;" disabled>
                        <i data-lucide="file-down"></i> PDF Report
                    </button>
                </div>
            </div>

            <!-- Metric Cards -->
            <div class="cards-grid">
                <div class="metric-card metric-card--info">
                    <div class="metric-card__icon"><i data-lucide="shield"></i></div>
                    <div class="metric-card__value">0</div>
                    <div class="metric-card__label">Security Score</div>
                </div>
                <div class="metric-card metric-card--critical">
                    <div class="metric-card__icon"><i data-lucide="zap"></i></div>
                    <div class="metric-card__value">0</div>
                    <div class="metric-card__label">Critical Devices</div>
                </div>
                <div class="metric-card metric-card--high">
                    <div class="metric-card__icon"><i data-lucide="alert-triangle"></i></div>
                    <div class="metric-card__value">0</div>
                    <div class="metric-card__label">High Risk</div>
                </div>
                <div class="metric-card metric-card--medium">
                    <div class="metric-card__icon"><i data-lucide="activity"></i></div>
                    <div class="metric-card__value">0</div>
                    <div class="metric-card__label">Total Devices</div>
                </div>
            </div>

            <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
                <i data-lucide="inbox" style="font-size:48px;margin-bottom:16px;opacity:0.5;"></i>
                <p style="font-size:1.1em;margin-bottom:24px;">No devices loaded yet</p>
                <a href="#data-input" class="btn btn--primary">Add Devices</a>
            </div>
        `;
    }

    const report = generateReport();
    // show top 5 devices by risk (Top 5 Critical Devices)
    const topFive = report.topCritical.slice(0, 5);
    const highCriticalPct = Math.round(((report.critical + report.high) / report.total) * 100);
    const exposureIndex = Math.round(((report.critical + report.high) / report.total) * 100);
    // Build Top Critical HTML with dynamic severity classes based on risk percentage
    const topCriticalHtml = topFive.map((d, i) => {
        const p = parseInt(d.risk_score ?? d.risk_percentage ?? 0, 10) || 0;
        let cls = 'critical-low';
        let badge = 'Low';
        if (p >= 90) { cls = 'critical-max'; badge = 'Severe'; }
        else if (p >= 75) { cls = 'critical-high'; badge = 'High'; }
        else if (p >= 60) { cls = 'critical-medium'; badge = 'Medium'; }

        return `
            <div class="crit-device-card ${cls}">
                <div class="crit-device-card__body">
                    <div class="crit-device-card__header">
                        <span class="crit-device-card__ip">${d.ip}</span>
                        <span class="severity-badge">${badge}</span>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                        <div class="crit-device-card__score" style="font-size:1.6rem;font-weight:800;color:var(--text-primary);">${p}%</div>
                        <div style="flex:1;margin-left:8px;">
                            <div class="severity-bar"><div class="severity-fill ${cls}" style="width:${p}%;"></div></div>
                        </div>
                    </div>
                    <div class="crit-device-card__type">${d.device_type}</div>
                    <div class="crit-device-card__recommendation">${d.recommendation}</div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="page-header">
            <h2 class="page-header__title"><i data-lucide="layout-dashboard"></i> Security Operations Dashboard</h2>
            <div class="page-header__actions">
                <button class="btn btn--outline" id="export-pdf" title="Download PDF Report">
                    <i data-lucide="file-down"></i> PDF Report
                </button>
                <div class="dropdown-wrapper">
                    <button class="btn btn--outline" id="export-menu-toggle">
                        <i data-lucide="download"></i> Export
                    </button>
                    <div class="dropdown-menu" id="export-menu">
                        <button id="export-csv" class="dropdown-item">
                            <i data-lucide="file-text"></i> CSV
                        </button>
                        <button id="export-excel" class="dropdown-item">
                            <i data-lucide="file-spreadsheet"></i> Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Metric Cards -->
        <div class="cards-grid">
            <div class="metric-card metric-card--info">
                <div class="metric-card__icon"><i data-lucide="shield"></i></div>
                <div class="metric-card__value">${report.securityScore}</div>
                <div class="metric-card__label">Security Score</div>
            </div>
            <div class="metric-card metric-card--critical">
                <div class="metric-card__icon"><i data-lucide="zap"></i></div>
                <div class="metric-card__value">${report.criticalCount}</div>
                <div class="metric-card__label">Critical Devices</div>
            </div>
            <div class="metric-card metric-card--high">
                <div class="metric-card__icon"><i data-lucide="alert-triangle"></i></div>
                <div class="metric-card__value">${report.highCount}</div>
                <div class="metric-card__label">High Risk</div>
            </div>
            <div class="metric-card metric-card--medium">
                <div class="metric-card__icon"><i data-lucide="activity"></i></div>
                <div class="metric-card__value">${report.total}</div>
                <div class="metric-card__label">Total Devices</div>
            </div>
        </div>

        <!-- Risk Distribution | Device Composition | Top 5 Critical Devices (Row) -->
        <div class="dashboard-row">
            <div class="dashboard-col dashboard-col--left">
                <div class="chart-card">
                    <h3 class="section-title"><i data-lucide="pie-chart"></i> Risk Distribution</h3>
                    <div class="chart-container chart-container--donut" style="position:relative;">
                        <canvas id="chart-risk-distribution"></canvas>
                        <div class="chart-center-summary" id="donut-summary">
                            <div class="summary-value">${report.total}</div>
                            <div class="summary-label">Devices</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dashboard-col dashboard-col--mid">
                <div class="chart-card">
                    <h3 class="section-title"><i data-lucide="bar-chart-3"></i> Device Composition</h3>
                    <div class="chart-container chart-container--mid">
                        <canvas id="chart-device-types"></canvas>
                    </div>
                </div>
            </div>

            
        </div>

        <!-- Heatmap removed (frontend-only app) -->

        <!-- Critical Devices Requiring Immediate Attention (Full Width) -->
        <div class="chart-card" style="margin-top:20px;">
            <h3 class="section-title section-title--critical"><i data-lucide="shield-alert"></i> Critical Devices Requiring Immediate Attention</h3>
            <div class="critical-devices-wrapper">
                <div class="critical-devices-grid critical-devices-grid--full">
                    ${topCriticalHtml || '<div style="padding:16px;color:var(--text-muted);">No critical devices at this time.</div>'}
                </div>
            </div>
        </div>
    `;
}

function bindDashboard() {
    // Skip binding if no devices
    if (!AppState.devices.length) return;

    const exportBtn = document.getElementById('export-menu-toggle');
    const exportMenu = document.getElementById('export-menu');

    if (exportBtn && exportMenu) {
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportMenu.classList.toggle('visible');
        });
        document.addEventListener('click', () => exportMenu.classList.remove('visible'), { once: true });
    }

    // Charts
    drawRiskDistributionDonutChart();
    drawDeviceTypesChart();
}

// ═══════════════════════════════════════════════════════════════════════
// ANALYTICS PAGE
// ═══════════════════════════════════════════════════════════════════════

function renderAnalytics() {
    // Zero state handling
    if (!AppState.devices.length) {
        return `
            <div class="page-header">
                <h2 class="page-header__title"><i data-lucide="bar-chart-3"></i> Security Analytics</h2>
            </div>

            <div class="cards-grid">
                <div class="metric-card metric-card--info">
                    <div class="metric-card__icon"><i data-lucide="shield"></i></div>
                    <div class="metric-card__value">0</div>
                    <div class="metric-card__label">Security Score</div>
                </div>
                <div class="metric-card metric-card--low">
                    <div class="metric-card__icon"><i data-lucide="check-circle"></i></div>
                    <div class="metric-card__value">0</div>
                    <div class="metric-card__label">Risks Mitigated</div>
                </div>
                <div class="metric-card metric-card--medium">
                    <div class="metric-card__icon"><i data-lucide="clock"></i></div>
                    <div class="metric-card__value">0h</div>
                    <div class="metric-card__label">Avg Response Time</div>
                </div>
                <div class="metric-card metric-card--medium">
                    <div class="metric-card__icon"><i data-lucide="activity"></i></div>
                    <div class="metric-card__value">0%</div>
                    <div class="metric-card__label">System Uptime</div>
                </div>
            </div>

            <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
                <i data-lucide="inbox" style="font-size:48px;margin-bottom:16px;opacity:0.5;"></i>
                <p style="font-size:1.1em;margin-bottom:24px;">No devices connected. Please upload or add devices.</p>
                <a href="#data-input" class="btn btn--primary">Add Devices Now</a>
            </div>
        `;
    }

    const report = generateReport();
    const legacyRisk = calculateLegacyRisk();

    return `
        <div class="page-header">
            <h2 class="page-header__title"><i data-lucide="bar-chart-3"></i> Security Analytics</h2>
        </div>

        <div class="cards-grid">
            <div class="metric-card metric-card--info">
                <div class="metric-card__icon"><i data-lucide="shield"></i></div>
                <div class="metric-card__value">${report.securityScore}</div>
                <div class="metric-card__label">Security Score</div>
            </div>
            <div class="metric-card metric-card--low">
                <div class="metric-card__icon"><i data-lucide="check-circle"></i></div>
                <div class="metric-card__value">${report.risksMitigated}</div>
                <div class="metric-card__label">Risks Mitigated</div>
            </div>
            <div class="metric-card metric-card--medium">
                <div class="metric-card__icon"><i data-lucide="clock"></i></div>
                <div class="metric-card__value">4h</div>
                <div class="metric-card__label">Avg Response Time</div>
            </div>
            <div class="metric-card metric-card--medium">
                <div class="metric-card__icon"><i data-lucide="activity"></i></div>
                <div class="metric-card__value">95%</div>
                <div class="metric-card__label">System Uptime</div>
            </div>
        </div>

        <!-- Risk by Business Impact (Full Width) -->
        <div class="chart-card chart-card--large">
            <h3 class="section-title"><i data-lucide="layers"></i> Risk by Business Impact</h3>
            <div class="chart-container chart-container--large">
                <div class="analytics-summary" style="display:flex;gap:16px;align-items:center;margin-bottom:12px;">
                    <div class="summary-panel">
                        <strong>Highest Impact:</strong> ${report.highestImpact || 'N/A'}
                    </div>
                    <div class="summary-panel">
                        <strong>% Critical in High Impact:</strong> ${report.percentCriticalInHigh || 0}%
                    </div>
                </div>
                <canvas id="chart-impact-breakdown"></canvas>
            </div>
        </div>

        <!-- Lifecycle Risk Correlation (Large) -->
        <div class="chart-card chart-card--large">
            <h3 class="section-title"><i data-lucide="cpu"></i> Lifecycle Risk Correlation</h3>
            <div class="chart-container chart-container--large">
                <canvas id="chart-lifecycle-correlation"></canvas>
            </div>
            <p class="insight-text" style="margin-top:12px;">Forgotten systems show <strong>${legacyRisk && legacyRisk.deltaPercent ? legacyRisk.deltaPercent : 0}%</strong> higher average risk.</p>
        </div>

        <!-- Current vs Projected Risk Trend -->
        <div class="chart-card chart-card--full">
            <h3 class="section-title"><i data-lucide="trending-up"></i> Current vs Projected Risk Trend</h3>
            <canvas id="chart-risk-trend-dual"></canvas>
        </div>

    `;
}

function bindAnalytics() {
    // Skip binding if no devices
    if (!AppState.devices.length) return;

    drawImpactBreakdownChart();
    drawLifecycleCorrelationChart();
    drawDualRiskTrendChart();
}

// ═══════════════════════════════════════════════════════════════════════
// DEVICES PAGE
// ═══════════════════════════════════════════════════════════════════════

function renderDevices() {
    const sorted = [...AppState.devices].sort((a, b) => b.risk_score - a.risk_score);

    return `
        <div class="page-header">
            <h2 class="page-header__title"><i data-lucide="monitor"></i> Monitored Devices</h2>
            <div class="page-header__actions">
                <input type="text" id="device-filter" class="filter-input" placeholder="Filter by IP or type...">
                <select id="device-sort" class="filter-select">
                    <option value="risk-desc">Risk (High to Low)</option>
                    <option value="risk-asc">Risk (Low to High)</option>
                    <option value="ip">IP Address</option>
                </select>
            </div>
        </div>

        <div class="devices-table-wrapper">
            <table class="devices-table">
                <thead>
                    <tr>
                        <th>IP Address</th>
                        <th>Device Type</th>
                        <th>Risk Score</th>
                        <th>Risk Level</th>
                        <th>Business Impact</th>
                        <th>Last Patch</th>
                        <th>Uptime (days)</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="devices-tbody">
                    ${sorted.map((d, i) => `
                        <tr class="row--${d.risk_level.toLowerCase()}" data-ip="${d.ip}">
                            <td><strong>${d.ip}</strong></td>
                            <td>${d.device_type}</td>
                            <td><strong>${d.risk_score}</strong></td>
                            <td><span class="risk-badge risk-badge--${d.risk_level.toLowerCase()}">${d.risk_level}</span></td>
                            <td><span class="impact-badge impact-badge--${d.business_impact.toLowerCase()}">${d.business_impact}</span></td>
                            <td>${d.last_patch_year}</td>
                            <td>${d.uptime_days}</td>
                            <td>
                                <button class="btn btn--sm btn--outline device-expand-btn" data-ip="${d.ip}">
                                    <i data-lucide="chevron-down"></i>
                                </button>
                            </td>
                        </tr>
                        <tr class="device-detail-row" id="detail-${d.ip}" style="display:none;">
                            <td colspan="8">
                                <div class="device-detail">
                                    <h4>Risk Analysis</h4>
                                    <p><strong>Ports:</strong> ${d.open_ports ? d.open_ports.join(', ') : d.port}</p>
                                    <p><strong>Protocol:</strong> ${d.protocol}</p>
                                    <p><strong>Risk Recommendation:</strong></p>
                                    <p style="font-size:1.05em;color:var(--accent-color);font-weight:500;">${d.recommendation}</p>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function bindDevices() {
    // Expand details
    document.querySelectorAll('.device-expand-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ip = btn.dataset.ip;
            const detailRow = document.getElementById(`detail-${ip}`);
            if (detailRow) {
                detailRow.style.display = detailRow.style.display === 'none' ? 'table-row' : 'none';
                btn.classList.toggle('expanded');
            }
        });
    });

    // Filter
    const filterInput = document.getElementById('device-filter');
    const sortSelect = document.getElementById('device-sort');

    if (filterInput) {
        filterInput.addEventListener('input', () => filterAndSortDevices());
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', () => filterAndSortDevices());
    }
}

function filterAndSortDevices() {
    const filterInput = document.getElementById('device-filter');
    const sortSelect = document.getElementById('device-sort');
    const tbody = document.getElementById('devices-tbody');
    if (!tbody) return;

    const filterText = (filterInput?.value || '').toLowerCase();
    const sortType = sortSelect?.value || 'risk-desc';

    let filtered = AppState.devices.filter(d =>
        d.ip.toLowerCase().includes(filterText) ||
        d.device_type.toLowerCase().includes(filterText)
    );

    // Sort
    switch (sortType) {
        case 'risk-desc':
            filtered.sort((a, b) => b.risk_score - a.risk_score);
            break;
        case 'risk-asc':
            filtered.sort((a, b) => a.risk_score - b.risk_score);
            break;
        case 'ip':
            filtered.sort((a, b) => a.ip.localeCompare(b.ip));
            break;
    }

    // Re-render
    const html = filtered.map((d, i) => `
        <tr class="row--${d.risk_level.toLowerCase()}" data-ip="${d.ip}">
            <td><strong>${d.ip}</strong></td>
            <td>${d.device_type}</td>
            <td><strong>${d.risk_score}</strong></td>
            <td><span class="risk-badge risk-badge--${d.risk_level.toLowerCase()}">${d.risk_level}</span></td>
            <td><span class="impact-badge impact-badge--${d.business_impact.toLowerCase()}">${d.business_impact}</span></td>
            <td>${d.last_patch_year}</td>
            <td>${d.uptime_days}</td>
            <td>
                <button class="btn btn--sm btn--outline device-expand-btn" data-ip="${d.ip}">
                    <i data-lucide="chevron-down"></i>
                </button>
            </td>
        </tr>
        <tr class="device-detail-row" id="detail-${d.ip}" style="display:none;">
            <td colspan="8">
                <div class="device-detail">
                    <h4>Risk Analysis</h4>
                    <p><strong>Ports:</strong> ${d.open_ports ? d.open_ports.join(', ') : d.port}</p>
                    <p><strong>Protocol:</strong> ${d.protocol}</p>
                    <p><strong>Risk Recommendation:</strong></p>
                    <p style="font-size:1.05em;color:var(--accent-color);font-weight:500;">${d.recommendation}</p>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = html;
    refreshIcons();

    // Re-bind expand buttons
    document.querySelectorAll('.device-expand-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ip = btn.dataset.ip;
            const detailRow = document.getElementById(`detail-${ip}`);
            if (detailRow) {
                detailRow.style.display = detailRow.style.display === 'none' ? 'table-row' : 'none';
                btn.classList.toggle('expanded');
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════
// ALERTS PAGE
// ═══════════════════════════════════════════════════════════════════════

function renderAlerts() {
    const critical = AppState.devices.filter(d => 
        (d.risk_level === 'CRITICAL' || d.risk_level === 'HIGH') &&
        getAlertStatus(d.ip) === 'active'
    );

    const resolved = AppState.devices.filter(d =>
        getAlertStatus(d.ip) === 'resolved'
    );

    const escalated = AppState.devices.filter(d =>
        getAlertStatus(d.ip) === 'escalated'
    );

    return `
        <div class="page-header">
            <h2 class="page-header__title"><i data-lucide="bell"></i> Alert Management</h2>
        </div>

        <div class="tabs">
            <button class="tab-btn active" data-tab="active">
                <i data-lucide="alert-circle"></i> Active (${critical.length})
            </button>
            <button class="tab-btn" data-tab="resolved">
                <i data-lucide="check-circle"></i> Resolved (${resolved.length})
            </button>
            <button class="tab-btn" data-tab="escalated">
                <i data-lucide="trending-up"></i> Escalated (${escalated.length})
            </button>
        </div>

        <div class="tab-content active" id="tab-active">
            <div class="alerts-list">
                ${critical.length ? critical.map(d => `
                    <div class="alert-card alert-card--${d.risk_level.toLowerCase()}">
                        <div class="alert-card__header">
                            <div class="alert-card__title">
                                <i data-lucide="${d.risk_level === 'CRITICAL' ? 'alert-circle' : 'alert-triangle'}"></i>
                                ${d.ip} - ${d.device_type}
                            </div>
                            <span class="risk-badge risk-badge--${d.risk_level.toLowerCase()}">${d.risk_level}</span>
                        </div>
                        <div class="alert-card__body">
                            <p><strong>Risk Score:</strong> ${d.risk_score}</p>
                            <p><strong>Recommendation:</strong> ${d.recommendation}</p>
                        </div>
                        <div class="alert-card__actions">
                            <button class="btn btn--sm btn--success alert-resolve-btn" data-ip="${d.ip}">
                                <i data-lucide="check"></i> Resolve
                            </button>
                            <button class="btn btn--sm btn--warning alert-escalate-btn" data-ip="${d.ip}">
                                <i data-lucide="arrow-up"></i> Escalate
                            </button>
                        </div>
                    </div>
                `).join('') : '<p style="text-align:center;color:var(--text-muted);">No active alerts</p>'}
            </div>
        </div>

        <div class="tab-content" id="tab-resolved">
            <div class="alerts-list">
                ${resolved.length ? resolved.map(d => `
                    <div class="alert-card alert-card--resolved">
                        <div class="alert-card__header">
                            <div class="alert-card__title">
                                <i data-lucide="check-circle"></i>
                                ${d.ip} - ${d.device_type}
                            </div>
                            <span class="status-badge status-badge--resolved">RESOLVED</span>
                        </div>
                        <div class="alert-card__body">
                            <p><strong>Risk Score:</strong> ${d.risk_score}</p>
                        </div>
                        <div class="alert-card__actions">
                            <button class="btn btn--sm btn--outline alert-reopen-btn" data-ip="${d.ip}">
                                <i data-lucide="undo"></i> Reopen
                            </button>
                        </div>
                    </div>
                `).join('') : '<p style="text-align:center;color:var(--text-muted);">No resolved alerts</p>'}
            </div>
        </div>

        <div class="tab-content" id="tab-escalated">
            <div class="alerts-list">
                ${escalated.length ? escalated.map(d => `
                    <div class="alert-card alert-card--escalated">
                        <div class="alert-card__header">
                            <div class="alert-card__title">
                                <i data-lucide="arrow-up"></i>
                                ${d.ip} - ${d.device_type}
                            </div>
                            <span class="status-badge status-badge--escalated">ESCALATED</span>
                        </div>
                        <div class="alert-card__body">
                            <p><strong>Risk Score:</strong> ${d.risk_score}</p>
                            <p><strong>Priority:</strong> HIGH</p>
                        </div>
                        <div class="alert-card__actions">
                            <button class="btn btn--sm btn--outline alert-unresolve-btn" data-ip="${d.ip}">
                                <i data-lucide="undo"></i> Mark Active
                            </button>
                        </div>
                    </div>
                `).join('') : '<p style="text-align:center;color:var(--text-muted);">No escalated alerts</p>'}
            </div>
        </div>
    `;
}

function bindAlerts() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
        });
    });

    // Alert actions
    document.querySelectorAll('.alert-resolve-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ip = btn.dataset.ip;
            AppState.alertStates.set(ip, { status: 'resolved', timestamp: new Date() });
            updateAlertBadge();
            handleRoute();
        });
    });

    document.querySelectorAll('.alert-escalate-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ip = btn.dataset.ip;
            AppState.alertStates.set(ip, { status: 'escalated', timestamp: new Date() });
            updateAlertBadge();
            handleRoute();
        });
    });

    document.querySelectorAll('.alert-reopen-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ip = btn.dataset.ip;
            AppState.alertStates.set(ip, { status: 'active', timestamp: new Date() });
            updateAlertBadge();
            handleRoute();
        });
    });

    document.querySelectorAll('.alert-unresolve-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const ip = btn.dataset.ip;
            AppState.alertStates.set(ip, { status: 'active', timestamp: new Date() });
            updateAlertBadge();
            handleRoute();
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════

function renderSettings() {
    const s = AppState.settings;

    return `
        <div class="page-header">
            <h2 class="page-header__title"><i data-lucide="settings"></i> Settings & Configuration</h2>
        </div>

        <div class="settings-container">
            <div class="settings-section">
                <h3>Organization Profile</h3>
                <div class="form-group">
                    <label>Admin Name</label>
                    <input type="text" id="setting-admin-name" class="form-input" value="${s.adminName}">
                </div>
                <div class="form-group">
                    <label>Organization</label>
                    <input type="text" id="setting-org" class="form-input" value="${s.organization}">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <input type="text" id="setting-role" class="form-input" value="${s.role}">
                </div>
            </div>

            <div class="settings-section">
                <h3>Risk Configuration</h3>
                <div class="form-group">
                    <label>Risk Threshold (%)</label>
                    <input type="number" id="setting-risk-threshold" class="form-input" 
                           value="${s.riskThreshold}" min="0" max="100">
                </div>
                <div class="form-group">
                    <label>Prediction Window (years)</label>
                    <input type="number" id="setting-pred-window" class="form-input" 
                           value="${s.predictionWindow}" min="1" max="5">
                </div>
            </div>

            <div class="settings-section">
                <h3>Appearance</h3>
                <div class="form-group">
                    <label>Accent Color</label>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <input type="color" id="setting-accent-color" class="form-input" 
                               value="${s.accentColor}" style="width:60px;height:40px;">
                        <span id="accent-preview" style="padding:8px 16px;border-radius:4px;background:${s.accentColor};color:#000;font-weight:bold;">
                            Preview
                        </span>
                    </div>
                </div>
            </div>

            <div class="settings-section">
                <h3>Data Management</h3>
                <button class="btn btn--danger" id="clear-data-btn">
                    <i data-lucide="trash-2"></i> Clear All Data
                </button>
            </div>

            <div style="margin-top:30px;text-align:center;">
                <button class="btn btn--primary" id="save-settings-btn">
                    <i data-lucide="save"></i> Save Settings
                </button>
            </div>
        </div>
    `;
}

function bindSettings() {
    document.getElementById('save-settings-btn')?.addEventListener('click', () => {
        AppState.settings.adminName = document.getElementById('setting-admin-name')?.value || '';
        AppState.settings.organization = document.getElementById('setting-org')?.value || '';
        AppState.settings.role = document.getElementById('setting-role')?.value || '';
        AppState.settings.riskThreshold = parseInt(document.getElementById('setting-risk-threshold')?.value) || 75;
        AppState.settings.predictionWindow = parseInt(document.getElementById('setting-pred-window')?.value) || 2;
        
        const newAccentColor = document.getElementById('setting-accent-color')?.value;
        if (newAccentColor) {
            AppState.settings.accentColor = newAccentColor;
            localStorage.setItem('shadownet-accent', newAccentColor);
            document.documentElement.style.setProperty('--accent-color', newAccentColor);
        }

        localStorage.setItem('shadownet-settings', JSON.stringify({
            adminName: AppState.settings.adminName,
            organization: AppState.settings.organization,
            role: AppState.settings.role,
            riskThreshold: AppState.settings.riskThreshold,
            predictionWindow: AppState.settings.predictionWindow
        }));

        alert('Settings saved successfully!');
    });

    document.getElementById('setting-accent-color')?.addEventListener('change', (e) => {
        const preview = document.getElementById('accent-preview');
        if (preview) {
            preview.style.background = e.target.value;
        }
    });

    document.getElementById('clear-data-btn')?.addEventListener('click', () => {
        if (confirm('This will clear ALL devices and reset the application. Continue?')) {
            AppState.devices = [];
            AppState.alertStates.clear();
            localStorage.removeItem('shadownet-devices');
            updateAlertBadge();
            window.location.hash = '#dashboard';
            handleRoute();
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════
// DATA INPUT PAGE
// ═══════════════════════════════════════════════════════════════════════

function renderDataInput() {
    return `
        <div class="page-header">
            <h2 class="page-header__title"><i data-lucide="plus-circle"></i> Add Devices</h2>
            <p style="color:var(--text-muted);margin-top:8px;">Import devices via manual entry or file upload</p>
        </div>

        <div class="data-input-container">
            <div class="tabs">
                <button class="tab-btn active" data-tab="manual"><i data-lucide="keyboard"></i> Manual Entry</button>
                <button class="tab-btn" data-tab="upload"><i data-lucide="upload"></i> Upload File</button>
            </div>

            <!-- Manual Entry Tab -->
            <div class="tab-content active" id="tab-manual">
                <form id="manual-device-form" class="device-form">
                    <div class="form-group">
                        <label>IP Address</label>
                        <input type="text" name="ip" class="form-input" placeholder="e.g., 192.168.1.100" required>
                    </div>
                    <div class="form-group">
                        <label>Port(s) (comma-separated)</label>
                        <input type="text" name="port" class="form-input" placeholder="e.g., 22, 80, 443" required>
                    </div>
                    <div class="form-group">
                        <label>Protocol</label>
                        <select name="protocol" class="form-input" required>
                            <option value="">Select Protocol</option>
                            <option value="TCP">TCP</option>
                            <option value="UDP">UDP</option>
                            <option value="HTTP">HTTP</option>
                            <option value="HTTPS">HTTPS</option>
                            <option value="SSH">SSH</option>
                            <option value="RDP">RDP</option>
                            <option value="FTP">FTP</option>
                            <option value="SMTP">SMTP</option>
                            <option value="DNS">DNS</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Last Patch Year</label>
                        <input type="number" name="last_patch_year" class="form-input" 
                               placeholder="e.g., 2022" min="2000" max="2099" required>
                    </div>
                    <div class="form-group">
                        <label>Uptime (days)</label>
                        <input type="number" name="uptime_days" class="form-input" 
                               placeholder="e.g., 365" min="0" required>
                    </div>
                    <button type="submit" class="btn btn--primary">
                        <i data-lucide="plus"></i> Add Device
                    </button>
                </form>
            </div>

            <!-- Upload Tab -->
            <div class="tab-content" id="tab-upload">
                <div class="upload-zone" id="upload-zone">
                    <i data-lucide="cloud-upload" style="font-size:48px;margin-bottom:16px;"></i>
                    <p style="font-weight:600;margin-bottom:8px;">Drag CSV or Excel file here</p>
                    <p style="color:var(--text-muted);font-size:0.9em;">or click to browse</p>
                    <input type="file" id="device-upload" accept=".csv,.xlsx,.xls" style="display:none;">
                </div>
                <div style="margin-top:16px;padding:12px;background:rgba(0,255,150,0.1);border-radius:4px;border-left:3px solid var(--accent-color);">
                    <p style="margin:0;font-size:0.9em;"><strong>Required columns:</strong> ip, port, protocol, last_patch_year, uptime</p>
                </div>
            </div>
        </div>

        <!-- Upload Preview Section -->
        <div id="upload-preview-section" style="margin-top:40px;display:none;">
            <h3 style="color:var(--text-primary);margin-bottom:16px;"><span id="preview-count">0</span> Devices Detected</h3>
            <div class="preview-table-wrapper">
                <table class="preview-table">
                    <thead>
                        <tr>
                            <th>IP Address</th>
                            <th>Port</th>
                            <th>Protocol</th>
                            <th>Last Patch Year</th>
                            <th>Uptime (days)</th>
                        </tr>
                    </thead>
                    <tbody id="preview-tbody">
                    </tbody>
                </table>
            </div>
            <div style="display:flex;gap:12px;margin-top:20px;">
                <button class="btn btn--primary" id="confirm-upload-btn">
                    <i data-lucide="check"></i> Add Devices to Dashboard
                </button>
                <button class="btn btn--outline" id="clear-upload-btn">
                    <i data-lucide="x"></i> Clear Upload
                </button>
            </div>
        </div>

        <!-- Devices List -->
        <div id="devices-staging" style="margin-top:40px;">
            ${AppState.devices.length ? `
                <h3>Loaded Devices (${AppState.devices.length})</h3>
                <div class="devices-staging-grid">
                    ${AppState.devices.map((d, i) => `
                        <div class="staging-card staging-card--${d.risk_level.toLowerCase()}">
                            <div class="staging-card__header">
                                <strong>${d.ip}</strong>
                                <button type="button" class="btn btn--sm btn--danger device-remove-btn" data-index="${i}">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                            <p><small>${d.device_type}</small></p>
                            <p><small>Risk: <strong>${d.risk_score}</strong> - ${d.risk_level}</small></p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function bindDataInput() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = btn.dataset.tab;
            const tabContent = document.getElementById(`tab-${tabName}`);
            
            if (tabContent) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                tabContent.classList.add('active');
            }
        });
    });

    // Manual entry form
    document.getElementById('manual-device-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const ports = fd.get('port').split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        
        const device = {
            ip: fd.get('ip'),
            port: ports[0] || 0,
            open_ports: ports,
            protocol: fd.get('protocol'),
            last_patch_year: parseInt(fd.get('last_patch_year')),
            uptime_days: parseInt(fd.get('uptime_days')),
            device_type: 'Manual Entry'
        };

        calculateDeviceRisk(device);
        AppState.devices.push(device);
        e.target.reset();
        handleRoute();
    });

    // File upload
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('device-upload');

    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--accent-color)';
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = 'transparent';
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'transparent';
            if (e.dataTransfer.files.length) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) {
                handleFileUpload(fileInput.files[0]);
            }
        });
    }

    // Remove device buttons
    document.querySelectorAll('.device-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            AppState.devices.splice(index, 1);
            handleRoute();
        });
    });

    // Confirm upload button
    document.getElementById('confirm-upload-btn')?.addEventListener('click', () => {
        const previewDevices = window.__previewDevices || [];
        if (!previewDevices.length) {
            alert('No devices to add. Please upload a file first');
            return;
        }
        previewDevices.forEach(device => {
            calculateDeviceRisk(device);
            AppState.devices.push(device);
        });
        clearUploadPreview();
        handleRoute();
    });

    // Clear upload button
    document.getElementById('clear-upload-btn')?.addEventListener('click', () => {
        clearUploadPreview();
    });
}

function handleFileUpload(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    // Validate file extension
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        alert('Invalid file format. Please upload CSV or Excel file.');
        // Reset file input
        document.getElementById('device-upload').value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        let devices = [];
        try {
            if (['xlsx', 'xls'].includes(ext)) {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet);
                devices = data;
            } else {
                const csv = e.target.result;
                devices = Papa.parse(csv, { header: true }).data.filter(row => row.ip);
            }

            if (!devices.length) {
                alert('No devices found in file');
                document.getElementById('device-upload').value = '';
                return;
            }

            // Parse and validate
            const validDevices = [];
            devices.forEach(d => {
                // Check if uptime field exists (might be 'uptime' or 'uptime_days')
                const uptimeVal = d.uptime_days || d.uptime;
                if (d.ip && d.port && d.protocol && d.last_patch_year && uptimeVal) {
                    const device = {
                        ip: d.ip.toString(),
                        port: parseInt(d.port) || 0,
                        open_ports: [parseInt(d.port) || 0],
                        protocol: d.protocol.toString(),
                        last_patch_year: parseInt(d.last_patch_year),
                        uptime_days: parseInt(uptimeVal),
                        device_type: 'File Import',
                        risk_score: 0,
                        risk_level: 'MEDIUM',
                        business_impact: 'MEDIUM',
                        recommendation: ''
                    };
                    validDevices.push(device);
                }
            });

            if (!validDevices.length) {
                alert('No valid devices found. Please ensure all rows have: ip, port, protocol, last_patch_year, uptime');
                document.getElementById('device-upload').value = '';
                return;
            }

            // Show preview
            showUploadPreview(validDevices);
        } catch (err) {
            console.error(err);
            alert('Error parsing file: ' + err.message);
            document.getElementById('device-upload').value = '';
        }
    };

    if (['xlsx', 'xls'].includes(ext)) {
        reader.readAsBinaryString(file);
    } else {
        reader.readAsText(file);
    }
}

function showUploadPreview(devices) {
    // Store devices in temp variable
    window.__previewDevices = devices;
    
    const previewSection = document.getElementById('upload-preview-section');
    const previewCount = document.getElementById('preview-count');
    const previewTbody = document.getElementById('preview-tbody');
    
    if (!previewSection || !previewTbody) return;
    
    // Update count
    previewCount.textContent = devices.length;
    
    // Clear and populate preview table
    previewTbody.innerHTML = devices.map(d => `
        <tr>
            <td><strong>${d.ip}</strong></td>
            <td>${d.port}</td>
            <td>${d.protocol}</td>
            <td>${d.last_patch_year}</td>
            <td>${d.uptime_days}</td>
        </tr>
    `).join('');
    
    // Show preview section
    previewSection.style.display = 'block';
}

function clearUploadPreview() {
    const previewSection = document.getElementById('upload-preview-section');
    const fileInput = document.getElementById('device-upload');
    
    if (previewSection) previewSection.style.display = 'none';
    if (fileInput) fileInput.value = '';
    window.__previewDevices = [];
}

// ═══════════════════════════════════════════════════════════════════════
// RISK CALCULATION (Frontend Only)
// ═══════════════════════════════════════════════════════════════════════

function calculateDeviceRisk(device) {
    const currentYear = new Date().getFullYear();
    const patchAge = currentYear - device.last_patch_year;

    let risk = 0;

    // Patch age risk
    if (patchAge >= 5) risk += 40;
    else if (patchAge >= 3) risk += 25;
    else risk += 10;

    // Uptime risk
    if (device.uptime_days > 365) risk += 30;

    // Port risk
    const ports = device.open_ports || [device.port];
    if (ports.some(p => p === 22 || p === 3389)) risk += 20;

    // Protocol risk
    if (device.protocol === 'HTTP') risk += 10;

    device.risk_score = Math.min(risk, 100);
    device.risk_level = getRiskLevel(device.risk_score);
    device.business_impact = getBusinessImpact(device.risk_level);
    device.recommendation = getRecommendation(device.risk_level);
}

function getRiskLevel(score) {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
}

function getBusinessImpact(riskLevel) {
    const impacts = {
        'CRITICAL': 'CRITICAL',
        'HIGH': 'HIGH',
        'MEDIUM': 'MEDIUM',
        'LOW': 'LOW'
    };
    return impacts[riskLevel] || 'MEDIUM';
}

function getRecommendation(riskLevel) {
    const recommendations = {
        'CRITICAL': 'Immediate isolation and emergency patching required',
        'HIGH': 'Urgent remediation needed within 24-48 hours',
        'MEDIUM': 'Schedule maintenance window for patching',
        'LOW': 'Continue monitoring, patch in regular cycle'
    };
    return recommendations[riskLevel] || 'Monitor device';
}

// ═══════════════════════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════════════════════

function generateReport() {
    const critical = AppState.devices.filter(d => d.risk_level === 'CRITICAL').length;
    const high = AppState.devices.filter(d => d.risk_level === 'HIGH').length;
    const medium = AppState.devices.filter(d => d.risk_level === 'MEDIUM').length;
    const low = AppState.devices.filter(d => d.risk_level === 'LOW').length;
    const total = AppState.devices.length;

    const avgRisk = total ? Math.round(AppState.devices.reduce((s, d) => s + d.risk_score, 0) / total) : 0;
    const securityScore = Math.max(0, 100 - avgRisk);

    return {
        total,
        critical,
        high,
        medium,
        low,
        securityScore,
        criticalCount: critical,
        highCount: high,
        riskDist: { CRITICAL: critical, HIGH: high, MEDIUM: medium, LOW: low },
        topCritical: [...AppState.devices].sort((a, b) => b.risk_score - a.risk_score),
        risksMitigated: 0,
        deviceTypes: getDeviceTypeDist()
    };
}

function getDeviceTypeDist() {
    const dist = {};
    AppState.devices.forEach(d => {
        dist[d.device_type] = (dist[d.device_type] || 0) + 1;
    });
    return dist;
}

function calculateImpactBreakdown() {
    const impacts = {};
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(i => {
        impacts[i] = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    });

    AppState.devices.forEach(d => {
        if (impacts[d.business_impact]) {
            impacts[d.business_impact][d.risk_level] = (impacts[d.business_impact][d.risk_level] || 0) + 1;
        }
    });
    return impacts;
}

function calculateLegacyBreakdown() {
    const currentYear = new Date().getFullYear();
    let legacyRisks = [];
    let modernRisks = [];

    AppState.devices.forEach(d => {
        if (currentYear - d.last_patch_year >= 5) {
            legacyRisks.push(d.risk_score);
        } else {
            modernRisks.push(d.risk_score);
        }
    });

    const legacy = legacyRisks.length ? Math.round(legacyRisks.reduce((a, b) => a + b) / legacyRisks.length) : 0;
    const modern = modernRisks.length ? Math.round(modernRisks.reduce((a, b) => a + b) / modernRisks.length) : 0;

    return { legacy, modern };
}

function calculateLegacyRisk() {
    return calculateLegacyBreakdown();
}



function getImpactInsight() {
    const impactData = calculateImpactBreakdown();
    const criticalImpact = (impactData['CRITICAL'] || {}).CRITICAL || 0;
    const totalCritical = AppState.devices.filter(d => d.risk_level === 'CRITICAL').length;
    
    if (totalCritical === 0) return 'All critical systems are currently protected.';
    const pct = Math.round((criticalImpact / totalCritical) * 100);
    return `Critical risks affecting <strong>${pct}%</strong> of critical business systems. Immediate remediation required for business continuity.`;
}

// ═══════════════════════════════════════════════════════════════════════
// CHARTS (Using Chart.js from CDN)
// ═══════════════════════════════════════════════════════════════════════

function drawRiskDistributionDonutChart() {
    const ctx = document.getElementById('chart-risk-distribution');
    if (!ctx) return;

    const report = generateReport();
    const total = report.total;
    const data = [report.critical, report.high, report.medium, report.low];
    const labels = ['Critical', 'High', 'Medium', 'Low'];
    const percentages = data.map(v => ((v / total) * 100).toFixed(1));

    AppState.chartInstances.riskDist = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e'],
                borderColor: 'var(--bg-card)',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    align: 'center',
                    labels: {
                        font: { size: 12 },
                        padding: 10,
                        boxWidth: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const val = context.parsed || 0;
                            const pct = total ? ((val / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${val} devices (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // Update center summary
    const summary = document.getElementById('donut-summary');
    if (summary) {
        const highCriticalPct = Math.round(((report.critical + report.high) / total) * 100);
        summary.innerHTML = `
            <div class="summary-value">${report.securityScore}%</div>
            <div class="summary-label">Security Score</div>
            <div class="summary-subtext">${highCriticalPct}% High+Critical</div>
        `;
    }
}

function drawDeviceTypesChart() {
    const ctx = document.getElementById('chart-device-types');
    if (!ctx) return;

    const report = generateReport();
    const sortedTypes = Object.entries(report.deviceTypes || {}).sort((a,b) => b[1] - a[1]);
    const top = sortedTypes.slice(0, 8);
    const types = top.map(t => t[0]);
    const counts = top.map(t => t[1]);

    AppState.chartInstances.deviceTypes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: types,
            datasets: [{
                label: 'Device Count',
                data: counts,
                backgroundColor: '#38bdf844',
                borderColor: '#38bdf8',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => items[0].label,
                        label: (ctx) => `${ctx.parsed.x} devices`
                    }
                }
            },
            scales: {
                x: { beginAtZero: true },
                y: {
                    ticks: {
                        callback: function(val, index) {
                            const label = this.getLabelForValue(index) || '';
                            return label.length > 24 ? label.substring(0, 21) + '…' : label;
                        }
                    }
                }
            }
        }
    });
}

function drawImpactBreakdownChart() {
    const ctx = document.getElementById('chart-impact-breakdown');
    if (!ctx) return;

    const impactData = calculateImpactBreakdown();
    const impacts = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    AppState.chartInstances.impactBreakdown = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: impacts,
            datasets: [
                {
                    label: 'Critical Risk',
                    data: impacts.map(i => impactData[i]?.CRITICAL || 0),
                    backgroundColor: '#ef4444'
                },
                {
                    label: 'High Risk',
                    data: impacts.map(i => impactData[i]?.HIGH || 0),
                    backgroundColor: '#f97316'
                },
                {
                    label: 'Medium Risk',
                    data: impacts.map(i => impactData[i]?.MEDIUM || 0),
                    backgroundColor: '#eab308'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, beginAtZero: true },
                y: { stacked: true }
            },
            plugins: {
                legend: { position: 'bottom', labels: { padding: 12 } }
            }
        }
    });
}

function drawLifecycleCorrelationChart() {
    const ctx = document.getElementById('chart-lifecycle-correlation');
    if (!ctx) return;

    const legacyData = calculateLegacyBreakdown();

    AppState.chartInstances.lifecycleCorr = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Forgotten (5+ yrs)', 'Maintained (<3 yrs)'],
            datasets: [{
                label: 'Average Risk %',
                data: [legacyData.legacy, legacyData.modern],
                backgroundColor: ['#ef4444', '#22c55e'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}% (${ctx.raw}%)` } }
            }
        }
    });
}

function drawDualRiskTrendChart() {
    const ctx = document.getElementById('chart-risk-trend-dual');
    if (!ctx) return;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const currentTrend = [65, 62, 58, 55, 50, 48];
    const projectedTrend = [65, 68, 72, 75, 78, 82];

    AppState.chartInstances.riskTrendDual = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Current Risk',
                    data: currentTrend,
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    tension: 0.4,
                    fill: false,
                    pointRadius: 5
                },
                {
                    label: 'Projected Risk',
                    data: projectedTrend,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    tension: 0.4,
                    fill: false,
                    borderDash: [5, 5],
                    pointRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}



// ═══════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function exportCSV() {
    const headers = ['IP', 'Device Type', 'Risk Score', 'Risk Level', 'Business Impact', 'Last Patch Year', 'Uptime Days'];
    const rows = AppState.devices.map(d => [
        d.ip,
        d.device_type,
        d.risk_score,
        d.risk_level,
        d.business_impact,
        d.last_patch_year,
        d.uptime_days
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(v => `"${v}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shadownet-devices-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function exportExcel() {
    const data = AppState.devices.map(d => ({
        'IP Address': d.ip,
        'Device Type': d.device_type,
        'Risk Score': d.risk_score,
        'Risk Level': d.risk_level,
        'Business Impact': d.business_impact,
        'Last Patch': d.last_patch_year,
        'Uptime (days)': d.uptime_days,
        'Recommendation': d.recommendation
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Devices');
    XLSX.writeFile(wb, `shadownet-devices-${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const report = generateReport();

    pdf.setFontSize(20);
    pdf.text('ShadowNet Security Report', 14, 15);

    pdf.setFontSize(11);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
    pdf.text(`Organization: ${AppState.settings.organization}`, 14, 32);

    pdf.setFontSize(14);
    pdf.text('Summary', 14, 45);
    pdf.setFontSize(11);
    pdf.text(`Security Score: ${report.securityScore}%`, 14, 53);
    pdf.text(`Total Devices: ${report.total}`, 14, 60);
    pdf.text(`Critical: ${report.critical} | High: ${report.high} | Medium: ${report.medium} | Low: ${report.low}`, 14, 67);

    // Device table
    const tableData = AppState.devices.map(d => [
        d.ip,
        d.device_type,
        d.risk_score,
        d.risk_level,
        d.business_impact
    ]);

    pdf.autoTable({
        head: [['IP', 'Device Type', 'Risk Score', 'Risk Level', 'Impact']],
        body: tableData,
        startY: 80,
        theme: 'grid'
    });

    pdf.save(`shadownet-report-${new Date().toISOString().split('T')[0]}.pdf`);
}




