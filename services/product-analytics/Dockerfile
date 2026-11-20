FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.txt
COPY product_analytics/ ./product_analytics/

USER 10001:10001
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=6 \
  CMD ["python", "-c", "from urllib.request import urlopen; urlopen('http://127.0.0.1:8080/health/live', timeout=2).close()"]

CMD ["gunicorn", "--no-control-socket", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "60", "--worker-tmp-dir", "/dev/shm", "product_analytics.app:app"]
