#!/usr/bin/env python3
"""True UNIX daemon launcher (double-fork). Survives sandbox process reaping.
Usage: python3 daemon_start.py <logfile> <command> [args...]"""
import os, sys

def daemonize_exec(logfile, cmd):
    pid = os.fork()
    if pid == 0:
        os.setsid()
        pid2 = os.fork()
        if pid2 == 0:
            fd = os.open(logfile, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
            os.dup2(fd, 1)
            os.dup2(fd, 2)
            devnull = os.open(os.devnull, os.O_RDONLY)
            os.dup2(devnull, 0)
            os.execvp(cmd[0], cmd)
            os._exit(127)
        os._exit(0)
    os.waitpid(pid, 0)

if __name__ == "__main__":
    logfile = sys.argv[1]
    cmd = sys.argv[2:]
    daemonize_exec(logfile, cmd)
    print(f"daemonized: {' '.join(cmd)} -> {logfile}")
