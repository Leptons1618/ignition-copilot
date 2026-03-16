FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Keep stdin open so stdio MCP server remains active in container runtime.
CMD ["sh", "-c", "tail -f /dev/null | python ignition_mcp_server.py"]
