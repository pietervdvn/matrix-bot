#! /bin/bash

while : 
do
  git pull >> log.txt
  echo "RESTARTING:" >> log.txt
  date >> log.txt
  ts-node src/index.ts >> log.txt 2>&1 
  sleep 5
done