# URLA Workflow — self-contained Docker image
#
# Build context is the workflow package directory itself.
# Build:
#   docker build -t urla-workflow -f src/workflow/Dockerfile src/workflow
# Run:
#   docker run --rm -p 5005:5005 \
#     -e OPENAI_API_KEY=sk-... -e ANTHROPIC_API_KEY=sk-ant-... \
#     urla-workflow
#
FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy package contents into /app/workflow/
COPY __init__.py        ./workflow/__init__.py
COPY config.py          ./workflow/config.py
COPY logging_utils.py   ./workflow/logging_utils.py
COPY providers.py       ./workflow/providers.py
COPY schemas.py         ./workflow/schemas.py
COPY tools.py           ./workflow/tools.py
COPY workflow.py        ./workflow/workflow.py
COPY api.py             ./workflow/api.py
COPY assets/            ./workflow/assets/
COPY prompts/           ./workflow/prompts/
COPY templates/         ./workflow/templates/
COPY fixtures/          ./workflow/fixtures/

# Runtime dirs (mountable as volumes for persistence)
RUN mkdir -p /app/workflow/uploads /app/workflow/output

ENV PYTHONPATH=/app
ENV OPENAI_AGENTS_DISABLE_TRACING=1
ENV PORT=5005

EXPOSE 5005

CMD ["python", "-m", "workflow.api"]
