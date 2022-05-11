FROM python:3.6-alpine as base

FROM base as builder

RUN apk update && apk add build-base postgresql-dev gcc python3-dev musl-dev curl
ENV CONTAINER_HOME=/var/www
ADD . $CONTAINER_HOME
WORKDIR $CONTAINER_HOME

RUN pip install -r $CONTAINER_HOME/requirements.txt