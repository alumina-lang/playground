#!/bin/bash
set -euo pipefail

user_spec=1000:1000

mkdir -p /sys/fs/cgroup/pids/NSJAIL
chown $user_spec /sys/fs/cgroup/pids/NSJAIL

exec gosu $user_spec node server.js --hostname '::'
