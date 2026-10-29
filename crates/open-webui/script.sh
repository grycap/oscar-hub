#!/bin/sh
set -eu
# Exposed services use the upstream Open WebUI container entrypoint/CMD.
# OSCAR requires a script file even when expose.default_command is enabled.
echo 'Open WebUI starts with the image default command.'
