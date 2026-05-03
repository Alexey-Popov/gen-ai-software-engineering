FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY src/ src/
COPY tests/ tests/

CMD ["uv", "run", "pytest", "--cov=app", "--cov-report=term-missing", "-q"]
