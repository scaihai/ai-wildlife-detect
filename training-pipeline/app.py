import os
import threading
import subprocess
import logging
from flask import Flask, request, jsonify

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# The password that the frontend must send
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '2E=v[W,kj_}NP.Z2')

# Track the build thread to prevent concurrent training runs
build_thread = None

def run_training():
    """
    Executes the machine learning training pipeline as a subprocess.
    
    This function wraps the execution of `train.py`. It captures the 
    standard output and error states, logging the success or failure 
    of the model training process. 
    
    Note:
        This is intended to be run within a background thread to prevent 
        blocking the main Flask application.
    
    Raises:
        subprocess.CalledProcessError: If the training script returns a non-zero exit code.
        Exception: For any unexpected errors during script execution.
    """

    logger.info("Initiating training sequence...")
    try:
        # Executes the train.py script
        subprocess.run(["python", "train.py"], check=True)
        logger.info("Training sequence completed successfully.")
    except subprocess.CalledProcessError as e:
        logger.error(f"Training failed with exit code: {e.returncode}")
    except Exception as e:
        logger.error(f"Unexpected error during training: {e}")

@app.route('/build', methods=['POST'])
def trigger_build():
    """
    API endpoint to remotely initiate the model training sequence.
    
    Performs three layers of validation:
    1. Authentication: Checks the provided password against `ADMIN_PASSWORD`.
    2. Concurrency Control: Ensures only one training thread is active at a time 
       by checking the `build_thread` status.
    3. Asynchronous Execution: Spawns the training process in a separate 
       thread to allow for an immediate HTTP 202 response.
    
    Payload:
        JSON: {"password": "admin_password"}
        
    Returns:
        tuple: (JSON response, HTTP status code)
            - 202: Build successfully initiated.
            - 401: Unauthorized/Invalid password.
            - 429: Conflict/Build already in progress.
    """
    
    global build_thread
    data = request.get_json()
    
    # 1. Validate Password
    if not data or data.get('password') != ADMIN_PASSWORD:
        logger.warning("Unauthorized build attempt.")
        return jsonify({'error': 'Unauthorized: Invalid admin password'}), 401
        
    # 2. Check if already running
    if build_thread and build_thread.is_alive():
        logger.warning("Build requested, but training is already in progress.")
        return jsonify({'error': 'A model build is already in progress.'}), 429
        
    # 3. Start the training process asynchronously
    build_thread = threading.Thread(target=run_training)
    build_thread.start()
    
    return jsonify({'message': 'Build initiated successfully'}), 202

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)