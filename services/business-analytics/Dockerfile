FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && install -d -o 10001 -g 10001 -m 0700 /var/lib/business-analytics
COPY analytics/ ./analytics/
COPY gunicorn.conf.py .
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=4s CMD python -c "from urllib.request import urlopen; urlopen('http://127.0.0.1:8080/health/live',timeout=2).close()"
CMD ["gunicorn", "--no-control-socket", "-c", "gunicorn.conf.py", "analytics.server:app"]
