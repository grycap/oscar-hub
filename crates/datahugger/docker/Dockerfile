FROM python:3.12-slim-bookworm

# Pin the GRyCAP fork, not the PyPI package or a moving Git branch.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir 'datahugger @ git+https://github.com/grycap/datahugger.git@d4f6cade5078073ab900c6b640ad75c09242e4ba'

RUN useradd --create-home --uid 1000 app
ENV HOME=/home/app PYTHONUNBUFFERED=1
WORKDIR /app
COPY --chown=app:app docker/app/app.py docker/app/worker.py docker/app/index.html docker/app/style.css docker/app/app.js icon.png /app/
USER 1000:1000
EXPOSE 8080
CMD ["python", "/app/app.py"]
