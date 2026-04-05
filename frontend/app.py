"""
Flask web application serving as an API gateway and frontend.

This service acts as an intermediary, handling:
1. Routing for the static user interface pages.
2. Proxying inference requests to a TensorFlow Serving container, including 
   image preprocessing (base64 to tensor) and prediction post-processing.
3. Exposing Prometheus metrics (latency, request counts, model confidence).
4. Forwarding authenticated requests to trigger a remote model-training pipeline.
"""

import os
import base64
import io
import logging
import requests
import numpy as np
from PIL import Image
from flask import Flask, send_from_directory, request, jsonify, Response
from prometheus_client import Gauge, Counter, Histogram, Summary, generate_latest, CONTENT_TYPE_LATEST
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Serve the current directory as static root, preventing the need to rewrite the HTML links
app = Flask(__name__, static_folder='.', static_url_path='')

# Security and Routing for Training Pipeline
TRAINING_PIPELINE_URL = os.environ.get('TRAINING_PIPELINE_URL', 'http://training-pipeline:5000/build')
GRAFANA_URL = os.environ.get('GRAFANA_URL', 'http://grafana:3000/d/ads2txc/tf-serving-metrics?orgId=1&from=now-5m&to=now&timezone=browser')
TF_SERVING_URL = os.environ.get('TF_SERVING_URL', 'http://model-server:8501/v1/models/my_frcnn:predict')
TF_SERVING_STATUS_URL = TF_SERVING_URL.replace(':predict', '')
MODEL_NAME = TF_SERVING_URL.split('/models/')[1].split(':')[0] if '/models/' in TF_SERVING_URL else 'Unknown'
CONFIDENCE_THRESHOLD = 0.3

# Prometheus metrics
prediction_confidence_gauge = Gauge(
    'prediction_confidence_score',
    'Confidence score of the latest model prediction'
)
prediction_confidence_summary = Summary(
    'prediction_confidence_summary',
    'Summary of prediction confidence scores'
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

# Label map
LABEL_MAP = {
    1: 'Lion',
    2: 'Ostrich',
    3: 'Oryx'
}

@app.route('/info', methods=['GET'])
def info():
    """
    Retrieves the current model metadata and Grafana dashboard link.

    Queries the TensorFlow Serving status endpoint to fetch the active model 
    version.

    Returns:
        Response: JSON payload containing `model_name`, `version`, and `grafana_url`.
    """
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
    """Serves the main application interface."""
    return send_from_directory('.', 'index.html')

@app.route('/results')
def results():
    """Serves the inference results view."""
    return send_from_directory('.', 'results.html')

@app.route('/metrics-dashboard')
def metrics_dashboard():
    """Serves the embedded metrics dashboard view."""
    return send_from_directory('.', 'metrics.html')

@app.route('/description')
def description():
    """Serves the project description page."""
    return send_from_directory('.', 'description.html')

@app.route('/architecture')
def architecture():
    """Serves the system architecture diagram page."""
    return send_from_directory('.', 'architecture.html')

@app.route('/predict', methods=['POST'])
def predict():
    """
    Processes an uploaded image and proxies the inference to TensorFlow Serving.

    Expects a JSON payload with a 'base64Data' string. Decodes the image, 
    converts it to a uint8 numpy array [1, height, width, 3], and posts it to 
    the TF Serving REST API. 

    Post-processing includes:
    - Filtering out predictions below CONFIDENCE_THRESHOLD.
    - Scaling bounding box coordinates by 1000 for frontend rendering.
    - Sorting results so the highest confidence detection is first.

    Side Effects:
        Updates Prometheus metrics (latency histogram, request counter, and 
        confidence gauge/summary based on the highest-scoring detection).

    Returns:
        Response: JSON array of dictionaries, each containing 'label', 'box_2d', 
        and 'score'. Returns HTTP 400 for missing data or 500 for inference errors.
    """
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
        best_score = -1.0
        
        for i in range(len(scores)):
            score = float(scores[i])
            if score >= CONFIDENCE_THRESHOLD:
                box = boxes[i]
                scaled_box = [coord * 1000 for coord in box]
                class_id = int(classes[i])
                label = LABEL_MAP.get(class_id, f'Unknown-{class_id}')
                
                frontend_results.append({
                    'label': label,
                    'box_2d': scaled_box,
                    'score': score
                })
                
                if score > best_score:
                    best_score = score

        # Sort results descending so the highest confidence is always first (index 0)
        frontend_results.sort(key=lambda x: x['score'], reverse=True)

        if best_score != -1.0:
            # Update Prometheus gauge using the highest score
            prediction_confidence_gauge.set(best_score)
            prediction_confidence_summary.observe(best_score)

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
    """
    Exposes application metrics for Prometheus scraping.

    Returns:
        Response: Raw metrics data formatted to the Prometheus text-based standard.
    """
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

@app.route('/trigger-build', methods=['POST'])
def trigger_build():
    """
    Authenticates and forwards a build trigger to the remote training pipeline.

    Expects a JSON payload containing a 'password'. Acts as a reverse proxy by 
    forwarding the payload to the internal TRAINING_PIPELINE_URL. Evaluates 
    upstream status codes to determine client-facing responses.

    Returns:
        Response: JSON success message (HTTP 200) if the pipeline accepts the request, 
        or a JSON error message with the corresponding HTTP status code (401 Unauthorized, 
        502 Bad Gateway, or 503 Service Unavailable) on failure.
    """
    try:
        data = request.get_json()
        if not data or 'password' not in data:
            return jsonify({'error': 'Password is required'}), 400

        logger.info(f"Forwarding build trigger request to {TRAINING_PIPELINE_URL}")
        
        # Forward the payload (which contains the password) to the training pipeline container
        pipeline_response = requests.post(
            TRAINING_PIPELINE_URL, 
            json=data, 
            timeout=5
        )
        
        # Bubble up the response based on what the training-pipeline decides
        if pipeline_response.status_code in [200, 202]:
            logger.info("Training pipeline authorized and triggered successfully.")
            return jsonify({'message': 'Build initiated successfully'})
            
        elif pipeline_response.status_code == 401:
            logger.warning("Training pipeline rejected the request: Unauthorized.")
            return jsonify({'error': 'Unauthorized: Invalid admin password'}), 401
            
        else:
            logger.error(f"Training pipeline returned {pipeline_response.status_code}: {pipeline_response.text}")
            return jsonify({'error': 'Pipeline service responded with an error'}), 502

    except requests.exceptions.RequestException as e:
        # Handles connection errors if the training-pipeline container is down
        logger.error(f"Failed to reach training pipeline: {e}")
        return jsonify({'error': 'Training pipeline service is currently unreachable'}), 503
        
    except Exception as e:
        logger.exception("Unexpected error in /trigger-build")
        return jsonify({'error': 'An unexpected internal server error occurred'}), 500

if __name__ == '__main__':
    # Default to 5000 for local or whatever environment assigns
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
