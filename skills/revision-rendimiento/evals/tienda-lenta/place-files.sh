#!/usr/bin/env bash
set -eu
cp -R "$(dirname "$0")/files/." .
# Imagen pesada generada aquí para no guardar 1,3 MB en el repo
head -c 1300000 /dev/urandom > public/banner.png
