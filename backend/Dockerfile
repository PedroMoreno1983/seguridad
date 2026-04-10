FROM python:3.11-slim

# Dependencias mínimas del sistema (sin GDAL)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libgeos-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "start.sh"]
