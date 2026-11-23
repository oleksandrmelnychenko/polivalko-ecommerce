"""WSGI entrypoint for the standalone Vercel deployment."""

from analytics import server

app = server.app
