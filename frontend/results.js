/**
 * ResultsApp Class
 * Handles the retrieval and visualization of inference results. It extracts model 
 * data and detection coordinates from session storage to render bounding boxes 
 * and detailed result tables.
 */
class ResultsApp {
    constructor() {
        this.init();
    }

    /**
     * Bootstraps the results page by initializing icons, fetching model metadata, 
     * and triggering the data rendering process.
     */
    init() {
        lucide.createIcons();
        this.fetchModelInfo();
        this.renderData();
    }

    /**
     * Asynchronously fetches model information (name, version, and monitoring links) 
     * from the backend to update the UI's external dashboard references.
     * @async
     */
    async fetchModelInfo() {
        try {
            const response = await fetch('info');
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
            }
        } catch (err) {
            console.error("Failed to fetch model info:", err);
        }
    }

    /**
     * Orchestrates the visualization of the classification results. It performs 
     * the following operations:
     * 1. Retrieves raw results, image data, and filenames from sessionStorage.
     * 2. Toggles UI visibility based on data availability.
     * 3. Renders the original and classified images.
     * 4. Calculates and injects an absolute-positioned CSS bounding box for the 
     * highest-confidence detection.
     * 5. Populates the results table with labels and probability percentages for 
     * all detected objects.
     */
    renderData() {
        const rawResults = sessionStorage.getItem('wildlifeDetectResults');
        const imageData = sessionStorage.getItem('wildlifeDetectImage');
        const filename = sessionStorage.getItem('wildlifeDetectFilename') || 'Unknown Image';

        const noDataMsg = document.getElementById('no-data-msg');
        const contentDiv = document.getElementById('results-content');

        if (!rawResults || !imageData) {
            noDataMsg.classList.remove('hidden');
            contentDiv.classList.add('hidden');
            return;
        }

        const results = JSON.parse(rawResults);

        noDataMsg.classList.add('hidden');
        contentDiv.classList.remove('hidden');

        // Set Images
        document.getElementById('original-image').src = imageData;
        const classifiedImg = document.getElementById('classified-image');
        classifiedImg.src = imageData;

        // Render Bounding Boxes (Only the highest confidence)
        const container = document.getElementById('classified-container');
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

        if (results.length > 0) {
            const bestRes = results[0]; // Highest confidence is sorted to the top
            const color = colors[0];
            const [ymin, xmin, ymax, xmax] = bestRes.box_2d;

            const top = `${ymin / 10}%`;
            const left = `${xmin / 10}%`;
            const height = `${(ymax - ymin) / 10}%`;
            const width = `${(xmax - xmin) / 10}%`;

            const box = document.createElement('div');
            box.className = 'bounding-box';
            box.style.position = 'absolute';
            box.style.border = `2px solid ${color}`;
            box.style.backgroundColor = `${color}20`;
            box.style.top = top;
            box.style.left = left;
            box.style.height = height;
            box.style.width = width;
            box.style.pointerEvents = 'none';

            box.innerHTML = `
                <div style="
                    position: absolute; 
                    top: -24px; 
                    left: -2px; 
                    background-color: ${color}; 
                    color: white; 
                    font-size: 0.75rem; 
                    font-weight: 600; 
                    padding: 2px 6px; 
                    border-radius: 4px 4px 0 0;
                    text-transform: capitalize;
                    white-space: nowrap;
                ">
                    ${bestRes.label} ${(bestRes.score * 100).toFixed(1)}%
                </div>
            `;
            container.appendChild(box);
        }

        // Render Table
        const tbody = document.getElementById('table-body');

        if (results.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td>${filename}</td>
                    <td style="color: var(--text-light);font-style:italic;">No objects detected</td>
                    <td>-</td>
                </tr>
            `;
            return;
        }

        results.forEach(res => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${filename}</td>
                <td style="text-transform: capitalize; font-weight: 500;">${res.label}</td>
                <td>
                    <span class="prob-badge">${(res.score * 100).toFixed(2)}%</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ResultsApp();
});
