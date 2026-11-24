#!/bin/bash
# One-time setup of the in-app AI assistant on the server: installs Ollama (the official installer, already downloaded to
# /root/ollama-install.sh and reviewed), downloads the small model, switches the assistant on and tests it.
# Ollama listens on 127.0.0.1 only, so the model is reachable by the API on this machine and by nobody else.
# Run as root on the server:  bash /root/shaadi-os/setup-ai.sh
set -e
ENV=/root/shaadi-os/api/.env; MODEL="${1:-llama3.2:3b}"
[ -f /root/ollama-install.sh ] || curl -fsSL https://ollama.com/install.sh -o /root/ollama-install.sh
command -v ollama >/dev/null 2>&1 || bash /root/ollama-install.sh
systemctl enable --now ollama
for i in $(seq 1 20); do curl -s localhost:11434/api/tags >/dev/null 2>&1 && break; sleep 2; done
echo "Ollama listening on: $(ss -ltn | awk '/11434/{print $4}' | tr '\n' ' ')"
ollama pull "$MODEL"
touch "$ENV"; cp "$ENV" "$ENV.bak.$(date +%Y%m%d-%H%M%S)"
grep -v -E '^(AI_ENABLED|OLLAMA_URL|AI_MODEL)=' "$ENV" > "$ENV.new" || true
{ cat "$ENV.new"; echo "AI_ENABLED=1"; echo "OLLAMA_URL=http://127.0.0.1:11434"; echo "AI_MODEL=$MODEL"; } > "$ENV"; rm -f "$ENV.new"; chmod 600 "$ENV"
systemctl restart shaadi-os; sleep 3
echo "Assistant status: $(curl -s localhost:4600/api/ai/status)"
echo "Timing a short answer..."
START=$(date +%s)
curl -s -X POST localhost:4600/api/ai/chat -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"What should a couple book first when planning an Indian wedding?"}],"context":{"city":"Pune","date":"2027-12-05","budget_paise":150000000}}' | head -c 700; echo
echo "Took $(( $(date +%s) - START )) seconds."
