// Colors configuration
const COLORS = [
    '#3b82f6', // blue-500
    '#ef4444', // red-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4'  // cyan-500
];

class WildlifeDetectApp {
    constructor() {
        this.state = {
            activeTab: 'inference',
            imageSrc: null,
            imageFile: null,
            isAnalyzing: false,
            hasAnalyzed: false,
            results: [],
            error: null
        };
        this.init();
    }

    init() {
        // Initialize lucide icons
        lucide.createIcons();

        // Bind DOM elements
        this.bindElements();

        // Add event listeners
        this.addEventListeners();

        // Fetch model info
        this.fetchModelInfo();

        this.render();
    }

    async fetchModelInfo() {
        try {
            const response = await fetch('/info');
            if (response.ok) {
                const data = await response.json();
                const text = `my_frcnn (v${data.version})`; // Use format with known generic name or dynamic depending on need
                const dynamicText = `${data.model_name} (v${data.version})`;
                
                const pbText = document.getElementById('powered-by-text');
                const mdText = document.getElementById('model-desc-text');
                if (pbText) pbText.textContent = `Powered by ${dynamicText}`;
                if (mdText) mdText.textContent = dynamicText;
            }
        } catch (err) {
            console.error("Failed to fetch model info:", err);
        }
    }

    bindElements() {
        // Nav tabs
        this.navBtns = document.querySelectorAll('.nav-btn[data-tab]');
        this.tabContents = document.querySelectorAll('.tab-content');

        // Viewer / Upload
        this.dropZone = document.getElementById('drop-zone');
        this.browseBtn = document.getElementById('browse-btn');
        this.fileInput = document.getElementById('file-input');
        this.imageViewer = document.getElementById('image-viewer');
        this.previewImage = document.getElementById('preview-image');
        this.clearImageBtn = document.getElementById('clear-image-btn');

        // Analysis panel
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.analyzeBtnText = document.getElementById('analyze-btn-text');
        this.normalIcon = this.analyzeBtn.querySelector('.normal-icon');
        this.spinIcon = this.analyzeBtn.querySelector('.spin-icon');

        // Results
        this.resultsSection = document.getElementById('results-section');
        this.resultsList = document.getElementById('results-list');

        this.emptyStateMsg = document.getElementById('empty-state-msg');
        this.bboxesContainer = document.getElementById('bboxes-container');

        // Error msg
        this.errorMsg = document.getElementById('error-message');
        this.errorText = document.getElementById('error-text');
    }

