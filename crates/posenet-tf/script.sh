#!/bin/bash
set -euo pipefail

# This crate relies on expose.default_command=true, so OSCAR launches the
# container CMD (`deepaas-run`) instead of this script.
echo "posenet-tf uses the container default command for the exposed DEEPaaS API."
