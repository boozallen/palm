FROM python:3.12-slim AS builder

WORKDIR /app

COPY docker/docling-service/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

# libgomp1 for ML model parallelism, libgl1 + libglib2.0-0 for image processing in Docling
# tesseract-ocr for OCR on scanned PDFs (no model download needed — installed as system package)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

# Fail the build if the CUDA stack comes back: the pod has no GPU and the layer would be ~4 GB larger.
RUN python -c "import importlib.metadata as m; bad = sorted({d.metadata['Name'] for d in m.distributions() if d.metadata['Name'].lower().startswith(('nvidia-', 'triton'))}); assert not bad, f'GPU-only packages installed: {bad}'"

ENV DOCLING_MODELS_PATH=/app/models
ENV TIKTOKEN_CACHE_DIR=/app/tiktoken-cache

RUN useradd --create-home --shell /bin/false appuser && \
    mkdir -p /app/models /app/tiktoken-cache && chown -R appuser:appuser /app
USER appuser

COPY docker/docling-service/ .

RUN HF_HUB_DISABLE_SSL_VERIFICATION=1 PYTHONHTTPSVERIFY=0 HF_HUB_DISABLE_XET=1 python download_models.py

# Block all HuggingFace network access at runtime — models are baked in above
ENV HF_HUB_OFFLINE=1

ENV OMP_NUM_THREADS=1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
