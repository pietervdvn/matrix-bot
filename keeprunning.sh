#! /bin/bash

while : 
do
  echo "RESTARTING:" >> log.txt
  date >> log.txt
  ts-node src/index.ts >> log.txt 2>&1 
  git pull >> log.txt
done