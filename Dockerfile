FROM ubuntu:18.04

RUN apt update && apt install curl unzip -y -q

ENV DENO_INSTALL /usr/local
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s v1.4.0

RUN useradd -m -u 1000 -U -s /bin/sh deno
USER deno

COPY . /app

WORKDIR /app

EXPOSE 80 443

CMD deno
