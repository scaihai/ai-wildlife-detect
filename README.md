# WildlifeDetect

A production-ready machine learning system for wildlife detection using Faster R-CNN. Detect lions, ostriches, and oryxes in images with a modern web interface, integrated monitoring, and containerized deployment.

## Features

- **Wildlife Detection**: Fine-tuned Faster R-CNN model for detecting three African wildlife species
  - Lion
  - Ostrich
  - Oryx
- **Modern Web Interface**: React-like vanilla JavaScript frontend with drag-and-drop image upload
- **Real-time Inference**: TensorFlow Serving with REST and gRPC APIs
- **Production Monitoring**: Prometheus metrics collection and Grafana visualization dashboards
- **Container Orchestration**: Full Docker Compose setup for easy deployment
- **Model Versioning**: Integrated model registry with version management
- **Confidence Scoring**: Built-in model drift monitoring with confidence metrics

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    WildlifeDetect App                     │
│              (Flask + Vanilla JavaScript)               │
│                  :5000 (HTTP Frontend)                  │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   TensorFlow Serving                    │
│               (Faster R-CNN Model Server)               │
│             :8500 (gRPC) | :8501 (REST API)             │
└────────────────────────────┬────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Prometheus   │    │    Grafana    │    │ Model Record  │
│    Metrics    │    │  Dashboards   │    │  :8500-8501   │
│     :9090     │    │     :3000     │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Project Structure

```
eml/
├── README.md                          # This file
├── docker-compose.yml                 # Service orchestration
├── frontend/                          # Web application
│   ├── app.py                         # Flask backend
│   ├── index.html                     # Frontend UI
│   ├── styles.css                     # Styling
│   ├── script.js                      # Client-side logic
│   ├── Dockerfile                     # Container image
│   └── requirements.txt                # Python dependencies
├── model-registry/                    # Model storage
│   ├── prometheus.conf                # Prometheus config
│   ├── my_frcnn/
│   │   └── 4/
│   │       ├── saved_model.pb         # TensorFlow model
│   │       ├── assets/                # Model assets
│   │       └── variables/             # Model weights
│   └── ...
├── monitoring/                        # Observability stack
│   ├── prometheus/
│   │   ├── prometheus.yml             # Metrics scraping config
│   │   └── data/                      # Time-series metrics storage
│   └── grafana/
│       └── data/                      # Grafana configuration & dashboards
└── training-pipeline/                 # ML pipeline (optional)
```

## Quick Start

### Prerequisites

- **Docker** & **Docker Compose** (v1.29+)
- **Git**
- At least 4GB available disk space

### Installation & Deployment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd eml
   ```

2. **Build and start services**
   ```bash
   docker-compose up --build
   ```

   This will:
   - Build and start the Flask frontend on `http://localhost:5000`
   - Start TensorFlow Serving on ports 8500 (gRPC) and 8501 (REST)
   - Launch Prometheus metrics collector on `http://localhost:9090`
   - Launch Grafana dashboards on `http://localhost:3000`

3. **Access the application**
   - **Web Interface**: http://localhost:5000
   - **Model API**: http://localhost:8501/v1/models/my_frcnn:predict
   - **Prometheus**: http://localhost:9090
   - **Grafana**: http://localhost:3000

4. **Stop services**
   ```bash
   docker-compose down
   ```

## Usage

### Web Interface

1. Navigate to http://localhost:5000
2. Upload an image by:
   - Clicking "Select Image" button, or
   - Dragging and dropping an image onto the interface
3. The model processes the image and displays:
   - Detected animals with bounding boxes
   - Confidence scores for each detection
   - Detection statistics

### Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)

### API Usage

**REST API Endpoint**: `http://localhost:8501/v1/models/my_frcnn:predict`

**Example Python Request**:
```python
import requests
import json
import base64

# Encode image to base64
with open('image.jpg', 'rb') as f:
    image_base64 = base64.b64encode(f.read()).decode()

# Prepare payload
payload = {
    "instances": [{"b64": image_base64}]
}

# Send request
response = requests.post(
    'http://localhost:8501/v1/models/my_frcnn:predict',
    json=payload
)

# Process response
predictions = response.json()
print(json.dumps(predictions, indent=2))
```

## Monitoring

### Prometheus

Prometheus automatically collects metrics from:
- TensorFlow Serving model performance
- Prediction confidence scores
- Inference latency
- Error rates

**Query Examples**:
```promql
# Average prediction confidence
avg(prediction_confidence_score)

# Inference latency
histogram_quantile(0.95, model_latency_seconds)
```

### Grafana

Pre-configured dashboard: `TF Serving Metrics`
- Accessible at: http://localhost:3000/d/ads2txc/tf-serving-metrics
- Default credentials: `admin` / `admin`

**Key Metrics Visualized**:
- Model inference latency (p50, p95, p99)
- Prediction confidence distribution
- Request throughput
- Error rates and model health

## Configuration

