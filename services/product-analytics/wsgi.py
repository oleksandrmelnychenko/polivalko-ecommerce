"""WSGI entrypoint for the standalone Vercel deployment."""

from product_analytics import app as product_service

app = product_service.app
