FROM node:22-slim AS node

RUN npm install -g docx react react-dom react-icons sharp --strict-ssl=false

FROM python:3.12-slim AS builder

WORKDIR /app

COPY docker/claude-service/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-impress \
    poppler-utils \
    fontconfig \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Alias Inter → Liberation Sans so LibreOffice renders PPTX templates without monospace fallback
RUN mkdir -p /etc/fonts/conf.d && printf '<?xml version="1.0"?>\n\
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n\
<fontconfig>\n\
  <alias><family>Inter</family><prefer><family>Liberation Sans</family></prefer></alias>\n\
  <alias><family>Inter Tight</family><prefer><family>Liberation Sans</family></prefer></alias>\n\
</fontconfig>\n' > /etc/fonts/conf.d/99-inter-alias.conf \
    && fc-cache -f

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/bin/npm /usr/local/bin/npm
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules

COPY --from=builder /install /usr/local

RUN useradd --create-home --shell /bin/false appuser && \
    mkdir -p /home/appuser/.claude && \
    chown -R appuser:appuser /home/appuser
USER appuser

COPY docker/claude-service/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