### Environment Variables

Edit `docker-compose.yml` to modify:

```yaml
environment:
  - TF_SERVING_URL=http://model-server:8501/v1/models/my_frcnn:predict
  - CONFIDENCE_THRESHOLD=0.3  # Minimum confidence for detections
```

### Model Configuration

- **Model Name**: `my_frcnn`
- **Model Version**: `4` (versioning in `model-registry/my_frcnn/`)
- **Framework**: TensorFlow 2.x
- **Architecture**: Faster R-CNN with ResNet backbone

## Model Details

### Training Data

- **Species**: Lion, Ostrich, Oryx
- **Architecture**: Faster R-CNN (two-stage detector)
- **Backbone**: ResNet50
- **Input Size**: Varies (aspect ratio preserved)
- **Classes**: 3 (Wildlife species only)

### Performance Metrics

- **Confidence Threshold**: 0.3 (configurable)
- **NMS Threshold**: Standard Faster R-CNN defaults
- **Inference Time**: ~500-1000ms per image (CPU), faster on GPU

### Label Map

```
1: Lion
2: Ostrich
3: Oryx
```

## Deployment Options

### Local Development
```bash
docker-compose up --build
```

### Production Deployment

For production, consider:

1. **Use GPU**: Mount NVIDIA GPU in `docker-compose.yml`
   ```yaml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: 1
             capabilities: [gpu]
   ```

2. **Enable HTTPS**: Add reverse proxy (Nginx/Traefik)

3. **Scale Services**: Use Kubernetes instead of Docker Compose

4. **CI/CD Integration**: Integrate with GitHub Actions for automated testing

5. **Model Updates**: Push new model versions to `model-registry/my_frcnn/5/`, etc.

## API Documentation

### Flask Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the web interface |
| `/predict` | POST | Inference endpoint (accepts base64 image) |
| `/info` | GET | Model metadata and version info |
| `/metrics` | GET | Prometheus metrics |

### TensorFlow Serving

**Model Status**: `http://localhost:8501/v1/models/my_frcnn`

**Prediction**: `http://localhost:8501/v1/models/my_frcnn:predict`

## Development

### Prerequisites

- Python 3.8+
- TensorFlow 2.x
- Docker & Docker Compose

### Local Development (without Docker)

1. **Install Python dependencies**
   ```bash
   cd frontend
   pip install -r requirements.txt
   ```

2. **Start TensorFlow Serving locally**
   ```bash
   docker run -d \
     -p 8500:8500 -p 8501:8501 \
     -e MODEL_NAME=my_frcnn \
     -e MODEL_BASE_PATH=/models \
     -v $(pwd)/model-registry:/models \
     tensorflow/serving
   ```

3. **Run Flask app**
   ```bash
   python app.py
   ```

4. **Access at** http://localhost:5000

## Dependencies

### Frontend
- Flask 3.0.3
- TensorFlow Serving (Docker image)
- Prometheus client library
- Pillow (image processing)
- NumPy (numerical operations)

### Infrastructure
- Docker Engine 20.10+
- Docker Compose 1.29+
- Prometheus 2.x
- Grafana 9.x

See `frontend/requirements.txt` for full Python dependencies.

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### Model Server Connection Failed
```bash
# Check if TensorFlow Serving is running
curl http://localhost:8501/v1/models/my_frcnn

# Check logs
docker-compose logs model-server
```

### Memory Issues
```bash
# Increase Docker memory allocation
# In Docker Desktop: Settings → Resources → Memory: 4GB+
```

### Image Upload Fails
- Ensure image format is supported (JPG, PNG, WebP)
- Check image file size (under 20MB recommended)
- Verify CORS is not blocking requests in browser console

## Learning Resources

- **Faster R-CNN**: [Original Paper](https://arxiv.org/abs/1506.01497)
- **TensorFlow Object Detection**: [Official Guide](https://tensorflow.org/hub/tutorials/tf2_object_detection)
- **Docker Compose**: [Documentation](https://docs.docker.com/compose/)
- **Prometheus**: [Getting Started](https://prometheus.io/docs/introduction/first_steps/)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] GPU support documentation
- [ ] Kubernetes deployment manifests
- [ ] GitHub Actions CI/CD pipeline
- [ ] Model retraining workflow
- [ ] Multi-model serving (ensemble)
- [ ] Web UI performance optimizations
- [ ] Advanced filtering and export features

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Created by Destiny Gogo-fyneface as part of MLOps engineering coursework.

## Support

For issues, questions, or feature requests:
1. Check existing [GitHub Issues](https://github.com/yourusername/eml/issues)
2. Create a new issue with detailed description
3. Include error messages and system information

## Key Features Recap

- Pre-trained Faster R-CNN model ready to use
- Modern, user-friendly web interface
- Production-grade monitoring and observability
- Fully containerized for easy deployment
- REST and gRPC API support
- Model versioning built-in
- Comprehensive documentation
- Easy to extend and customize