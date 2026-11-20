import os

bind = "0.0.0.0:" + os.environ.get("PORT", "8080")
# One publisher owns the current immutable snapshot, also shared by HTTP threads.
workers = 1
worker_class = "gthread"
threads = 4
timeout = 120
worker_tmp_dir = "/tmp"


def post_worker_init(worker):
    from analytics.server import service

    service.start()
