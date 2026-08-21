FROM python:3.11-slim

# Install git, ssh, ripgrep
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY docker/repo-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

WORKDIR /app

# Copy the service code
COPY docker/repo-service/*.py ./
COPY docker/repo-service/endpoints/ ./endpoints/
COPY docker/repo-service/lib/ ./lib/

# Create directory for repo clones
RUN mkdir -p /repos

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
