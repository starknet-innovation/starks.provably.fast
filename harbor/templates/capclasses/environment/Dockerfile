# Shared by the agent and the separate verifier. Python only.
FROM python:3.12-slim
RUN pip install --no-cache-dir numpy==2.3.3
COPY certify.py exceptional.py pack_instance.py /opt/proven/
RUN chmod 0755 /opt/proven/*.py && mkdir -p /workspace
WORKDIR /workspace
