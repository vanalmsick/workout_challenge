#!/usr/bin/env python
"""Preflight check for celery flower's --persistent state file.

Flower opens that file with ``shelve.open()``, i.e. ``dbm.open(path, "c")``.
The "c" flag creates the database only when the file is ABSENT; when the file
exists but its format cannot be identified, dbm raises instead:

    dbm.error: db type could not be determined

Flower does not catch that (flower/events.py, ``Events.__init__``), so the
process exits 1, supervisord restarts it, and it dies on the same file again -
forever, because the file lives in the mounted ``src-backend/data`` volume and
so outlives both container restarts and image rebuilds.

The file goes unreadable in two ways:

* it is truncated to under 4 bytes - flower killed mid-write by a container
  stop, an OOM kill or a full disk. ``dbm.whichdb`` then returns "", which is
  the "could not be determined" case.
* it was written by a different dbm backend than the running interpreter can
  identify. CPython 3.13 made ``dbm.sqlite3`` the default backend
  (``dbm._names == ["dbm.sqlite3", "dbm.gnu", "dbm.ndbm", "dbm.dumb"]``), so a
  state file left behind by an older base image can stop being readable purely
  because the image's python was bumped.

The file holds nothing but flower's task-event history, which is a debugging
convenience, so the correct response to any unreadable state is always to throw
it away and let flower start clean. This script does exactly that, and always
exits 0 - a bug in here must never be what keeps flower down.
"""

import glob
import os
import shelve
import sys

DEFAULT_DB = "/workout_challenge/src-backend/data/flower.db"


def _log(message):
    print(f"flower-preflight: {message}", flush=True)


def reset_if_unreadable(db):
    """Delete flower's state file (and its siblings) unless it opens cleanly."""
    # Backends spread the database over several paths: dbm.sqlite3 adds
    # "-wal"/"-shm", dbm.dumb uses ".dir"/".dat"/".bak". Match them all.
    paths = sorted(glob.glob(db + "*"))
    if not paths:
        _log(f"{db} does not exist yet - flower will create it")
        return

    try:
        # "w" = read-write, must already exist. Deliberately not "r": a
        # read-only sqlite open cannot replay a leftover -wal and would report
        # a healthy database as broken. Reading a key back also exercises the
        # unpickling flower itself does, catching corrupt values, not just a
        # corrupt container format.
        with shelve.open(db, "w") as state:
            state.get("events")
    except Exception as exc:  # noqa: BLE001 - any failure means "unusable"
        _log(f"{db} is unreadable ({exc.__class__.__name__}: {exc}) - resetting")
        for path in paths:
            try:
                os.remove(path)
                _log(f"removed {path}")
            except OSError as remove_exc:
                _log(f"could not remove {path}: {remove_exc}")
    else:
        _log(f"{db} opened cleanly")


if __name__ == "__main__":
    try:
        reset_if_unreadable(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB)
    except Exception as exc:  # noqa: BLE001 - never block flower's startup
        _log(f"unexpected error, continuing anyway ({exc.__class__.__name__}: {exc})")
    sys.exit(0)
