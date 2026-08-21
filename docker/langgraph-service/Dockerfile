FROM python:3.12-slim AS builder

WORKDIR /app

COPY docker/langgraph-service/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /install /usr/local

RUN useradd --no-create-home --shell /bin/false appuser
USER appuser

COPY docker/langgraph-service/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
