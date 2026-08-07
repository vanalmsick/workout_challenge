FROM node:25 AS frontend
WORKDIR /workout_challenge/src-frontend
COPY src-frontend/ /workout_challenge/src-frontend/
RUN npm install && npm run build

FROM python:3.14-alpine AS backend
WORKDIR /workout_challenge/src-backend
COPY src-backend/ /workout_challenge/src-backend/

# Install build dependencies for psycopg2
RUN apk add --no-cache postgresql-dev gcc python3-dev musl-dev
RUN pip install --no-cache-dir -r requirements.txt

# Collect Django static files
RUN python3 manage.py collectstatic --noinput

FROM python:3.14-alpine AS final

# Install system dependencies
RUN apk add --no-cache nginx supervisor build-base redis postgresql-libs

# Install build dependencies for psycopg2
RUN apk add --no-cache postgresql-dev gcc python3-dev musl-dev nano

# Set workdir
WORKDIR /workout_challenge

# Copy backend code
COPY --from=backend /workout_challenge/src-backend /workout_challenge/src-backend

# Copy requirements and install them again
COPY src-backend/requirements.txt /workout_challenge/src-backend/requirements.txt
RUN pip install --no-cache-dir -r /workout_challenge/src-backend/requirements.txt && pip install gunicorn

# Copy frontend build
COPY --from=frontend /workout_challenge/src-frontend/build /usr/share/nginx/html

# Copy configs
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY supervisord.conf /etc/supervisord.conf

# NGINX runtime folder
RUN mkdir -p /run/nginx

# Django data folder with mirgations and sqlite database
VOLUME /workout_challenge/src-backend/data

# the app
EXPOSE 80
# supervisord - monitoring of running apps
EXPOSE 9001
# celery flower - monitoring of celery tasks
EXPOSE 5555

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]