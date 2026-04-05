# Use official lightweight Python image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Copy dependency definition
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the frontend files and python app
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Start the Flask app
CMD ["python", "app.py"]
