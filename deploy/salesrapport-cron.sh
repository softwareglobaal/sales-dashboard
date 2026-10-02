#!/usr/bin/env bash
# Plant het salesrapport in (spec §17c). Idempotent. Op de server draaien na de merge.
set -euo pipefail
S=/home/ubuntu/appportal/sales/deploy/salesrapport.py
python3 "$S" week --droog | head -3
( crontab -l 2>/dev/null | grep -v 'salesrapport.py' ;
  echo "0 10 * * 1 /usr/bin/python3 $S week >> /home/ubuntu/salesrapport.log 2>&1" ;
  echo "0 10 1 * * /usr/bin/python3 $S maand >> /home/ubuntu/salesrapport.log 2>&1" ) | crontab -
crontab -l | grep salesrapport
