#! /bin/bash
DATE=`date --iso-8601`
LOGFILE=log-$DATE.txt
while : 
do
  git pull >> "$LOGFILE"
  echo "RESTARTING:" >> "$LOGFILE"
  date >> "$LOGFILE"
  ts-node src/index.ts >> "$LOGFILE" 2>&1 
  sleep 5
done