FROM ghcr.io/open-webui/open-webui:v0.9.0

LABEL org.opencontainers.image.source="https://github.com/grycap/oscar-hub"
LABEL org.opencontainers.image.description="Open WebUI packaged as an OSCAR exposed service"
LABEL org.opencontainers.image.licenses="Open-WebUI-License"

COPY script.sh /opt/oscar/open-webui/script.sh
RUN chmod +x /opt/oscar/open-webui/script.sh

EXPOSE 8080

CMD ["bash", "/opt/oscar/open-webui/script.sh"]
