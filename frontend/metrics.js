class MetricsApp {
    constructor() {
        this.init();
    }

    init() {
        lucide.createIcons();
        this.fetchModelInfo();

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const icon = refreshBtn.querySelector('svg');
                if (icon) icon.classList.add('animate-spin');
                this.fetchMetrics().finally(() => {
                    setTimeout(() => { if (icon) icon.classList.remove('animate-spin'); }, 500);
                });
            });
        }

        // Initial fetch
        this.fetchMetrics();
        // Auto refresh every 10 seconds
        setInterval(() => this.fetchMetrics(), 10000);
    }

    async fetchModelInfo() {
        try {
            const response = await fetch('info');

            const systemStatus = document.getElementById('system-status');
            const systemStatusText = document.getElementById('system-status-text');

            if (response.ok) {
                const data = await response.json();
                const text = `Powered by ${data.model_name} (v${data.version})`;
                const pbText = document.getElementById('powered-by-text');
                // if (pbText) pbText.textContent = text;
                if (data.grafana_url) {
                    const monitoringLinks = document.querySelectorAll('.monitoring-link');
                    monitoringLinks.forEach(link => {
                        link.href = data.grafana_url;
                    });
                }

                if (systemStatus) {
                    systemStatus.className = 'status-badge healthy';
                    systemStatusText.textContent = 'Healthy (Serving Requests)';
                }

                // Populate Model Version card
                const versionElem = document.getElementById('model-version-value');
                if (versionElem) versionElem.textContent = `v${data.version}`;

                const nameDesc = document.getElementById('model-name-desc');
                if (nameDesc) nameDesc.textContent = `Model: ${data.model_name} · Served via TensorFlow Serving.`;
            } else {
                if (systemStatus) {
                    systemStatus.className = 'status-badge error';
                    systemStatusText.textContent = 'Error (Unreachable)';
                }
            }
        } catch (err) {
            console.error("Failed to fetch model info:", err);
            const systemStatus = document.getElementById('system-status');
            const systemStatusText = document.getElementById('system-status-text');
            if (systemStatus) {
                systemStatus.className = 'status-badge error';
                systemStatusText.textContent = 'Disconnected';
            }
        }
    }

    async fetchMetrics() {
        try {
            const response = await fetch('/metrics');
            if (!response.ok) throw new Error('Failed to fetch metrics');

            const text = await response.text();
            const lines = text.split('\n');

            let confVal = '--';
            let successCount = 0;
            let errorCount = 0;
            let latencySum = null;
            let latencyCount = null;

            for (const line of lines) {
                // prediction_confidence_score
                if (line.startsWith('prediction_confidence_score ')) {
                    const val = parseFloat(line.split(' ')[1]);
                    if (!isNaN(val)) confVal = (val * 100).toFixed(1) + '%';
                }

                // prediction_requests_total{status="success"}
                if (line.startsWith('prediction_requests_total{') && line.includes('status="success"')) {
                    const val = parseFloat(line.split(' ').pop());
                    if (!isNaN(val)) successCount = val;
                }

                // prediction_requests_total{status="error"}
                if (line.startsWith('prediction_requests_total{') && line.includes('status="error"')) {
                    const val = parseFloat(line.split(' ').pop());
                    if (!isNaN(val)) errorCount = val;
                }

                // prediction_latency_seconds_sum
                if (line.startsWith('prediction_latency_seconds_sum ')) {
                    latencySum = parseFloat(line.split(' ')[1]);
                }

                // prediction_latency_seconds_count
                if (line.startsWith('prediction_latency_seconds_count ')) {
                    latencyCount = parseFloat(line.split(' ')[1]);
                }
            }

            // Update Confidence
            const confElem = document.getElementById('confidence-value');
            if (confElem) confElem.textContent = confVal;

            // Update Total Inferences
            const totalCount = successCount + errorCount;
            const countElem = document.getElementById('inference-count');
            if (countElem) countElem.textContent = totalCount > 0 ? totalCount.toLocaleString() : '--';

            const breakdownElem = document.getElementById('inference-breakdown');
            if (breakdownElem && totalCount > 0) {
                breakdownElem.textContent = `✓ ${successCount} successful · ✗ ${errorCount} failed`;
            }

            // Update Avg Latency
            const latencyElem = document.getElementById('latency-value');
            if (latencyElem) {
                if (latencySum !== null && latencyCount !== null && latencyCount > 0) {
                    const avgMs = (latencySum / latencyCount) * 1000;
                    latencyElem.textContent = avgMs < 1000
                        ? `${avgMs.toFixed(0)} ms`
                        : `${(avgMs / 1000).toFixed(2)} s`;
                } else {
                    latencyElem.textContent = '-- ms';
                }
            }

        } catch (error) {
            console.error("Error fetching metrics:", error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new MetricsApp();
});
