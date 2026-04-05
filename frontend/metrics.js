/**
 * MetricsApp Class
 * * Orchestrates the real-time monitoring dashboard. It handles fetching and parsing 
 * Prometheus-formatted metrics, updating system health status, and managing 
 * the administrative model-rebuild trigger.
 */
class MetricsApp {
    constructor() {
        this.init();
    }

    /**
     * Bootstraps the dashboard by initializing icons, fetching initial model data, 
     * binding event listeners to the refresh and build buttons, and setting up 
     * the 10-second automatic refresh interval.
     */
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

        const triggerBuildBtn = document.getElementById('trigger-build-btn');
        if (triggerBuildBtn) {
            triggerBuildBtn.addEventListener('click', () => this.triggerBuild());
        }

        // Initial fetch
        this.fetchMetrics();
        // Auto refresh every 10 seconds
        setInterval(() => this.fetchMetrics(), 10000);
    }

    /**
     * Fetches high-level model metadata (name, version, and monitoring URLs) from 
     * the backend. Updates the "Model Server Status" badge and the "Model Version" 
     * card based on the response success or failure.
     * @async
     */
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

    /**
     * Scrapes the '/metrics' endpoint and parses the raw Prometheus text format. 
     * Extracts and calculates values for:
     * - Current confidence (Gauge)
     * - Average confidence (Summary sum/count)
     * - Throughput/Error rates (Counter)
     * - Average Latency (Histogram sum/count)
     * Updates the corresponding DOM elements with formatted values.
     * @async
     */
    async fetchMetrics() {
        try {
            const response = await fetch('metrics');
            if (!response.ok) throw new Error('Failed to fetch metrics');

            const text = await response.text();
            const lines = text.split('\n');

            let confVal = '--';
            let confSum = null;
            let confCount = null;
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

                // prediction_confidence_summary_sum
                if (line.startsWith('prediction_confidence_summary_sum ')) {
                    confSum = parseFloat(line.split(' ')[1]);
                }

                // prediction_confidence_summary_count
                if (line.startsWith('prediction_confidence_summary_count ')) {
                    confCount = parseFloat(line.split(' ')[1]);
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
            if (confElem) {
                // The Prometheus gauge defaults to 0.0 on startup. 
                // Only display the value if at least one successful inference has occurred.
                confElem.textContent = (successCount > 0) ? confVal : '--%';
            }

            // Update Avg Confidence
            const avgConfElem = document.getElementById('avg-confidence-value');
            if (avgConfElem) {
                if (confSum !== null && confCount !== null && confCount > 0) {
                    const avg = confSum / confCount;
                    avgConfElem.textContent = (avg * 100).toFixed(1) + '%';
                } else {
                    avgConfElem.textContent = '--%';
                }
            }

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

    /**
     * Handles the administrative request to trigger a model retraining build. 
     * Manages the UI state for the trigger button (loading spinners/disabling) 
     * and sends the password to the backend for pipeline authorization.
     * @async
     */
    async triggerBuild() {
        const passwordInput = document.getElementById('admin-password');
        const btn = document.getElementById('trigger-build-btn');
        
        if (!passwordInput.value) {
            this.showBuildStatus('Please enter the admin password.', 'error');
            return;
        }

        try {
            // 1. Animate the button: Disable it, change text, and add a spinning loader
            btn.disabled = true;
            btn.classList.add('disabled');
            
            // Swap icon to loader and update text
            btn.innerHTML = `<i data-lucide="loader" class="icon-sm animate-spin"></i> Initiating...`;
            lucide.createIcons(); // Re-render the new icon

            this.showBuildStatus('Contacting server...', 'info');

            // API call to the Flask backend
            const response = await fetch('trigger-build', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: passwordInput.value })
            });

            if (response.ok) {
                // 2. Tell the user the build has been initiated
                this.showBuildStatus('The build has been initiated successfully!', 'success');
                passwordInput.value = ''; // Clear password field
            } else {
                const errorData = await response.json();
                this.showBuildStatus(`Failed: ${errorData.error || 'Unauthorized'}`, 'error');
            }
        } catch (error) {
            console.error("Error triggering build:", error);
            this.showBuildStatus('Network error. Failed to reach the server.', 'error');
        } finally {
            // 3. Revert the button animation and state
            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('disabled');
                // Restore original icon and text
                btn.innerHTML = `<i data-lucide="play" class="icon-sm"></i> Trigger Build`;
                lucide.createIcons();
            }, 500); // Small delay so the user registers the animation
        }
    }

    /**
     * Utility method to display feedback messages regarding the build trigger status.
     * Adjusts the text color based on the severity (success, error, or info).
     * @param {string} message - The text to display to the user.
     * @param {string} type - The status type ('success', 'error', or 'info') to determine styling.
     */
    showBuildStatus(message, type) {
        const statusMsg = document.getElementById('build-status-msg');
        if (statusMsg) {
            statusMsg.textContent = message;
            statusMsg.style.display = 'block';
            
            // Apply color based on message type
            if (type === 'error') {
                statusMsg.style.color = 'var(--red-700)';
            } else if (type === 'success') {
                statusMsg.style.color = '#047857'; // emerald-700
            } else {
                statusMsg.style.color = 'var(--text-muted)';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new MetricsApp();
});
