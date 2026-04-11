"""
Gunicorn configuration for ALTER EGO API.
Render Starter instance: 1 vCPU, 512MB RAM.
Single worker: scheduler must not run in multiple processes (revisit with job locking post-MVP).
"""

import os

workers = 1

# Each worker runs uvicorn (async)
worker_class = "uvicorn.workers.UvicornWorker"

# Bind to Render's assigned port (set via environment)
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# Graceful timeout — give long requests (LLM calls) time to finish
timeout = 120
graceful_timeout = 30
keepalive = 5

# Restart workers after this many requests to prevent memory leaks
max_requests = 1000
max_requests_jitter = 100

# Log to stdout so Render captures it
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Preload the app once, then fork workers (saves memory)
preload_app = True


def post_fork(server, worker):
    """Workers do not run the scheduler — it runs in the single worker process."""
    pass
