# Workout Challenge
No matter if a healthy close your rings competition with friends or a September steps challenge with work colleagues, this webapp enables you to compete with friends and co-workers across devices (Apple / Android / Garmin / etc.) using the metrics you want to use (km / minutes / kcal / # of times / etc.) respecting your privacy. Participants can either add their workouts and/or steps manually or link their free Strava account for automatic workout import. 

## How does it work?
Create your own competition or use a friend’s invitation link to join their competition, enter your workouts manually or link your Strava for automatic workout import, and enjoy the competition. You can customize each competition's activity goals individually. Participants earn 1 point for every 1% progress towards a goal. For example, if the goal is 100 minutes of exercise and you work out 50 minutes, you earn 50 points. Additionally, you can cap / floor the maximum / minimum points participants can earn per workout / day / week to e.g. ensure a healthy competition that is focused on consistency.

**Features:**
- Create your own competition or use a friend’s invitation link to join their competition
- Enter workouts manually or import them automatically via Strava (daily at 4 AM)
- Your personal dashboard shows workout stats and your workout streak
- The competition dashboards show friends’ workouts, leaderboards, and your progress towards the competition goals
- A weekly email on Mondays shows you your spot on the competition leaderboards
- An optional weekly email on Thursday shows your progress against your personal goals
- Fully responsive website and emails (mobile, tablet, desktop)
- Light and dark mode

**Competition Goal Choices:**  
*Create one or several goals for your competition.*
- **Metrics:** time (minutes) / number of times (#) / distance (km) / calories (kcal) / kilojoules (kj)
- **Period:** per day / per week / per month / during the entire competition
- **Limits:** min / max per workout, min / max per day, min / max per week

### Your Personal Dashboard:
![Preview Dashboard](/docs/imgs/preview-myspace-light.png)

### Competition Dashboards:
![Preview Competition](/docs/imgs/preview-competition-both.png)


### Automatic Strava Workout Import:
![Preview Strava Import](/src-frontend/public/how_to_strava_sync.png)

<div align="center">

If you like <b>Workout Challenge</b>, consider giving it a **star** ⭐!  
Made with ❤️ in London  

<a href='https://ko-fi.com/vanalmsick' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>  
</div>


## Give it a quick try
```
docker run -p 80:80 -e ALLOW_ALL_HOSTS=true vanalmsick/workout_challenge
```

## Full Production Deployment
[**docker-compose.yml**](/docker-compose.yml)
```
version: '3.9'

services:
  workoutchallenge:
    image: vanalmsick/workout_challenge
    container_name: workoutchallenge
    ports:
      - "80:80"
      - "5555:5555" # Celery Flower task monitoring - do not open to public - only for local network for debugging
      - "9001:9001" # Supervisord process monitoring - do not open to public - only for local network for debugging
      - "8000:8000" # Django admin space - do not open to public - only for local network for debugging
    volumes:
      - /usr/pi/workout_challenge/django:/workout_challenge/src-backend/data
    environment:
      - POSTGRES_HOST=workoutchallenge-database
      - POSTGRES_DB=workoutchallenge
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - MAIN_HOST=http://your-url.com
      - HOSTS=http://your-url.com,http://localhost,http://127.0.0.1
      - SECRET_KEY=<your_random_string_for_encryption>
      - TIME_ZONE=Europe/London
      - STRAVA_CLIENT_ID=000000
      - STRAVA_CLIENT_SECRET=<secret_key>
      - SENTRY_DSN=https://<PUBLIC_KEY>@<HOST>/<PROJECT_ID>
      - EMAIL_HOST=smtp.gmail.com
      - EMAIL_PORT=465
      - EMAIL_HOST_USER=competition@yourdomain.com
      - EMAIL_HOST_PASSWORD=password
      - EMAIL_USE_SSL=True
      - EMAIL_USE_TLS=False
      - EMAIL_FROM=competition@yourdomain.com
      - EMAIL_REPLY_TO=support@yourdomain.com
      - OPENAI_API_KEY=<secret_key>
    restart: unless-stopped
    depends_on:
      database:
        condition: service_healthy

  database:
    image: postgres:15
    container_name: workoutchallenge-database
    environment:
      - POSTGRES_DB=workoutchallenge
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - /usr/pi/workout_challenge/postgres:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: [ "CMD-SHELL", "pg_isready -U postgres" ]
      interval: 5s
      timeout: 5s
      retries: 5
```

```
docker compose -f /path/to/docker-compose.yml up
```

### Environment variables
| Variable              | Default                             | Definition                                                                                                                                                                                                                                                                                                      |
|-----------------------|-------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| MAIN_HOST             | "http://localhost"                  | The main hosting url for the Django backend.                                                                                                                                                                                                                                                                    |
| HOSTS                 | "http://localhost,http://127.0.0.1" | Comma seperated list of hosts for Django. This is used for [ALLOWED_HOSTS](https://docs.djangoproject.com/en/5.2/ref/settings/#allowed-hosts), [CORS_ALLOWED_ORIGINS](https://pypi.org/project/django-cors-headers/), and [CSRF_TRUSTED_ORIGINS](https://pypi.org/project/django-cors-headers/).                |
| SECRET_KEY            | [a hard-coded string in code]       | Django's [SECRET_KEY](https://docs.djangoproject.com/en/5.2/ref/settings/#std-setting-SECRET_KEY) for cryptographic signing.                                                                                                                                                                                    |
| TIME_ZONE             | "Europe/London"                     | Timezone for [Django](https://docs.djangoproject.com/en/5.2/ref/settings/#time-zone) and [Celery](https://docs.celeryq.dev/en/stable/userguide/configuration.html#timezone)                                                                                                                                     |
| DEBUG                 | false                               | Django's DEBUG mode. If true, [CORS_ALLOW_ALL_ORIGINS](https://pypi.org/project/django-cors-headers/) will also be true and the [CACHE](https://docs.djangoproject.com/en/5.2/ref/settings/#caches) will use [Local Memory Cache](https://docs.djangoproject.com/en/5.2/ref/settings/#caches) instead of Redis. |
| ALLOW_ALL_HOSTS       | false                               | For quick testing to not having to set HOSTS. Do not set to true in production but set HOSTS.                                                                                                                                                                                                                   |
| POSTGRES_HOST         | None                                | If set to None, Django will use SQLite as database (might cause database lock errors in production), else this is the host url to the [Postgres database](https://hub.docker.com/_/postgres/).                                                                                                                  |
| POSTGRES_DB           | "postgres"                          | Database name in [Postgres database](https://hub.docker.com/_/postgres/)                                                                                                                                                                                                                                        | 
| POSTGRES_USER         | "postgres"                          | Database username in [Postgres database](https://hub.docker.com/_/postgres/)                                                                                                                                                                                                                                    | 
| POSTGRES_PASSWORD     | ""                                  | Database password in [Postgres database](https://hub.docker.com/_/postgres/)                                                                                                                                                                                                                                    | 
| SENTRY_DSN            | None                                | If None no [Sentry.io](https://sentry.io/) error capturing, else please provide the project url https://<PUBLIC_KEY>@<HOST>/<PROJECT_ID> *(In local development you might have to set REACT_APP_SENTRY_DSN instead)*                                                                                            | 
| STRAVA_CLIENT_ID      | "1234321"                           | [Strava API](https://developers.strava.com) Client Id. Please see below how to get one. *(In local development you might have to set REACT_APP_STRAVA_CLIENT_ID instead)*                                                                                                                                       | 
| STRAVA_CLIENT_SECRET  | "ReplaceWithClientSecret"           | [Strava API](https://developers.strava.com) Client Secret. Please see below how to get one.                                                                                                                                                                                                                     | 
| STRAVA_LIMIT_15MIN    | 100                                 | [Strava API](https://developers.strava.com) Limit per 15min. 300 if part of developer program, else 100.                                                                                                                                                                                                        | 
| STRAVA_LIMIT_DAY      | 1000                                | [Strava API](https://developers.strava.com) Limit per day. 3000 if part of developer program, else 1000.                                                                                                                                                                                                        | 
| REACT_APP_BACKEND_URL | ""                                  | Overwrite the url to the Django API used by React. This is intended for local development outside of the docker container - e.g. http://localhost:8000.                                                                                                                                                         | 
| EMAIL_HOST            | None                                | SMTP server host url to send out automated emails.                                                                                                                                                                                                                                                              | 
| EMAIL_PORT            | None                                | SMTP server port to send out automated emails.                                                                                                                                                                                                                                                                  | 
| EMAIL_HOST_USER       | None                                | SMTP server username to send out automated emails.                                                                                                                                                                                                                                                              | 
| EMAIL_HOST_PASSWORD   | None                                | SMTP server password to send out automated emails.                                                                                                                                                                                                                                                              | 
| EMAIL_USE_SSL         | False                               | SMTP server - if SSL ise used for authentication.                                                                                                                                                                                                                                                               | 
| EMAIL_USE_TLS         | False                               | SMTP server - if TLS ise used for authentication.                                                                                                                                                                                                                                                               | 
| EMAIL_FROM            | None                                | Sender email address of automated emails.                                                                                                                                                                                                                                                                       | 
| EMAIL_REPLY_TO        | None                                | Reply-To email address of automated emails.                                                                                                                                                                                                                                                                     | 
| OPENAI_API_KEY        | None                                | OpenAI API key to generate workout / health / nutritional facts for the weekly update email.                                                                                                                                                                                                                    | 

### How to get the Strava API Client id & secret
1. Login to your Strava account [strava.com/login](https://www.strava.com/login)
2. Profile picture -> Settings
3. "My API Application"
4. Test the workout challenge (only works with your own Strava account)
5. If you like the workout challenge, apply to the [Strava developer program](https://share.hsforms.com/1VXSwPUYqSH6IxK0y51FjHwcnkd8) here to also allow other users to link their Strava

## Do you want to help / contribute?
### Code Overview / Structure
- [**Docker Container**](/Dockerfile) for deployment 
- [**Supervisord**](supervisord.conf) to start all processes in docker container
- [**Nginx**](/nginx.conf) to run frontend (React) and proxy traffic to backend (Django) which is run by gunicorn
#### Frontend *([src-frontend](/src-frontend))*
- [**React**](/src-frontend/src/App.js)
#### Backend *([src-backend](/src-backend))*
- [**Django**](/src-backend/workout_challenge/settings.py) (RestAPI) via gunicorn for production
- [**Redis**](supervisord.conf) as cache and for Celery
- [**Celery**](/src-backend/workout_challenge/celery.py) as task que for Django
- [**Celery Beat**](supervisord.conf) for task scheduling for Django
- [**Celery Flower**](supervisord.conf) UI to inspect task que and task status
- [**mjml**](src-backend/custom_user/templates) Framework / app to write responsive email html ([mjml.io](https://mjml.io))

### How to run locally for development
#### Backend - Task-Scheduling (Celery)
working dir: `/workout_challenge/src-backend`  
run Redis: `redis-server`  
run Celery Worker: `celery -A workout_challenge worker --loglevel INFO --without-mingle --without-gossip --events`  
run Celery Beat: `celery -A workout_challenge beat --scheduler django_celery_beat.schedulers:DatabaseScheduler --loglevel INFO`  
run Celery Flower: `celery -A workout_challenge flower`  
***Note:** For testing email celery tasks, please set the Email env variables. For testing Strava sync celery tasks, please set the Strava env variables. For celery beat, don't forget to set the timezone env variable.*

#### Backend - RESTApi Server (Django)
working dir: `/workout_challenge/src-backend`  
suggested env variables:
```
PYTHONUNBUFFERED=1
DJANGO_SETTINGS_MODULE=workout_challenge.settings
DEBUG=true
MAIN_HOST=http://localhost
HOSTS=http://localhost,http://127.0.0.1
TIME_ZONE=Europe/London
STRAVA_CLIENT_ID=000000
STRAVA_CLIENT_SECRET=<secret_key>
```
initial Django setup: `python manage.py makemigrations && python manage.py migrate`  
run Django: `python manage.py runserver`  

#### Frontend (React)
working dir: `/workout_challenge/src-frontend`  
suggested env variables:
```
REACT_APP_BACKEND_URL=http://localhost:8000
```
run React: `npm start`


#### ToDos / Ideas:
- Add help text to "Link Strava Button" if Strava linkage is not set up
- Add explanation text for how Steps are converted
- Add tickbox for runs/walks if they count towards the total daily steps
- Group finished competitions in archive button
- Remove total daily steps from weekly email
- Add competition finish email
- Send competition start email if user joins after competition already started
- Add help text if users try joining competitions using non-invite link
- Add option for competition admin to remove users
- Improve README texts
- Improve repo link preview picture
- Add Garmin API support
- Add Futbit API suport
- Add friends page
- Add more personal statistics
- Add medals and achievements
- Add UI hint if old version of workout challenge is used