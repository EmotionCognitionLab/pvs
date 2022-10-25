#!/usr/bin/env bash

set -e

rm -rf layer && mkdir -p layer/nodejs/node_modules

rm -rf build && mkdir build && cp package*.json build

cd build
docker run --rm -v "$PWD":/var/task --platform="linux/amd64" lambda-docker:14.x "npm install"
cd ..

cp -r build/node_modules/ layer/nodejs/node_modules
