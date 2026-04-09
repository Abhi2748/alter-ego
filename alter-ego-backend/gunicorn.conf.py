"""
Gunicorn configuration for ALTER EGO API.
Render Starter instance: 1 vCPU, 512MB RAM.
Adjust workers if you upgrade the instance.
"""

import multiprocessing
import os

# Worker count: (2 × cores) + 1, capped at 4 for 512MB RAM
workers = min((2 * multiprocessing.cpu_count()) + 1, 4)

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
    """
    After forking a worker, shut down the scheduler if it started in the
    preloaded app. Workers handle requests only — scheduler runs in main process.
    """
    import logging

    try:
        from main import app

        if hasattr(app.state, "scheduler") and app.state.scheduler.running:
            app.state.scheduler.shutdown(wait=False)
            logging.getLogger("gunicorn.error").info(
                "Scheduler shut down in worker process %s", worker.pid
            )
    except Exception as e:
        logging.getLogger("gunicorn.error").warning(
            "Could not shut down scheduler in worker: %s", e
        )
