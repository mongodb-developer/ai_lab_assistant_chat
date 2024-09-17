#!/bin/sh
git add -A
git commit -m "another submit to deploy"
git push origin main
gcloud app deploy --quiet