    addEventListeners() {
        // Navigation
        this.navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.currentTarget.getAttribute('data-tab');
                this.setState({ activeTab: tabId });
            });
        });

        // Drag and Drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files?.[0];
            if (file) this.processFile(file);
        });

        // File Browser
        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) this.processFile(file);
        });

        // Clear Image
        this.clearImageBtn.addEventListener('click', () => {
            this.setState({
                imageSrc: null,
                imageFile: null,
                isAnalyzing: false,
                hasAnalyzed: false,
                results: [],
                error: null
            });
            this.fileInput.value = '';
        });

        // Analyze
        this.analyzeBtn.addEventListener('click', () => this.analyzeImage());
    }

    processFile(file) {
        if (!file.type.startsWith('image/')) {
            this.setState({ error: 'Please upload a valid image file.' });
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            this.setState({
                imageSrc: e.target.result,
                imageFile: file,
                isAnalyzing: false,
                hasAnalyzed: false,
                results: [],
                error: null
            });
        };
        reader.readAsDataURL(file);
    }

    async analyzeImage() {
        if (!this.state.imageSrc) return;

        this.setState({ isAnalyzing: true, error: null, hasAnalyzed: false, results: [] });

        try {
            const base64Data = this.state.imageSrc.split(',')[1];
            const mimeType = this.state.imageSrc.split(';')[0].split(':')[1];

            const response = await fetch('/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    base64Data: base64Data
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to analyze image');
            }

            const data = await response.json();

            if (data && Array.isArray(data)) {
                this.setState({ results: data, isAnalyzing: false, hasAnalyzed: true });
            } else {
                throw new Error("Invalid results returned from the model.");
            }
        } catch (err) {
            console.error("Analysis error:", err);
            this.setState({
                error: err.message || "Failed to analyze image",
                isAnalyzing: false
            });
        }
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }

    render() {
        // Tab mgmt
        this.navBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === this.state.activeTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.tabContents.forEach(content => {
            if (content.id === `${this.state.activeTab}-tab`) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });

        // Error Msg
        if (this.state.error) {
            this.errorMsg.classList.remove('hidden');
            this.errorText.textContent = this.state.error;
        } else {
            this.errorMsg.classList.add('hidden');
        }

        // Viewer state
        if (this.state.imageSrc) {
            this.dropZone.classList.add('hidden');
            this.imageViewer.classList.remove('hidden');
            this.previewImage.src = this.state.imageSrc;
        } else {
            this.dropZone.classList.remove('hidden');
            this.imageViewer.classList.add('hidden');
            this.previewImage.src = '';
        }

        // Output formatting
        if (this.state.imageSrc && !this.state.isAnalyzing && this.state.results.length === 0) {
            this.analyzeBtn.classList.remove('disabled');
            this.analyzeBtn.disabled = false;
        } else {
            this.analyzeBtn.classList.add('disabled');
            this.analyzeBtn.disabled = true;
        }

        if (this.state.isAnalyzing) {
            this.analyzeBtnText.textContent = 'Detecting Objects...';
            this.normalIcon.classList.add('hidden');
            this.spinIcon.classList.remove('hidden');
            this.spinIcon.classList.add('animate-spin');
        } else {
            this.analyzeBtnText.textContent = 'Run Inference';
            this.normalIcon.classList.remove('hidden');
            this.spinIcon.classList.add('hidden');
            this.spinIcon.classList.remove('animate-spin');
        }

        // Results Box logic
        if (this.state.results.length > 0) {
            this.emptyStateMsg.classList.add('hidden');
            this.resultsSection.classList.remove('hidden');


            // Clear lists
            this.resultsList.innerHTML = '';
            this.bboxesContainer.innerHTML = '';

            this.state.results.forEach((res, i) => {
                const color = COLORS[i % COLORS.length];

                // Append info to sidebar list
                const delay = i * 0.05;
                const li = document.createElement('div');
                li.className = 'result-item';
                li.style.animationDelay = `${delay}s`;
                li.innerHTML = `
                    <div class="res-left">
                        <div class="res-dot" style="background-color: ${color}"></div>
                        <span class="res-label">${res.label}</span>
                    </div>
                    <div class="res-score">${Math.round(res.score * 100)}%</div>
                `;
                this.resultsList.appendChild(li);

                // Append bounding box
                const [ymin, xmin, ymax, xmax] = res.box_2d;
                const top = `${ymin / 10}%`;
                const left = `${xmin / 10}%`;
                const height = `${(ymax - ymin) / 10}%`;
                const width = `${(xmax - xmin) / 10}%`;

                const box = document.createElement('div');
                box.className = 'bounding-box';
                box.style.top = top;
                box.style.left = left;
                box.style.height = height;
                box.style.width = width;
                box.style.borderColor = color;
                box.style.backgroundColor = `${color}20`; // 20% opacity hex
                box.style.animationDelay = `${i * 0.1}s`;

                box.innerHTML = `
                    <div class="bb-label" style="background-color: ${color}">
                        <span>${res.label}</span>
                        <span class="bb-score">${Math.round(res.score * 100)}%</span>
                    </div>
                `;
                this.bboxesContainer.appendChild(box);
            });
        } else {
            this.resultsSection.classList.add('hidden');
            this.bboxesContainer.innerHTML = '';
            
            if (!this.state.imageSrc) {
                this.emptyStateMsg.innerHTML = "Upload an image to start object detection.";
                this.emptyStateMsg.classList.remove('hidden');
            } else if (this.state.hasAnalyzed) {
                this.emptyStateMsg.innerHTML = "<span style='font-size:1.25rem;'>⚠️</span><p>No objects detected. Try another image.</p>";
                this.emptyStateMsg.classList.remove('hidden');
                lucide.createIcons();
            } else {
                this.emptyStateMsg.classList.add('hidden');
            }
        }
    }
}

// Instantiate
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WildlifeDetectApp();
});
