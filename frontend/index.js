class UploadApp {
    constructor() {
        this.state = {
            imageSrc: null,
            imageFile: null,
            isAnalyzing: false,
            error: null
        };
        this.init();
    }

    init() {
        lucide.createIcons();
        this.bindElements();
        this.addEventListeners();
        this.fetchModelInfo();
        this.render();

        // Clear previous session on load
        sessionStorage.removeItem('wildlifeDetectResults');
        sessionStorage.removeItem('wildlifeDetectImage');
        sessionStorage.removeItem('wildlifeDetectFilename');
    }

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

    bindElements() {
        this.dropZone = document.getElementById('drop-zone');
        this.browseBtn = document.getElementById('browse-btn');
        this.fileInput = document.getElementById('file-input');
        this.imageViewer = document.getElementById('image-viewer');
        this.previewImage = document.getElementById('preview-image');
        this.clearImageBtn = document.getElementById('clear-image-btn');
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.analyzeBtnText = document.getElementById('analyze-btn-text');
        this.normalIcon = this.analyzeBtn.querySelector('.normal-icon');
        this.spinIcon = this.analyzeBtn.querySelector('.spin-icon');
        this.errorMsg = document.getElementById('error-message');
        this.errorText = document.getElementById('error-text');
    }

    addEventListeners() {
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

        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) this.processFile(file);
        });

        this.clearImageBtn.addEventListener('click', () => {
            this.setState({
                imageSrc: null,
                imageFile: null,
                isAnalyzing: false,
                error: null
            });
            this.fileInput.value = '';
        });

        this.analyzeBtn.addEventListener('click', () => this.analyzeImage());
    }

    processFile(file) {
        // Strict Validation
        const validExtensions = ['jpg', 'jpeg', 'png'];
        const extensionMatch = file.name.match(/\.([^.]+)$/);
        const ext = extensionMatch ? extensionMatch[1].toLowerCase() : '';

        if (!validExtensions.includes(ext) || !file.type.startsWith('image/')) {
            this.setState({ error: 'Invalid file extension. Only .jpg, .jpeg, and .png are allowed.' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.setState({
                imageSrc: e.target.result,
                imageFile: file,
                isAnalyzing: false,
                error: null
            });
        };
        reader.readAsDataURL(file);
    }

    async analyzeImage() {
        if (!this.state.imageSrc) return;

        this.setState({ isAnalyzing: true, error: null });

        try {
            const base64Data = this.state.imageSrc.split(',')[1];

            const response = await fetch('predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64Data: base64Data })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to analyze image');
            }

            const data = await response.json();

            if (data && Array.isArray(data)) {
                // Save to session storage
                sessionStorage.setItem('wildlifeDetectResults', JSON.stringify(data));
                sessionStorage.setItem('wildlifeDetectImage', this.state.imageSrc);
                sessionStorage.setItem('wildlifeDetectFilename', this.state.imageFile.name || 'uploaded_image');

                // Navigate to results
                window.location.href = 'results';
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
        if (this.state.error) {
            this.errorMsg.classList.remove('hidden');
            this.errorText.textContent = this.state.error;
        } else {
            this.errorMsg.classList.add('hidden');
        }

        if (this.state.imageSrc) {
            this.dropZone.classList.add('hidden');
            this.imageViewer.classList.remove('hidden');
            this.previewImage.src = this.state.imageSrc;

            if (!this.state.isAnalyzing) {
                this.analyzeBtn.classList.remove('disabled');
                this.analyzeBtn.disabled = false;
            } else {
                this.analyzeBtn.classList.add('disabled');
                this.analyzeBtn.disabled = true;
            }
        } else {
            this.dropZone.classList.remove('hidden');
            this.imageViewer.classList.add('hidden');
            this.previewImage.src = '';

            this.analyzeBtn.classList.add('disabled');
            this.analyzeBtn.disabled = true;
        }

        if (this.state.isAnalyzing) {
            this.analyzeBtnText.textContent = 'Running Inference...';
            this.normalIcon.classList.add('hidden');
            this.spinIcon.classList.remove('hidden');
            this.spinIcon.classList.add('animate-spin');
        } else {
            this.analyzeBtnText.textContent = 'Run Inference';
            this.normalIcon.classList.remove('hidden');
            this.spinIcon.classList.add('hidden');
            this.spinIcon.classList.remove('animate-spin');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new UploadApp();
});
