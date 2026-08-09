# syntax=docker/dockerfile:1
#
# Multi-stage build for Workout Challenge.
#
#   frontend  -> React SPA build (arch-independent, built natively on the build host)
#   pydeps    -> Python virtualenv, compiled with a toolchain that never ships
#   final     -> runtime only: nginx + redis + supervisor + the venv
#
# Base image tags are written literally (not via ARG) so Dependabot's docker
# ecosystem keeps bumping them.

# ==============================================================================
# Stage 1 - Frontend: build the React SPA
# ==============================================================================
# --platform=$BUILDPLATFORM: the build output is plain JS/CSS/HTML and therefore
# architecture-independent, so this stage runs natively on the builder instead of
# once per target arch under QEMU emulation. On the multi-arch CI build this
# removes an entire emulated webpack run.
FROM --platform=$BUILDPLATFORM node:25-alpine AS frontend

WORKDIR /build

# Dependency layer first: invalidated only when the manifest/lockfile change,
# not on every source edit.
COPY src-frontend/package.json src-frontend/package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

# NODE_ENV is deliberately NOT set to "production" above: craco, tailwind and
# postcss are devDependencies and are required to run the build.
COPY src-frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2 - Python dependencies: build a self-contained virtualenv
# ==============================================================================
FROM python:3.14-alpine AS pydeps

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore

# Nearly every dependency (psycopg2-binary, gevent, greenlet, pillow, tornado,
# pydantic-core) publishes musllinux_1_2 wheels, so nothing is compiled for them.
# The exception is zope.interface (a gevent dependency), which ships manylinux
# wheels only and is therefore built from sdist. build-base covers it and stays
# behind in this stage - it never reaches the final image.
RUN apk add --no-cache build-base

RUN python -m venv /venv
ENV PATH="/venv/bin:$PATH"

COPY src-backend/requirements.txt /tmp/requirements.txt
ARG TARGETARCH
RUN --mount=type=cache,id=pip-$TARGETARCH,target=/root/.cache/pip,sharing=locked \
    pip install -r /tmp/requirements.txt gunicorn

# ==============================================================================
# Stage 3 - Final runtime image
# ==============================================================================
FROM python:3.14-alpine AS final

LABEL org.opencontainers.image.title="Workout Challenge" \
      org.opencontainers.image.description="Compete with friends on workout minutes, calories and steps." \
      org.opencontainers.image.source="https://github.com/vanalmsick/workout_challenge" \
      org.opencontainers.image.licenses="GPL-3.0"

# nginx      - serves the React build, reverse-proxies /api and /admin
# redis      - cache + Celery broker/result backend
# supervisor - process manager for redis/celery/gunicorn/nginx
#
# Deliberately absent vs. the previous image: gcc, build-base, musl-dev,
# python3-dev, postgresql-dev and nano. No compiler is needed at runtime, and
# psycopg2-binary statically bundles libpq so postgresql-libs is redundant too.
RUN apk add --no-cache \
        nginx \
        redis \
        supervisor \
    && mkdir -p /run/nginx

ENV PATH="/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY --from=pydeps /venv /venv

# Config layers before source: they change rarely, so they stay cached.
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisord.conf

WORKDIR /workout_challenge/src-backend
COPY src-backend/ /workout_challenge/src-backend/
RUN python manage.py collectstatic --noinput

# Frontend last: a frontend-only change then rebuilds just this one layer.
COPY --from=frontend /build/build /usr/share/nginx/html

# supervisord.conf expects the top-level directory containing src-backend/.
WORKDIR /workout_challenge

# Django migrations + sqlite database, persisted across container rebuilds.
VOLUME /workout_challenge/src-backend/data

EXPOSE 80
EXPOSE 8000
EXPOSE 9001
EXPOSE 5555

# busybox wget - no extra package needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
