#!/bin/bash
set -euo pipefail

# This is for local development, in production cgroup should be created beforehand
# so the Node process does not have to run elevated.
if [[ -v CREATE_CGROUP ]]; then
    sudo mkdir -p /sys/fs/cgroup/pids/NSJAIL
    sudo chown $(id -u):$(id -g) /sys/fs/cgroup/pids/NSJAIL
fi

if [[ -v CACHE_AST ]]; then
    if [[ -v TEST ]]; then
        alumina_extra_args="--ast $ALUMINA_SYSROOT/sysroot-test.ast"
    else
        alumina_extra_args="--ast $ALUMINA_SYSROOT/sysroot.ast"
    fi
    unset ALUMINA_SYSROOT
    jail_extra_args=""
else
    alumina_extra_args=""
    jail_extra_args="-E ALUMINA_SYSROOT"
fi

# Jail the compiler invocation too just to make abuse harder. Since it's
# harder to hack the box at compile time, the jail is more forgiving,
# but one could try `include_bytes!("/proc/<node process>/environ")` and
# read the AWS credentials, so we run it in a PID namespace with read-only
# root FS.
minimum_security_prison() {
    # NSJail does not work with PATH
    cmd=$(which $1)
    shift

    $NSJAIL -Me \
        --chroot / -B $PWD --cwd $PWD \
        --hostname alumina \
        --disable_rlimits \
        -E PATH -E HOME $jail_extra_args \
        -E CLICOLOR_FORCE=1 -E RUST_BACKTRACE=full \
        --really_quiet -- $cmd $@
}

touch compiler.output

if [[ -v TEST ]]; then
    minimum_security_prison $ALUMINA_BOOT \
        $alumina_extra_args --debug --cfg threading --cfg libbacktrace --cfg coroutines --cfg test \
        playground=program.alu \
        -o program.c &>> compiler.output
    extra_env="-E CLICOLOR_FORCE=1"
else
    minimum_security_prison $ALUMINA_BOOT \
        $alumina_extra_args --debug --cfg threading --cfg libbacktrace --cfg coroutines \
        playground=program.alu \
        -o program.c &>> compiler.output
    extra_env=""
fi

minimum_security_prison gcc -w -fdiagnostics-color=always \
    -O0 -g3 -fPIE -rdynamic -o program.out program.c -lm -lpthread -lbacktrace -lminicoro \
    &>> compiler.output

echo 0 > program.ret

# The program itself runs in a much more restrictive jail, since the user
# can pretty much do anything in their program. Resource limits are also
# important so that the program does not run forever or use too much memory.
# cgroups don't seem to work since the whole app is running in k8s and the
# root cgroup hierarchy is not mounted, so we resort to rlimits for fork-bomb
# protection. Oh well
$NSJAIL -Mo --user 99999 --group 99999 \
    -R /lib -R /lib64/ -R /usr/lib -R /usr/bin/ -R /usr/sbin/ \
    -R /bin/ -R /sbin/ -R /dev/null  -R /dev/random  -R /dev/urandom -T /data \
    -E PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    -E HOSTNAME=alumina $extra_env \
    --cwd /data \
    --hostname alumina \
    --max_cpus 1 \
    --execute_fd \
    --rlimit_as 64 \
    --rlimit_cpu 5 \
    --rlimit_nofile 32 \
    --rlimit_nproc 256 \
    --time_limit 10 \
    --really_quiet ./program.out &> program.output || echo $? > program.ret


