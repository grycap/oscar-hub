#!/bin/sh
set -eu
# Exposed services use the container entrypoint/CMD.
# OSCAR requires a script file even when expose.default_command is enabled.
echo 'Open VS Code image default command.'
