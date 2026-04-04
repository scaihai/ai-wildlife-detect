import os
import base64
import io
import logging
import requests
import numpy as np
from PIL import Image
from flask import Flask, send_from_directory, request, jsonify, Response
from prometheus_client import Gauge, Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Serve the current directory as static root, preventing the need to rewrite the HTML links
app = Flask(__name__, static_folder='.', static_url_path='')

GRAFANA_URL = os.environ.get('GRAFANA_URL', 'http://127.0.0.1:3000/d/ads2txc/tf-serving-metrics?orgId=1&from=now-5m&to=now&timezone=browser')
TF_SERVING_URL = os.environ.get('TF_SERVING_URL', 'http://model-server:8501/v1/models/my_frcnn:predict')
TF_SERVING_STATUS_URL = TF_SERVING_URL.replace(':predict', '')
MODEL_NAME = TF_SERVING_URL.split('/models/')[1].split(':')[0] if '/models/' in TF_SERVING_URL else 'Unknown'
CONFIDENCE_THRESHOLD = 0.3

# Prometheus metrics
prediction_confidence_gauge = Gauge(
    'prediction_confidence_score',
    'Confidence score of the latest model prediction'
)
prediction_counter = Counter(
    'prediction_requests_total',
    'Total number of inference requests',
    ['status']
)
prediction_latency = Histogram(
    'prediction_latency_seconds',
    'End-to-end inference request latency in seconds',
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Label map based on label_map.pbtxt
LABEL_MAP = {
    1: 'Lion',
    2: 'Ostrich',
    3: 'Oryx'
}

@app.route('/info', methods=['GET'])
def info():
    version = "?"
    try:
        response = requests.get(TF_SERVING_STATUS_URL, timeout=2)
        if response.status_code == 200:
            status_data = response.json()
            versions = status_data.get('model_version_status', [])
            if len(versions) > 0:
                version = versions[0].get('version', '?')
    except Exception as e:
        logger.warning(f"Could not fetch model version: {e}")

    return jsonify({
        "model_name": MODEL_NAME,
        "version": version,
        "grafana_url": GRAFANA_URL
    })

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/results')
def results():
    return send_from_directory('.', 'results.html')

@app.route('/metrics-dashboard')
def metrics_dashboard():
    return send_from_directory('.', 'metrics.html')

@app.route('/description')
def description():
    return send_from_directory('.', 'description.html')

@app.route('/architecture')
def architecture():
    return send_from_directory('.', 'architecture.html')

@app.route('/predict', methods=['POST'])
def predict():
    start_time = time.time()
    try:
        data = request.get_json()
        if not data or 'base64Data' not in data:
            return jsonify({'error': 'No base64Data provided'}), 400

        base64_data = data['base64Data']
        image_data = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Convert image to numpy array. Model expects uint8 tensor [1, height, width, 3].
        image_np = np.array(image, dtype=np.uint8)
        image_expanded = np.expand_dims(image_np, axis=0)
        
        # Prepare payload for TF Serving
        payload = {"instances": image_expanded.tolist()}
        
        logger.info(f"Sending request to TF Serving: {TF_SERVING_URL}")
        response = requests.post(TF_SERVING_URL, json=payload)
        
        if response.status_code != 200:
            logger.error(f"TF Serving error: {response.text}")
            return jsonify({'error': 'Error from model server', 'details': response.text}), 500
            
        result = response.json()
        predictions = result['predictions'][0]
        
        boxes = predictions.get('detection_boxes', [])
        classes = predictions.get('detection_classes', [])
        scores = predictions.get('detection_scores', [])
        
        frontend_results = []
        best_idx = -1
        best_score = -1.0
        
        for i in range(len(scores)):
            if scores[i] >= CONFIDENCE_THRESHOLD and float(scores[i]) > best_score:
                best_score = float(scores[i])
                best_idx = i

        if best_idx != -1:
            box = boxes[best_idx]
            scaled_box = [coord * 1000 for coord in box]
            class_id = int(classes[best_idx])
            label = LABEL_MAP.get(class_id, f'Unknown-{class_id}')
            
            frontend_results.append({
                'label': label,
                'box_2d': scaled_box,
                'score': best_score
            })
            # Update Prometheus gauge for model drift monitoring
            prediction_confidence_gauge.set(best_score)

        prediction_counter.labels(status='success').inc()
        prediction_latency.observe(time.time() - start_time)
        return jsonify(frontend_results)
        
    except Exception as e:
        logger.exception("Error during prediction")
        prediction_counter.labels(status='error').inc()
        prediction_latency.observe(time.time() - start_time)
        return jsonify({'error': str(e)}), 500

@app.route('/metrics')
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

if __name__ == '__main__':
    # Default to 5000 for local or whatever environment assigns
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
