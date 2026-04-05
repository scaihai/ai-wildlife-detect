# Use TensorFlow base image
FROM tensorflow/tensorflow:2.13.0

# Install system dependencies required for TF Object Detection API
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Clone the TensorFlow Models repository
RUN git clone https://github.com/tensorflow/models.git /opt/models

# Compile Protobufs and install the Object Detection package
WORKDIR /opt/models/research
RUN protoc object_detection/protos/*.proto --python_out=.
RUN cp object_detection/packages/tf2/setup.py .
RUN python -m pip install --upgrade pip
RUN python -m pip install .

# Set up the application
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the app files
COPY app.py .
COPY train.py .

ENV PORT=5000
EXPOSE 5000

CMD ["python", "app.py"]