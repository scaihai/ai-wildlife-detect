import os
import subprocess
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -- PATH CONFIGURATION --
# Map the docker volume to /model-registry
REGISTRY_BASE = "/model-registry"
TRAIN_IMAGES_DIR = os.path.join(REGISTRY_BASE, "images/train")
MY_MODEL_DIR = os.path.join(REGISTRY_BASE, "models/TF2/my_frcnn_1024x1024")
PIPELINE_CONFIG_PATH = os.path.join(REGISTRY_BASE, "models/TF2/faster_rcnn_resnet101_v1_1024x1024_coco17_tpu-8/pipeline.config")

# Path to the TF Object Detection API main script (installed via Dockerfile)
MODEL_MAIN_SCRIPT = "/opt/models/research/object_detection/model_main_tf2.py"

# -- HYPERPARAMETERS --
NUM_EPOCHS = 100
BATCH_SIZE = 4

def main():
    """
    Orchestrates the TensorFlow Object Detection training pipeline.

    This function performs the following steps:
    1. Validates the existence of the training image directory in the mounted 
       model registry volume.
    2. Dynamically calculates the required `NUM_STEPS` for the training 
       process based on the number of files in the training directory, 
       batch size, and target epochs.
    3. Constructs a command-line execution string for the TensorFlow 
       `model_main_tf2.py` script.
    4. Invokes the training process as a subprocess and monitors for 
       successful completion.

    Raises:
        subprocess.CalledProcessError: If the TensorFlow training script 
        returns a non-zero exit code.
    """
    # 1. Verify Directories
    if not os.path.exists(TRAIN_IMAGES_DIR):
        logger.error(f"Directory not found: {TRAIN_IMAGES_DIR}. Please check volume mounts.")
        return

    # 2. Calculate Steps
    # Assuming every file in 'train' is an image, or filtering specifically for images/XMLs.
    # Use simple listdir length.
    TRAIN_SET_SIZE = len(os.listdir(TRAIN_IMAGES_DIR))
    
    if TRAIN_SET_SIZE == 0:
        logger.error("No images found in the training directory. Aborting build.")
        return

    NUM_STEPS = int(TRAIN_SET_SIZE / BATCH_SIZE * NUM_EPOCHS)
    
    logger.info("--- MLOps Pipeline Data ---")
    logger.info(f"Training set size: {TRAIN_SET_SIZE}")
    logger.info(f"Number of steps: {NUM_STEPS}")
    logger.info("---------------------------")

    # 3. Construct the Command
    command = [
        "python", MODEL_MAIN_SCRIPT,
        f"--model_dir={MY_MODEL_DIR}",
        f"--pipeline_config_path={PIPELINE_CONFIG_PATH}",
        f"--num_train_steps={NUM_STEPS}",
        "--alsologtostderr"
    ]

    # 4. Execute the Training
    logger.info(f"Executing: {' '.join(command)}")
    try:
        # check=True ensures an exception is thrown if the script fails
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as e:
        logger.error("TensorFlow training script exited with an error.")
        raise e

if __name__ == "__main__":
    main()