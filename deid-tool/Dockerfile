# Asset Data Group — de-identification tool (batteries-included image).
#
# The bare deid.py needs nothing but Python. This image adds the optional extras so
# everything works out of the box inside the container: spaCy name detection and the
# Parquet/Excel formats. Build it once and hand it to a client to run behind their
# firewall — the container is the portable, self-contained form of the tool (and the
# same artifact that would run on an on-prem appliance).
#
#   docker build -t adg-deid .
#   # mount a folder with your data; nothing leaves the container but the output you write
#   docker run --rm -v "$PWD/data:/data" adg-deid -i /data/input.csv --detect
#   docker run --rm -v "$PWD/data:/data" adg-deid \
#       -i /data/input.csv --profile hipaa-safe-harbor -o /data/cleaned.csv -r /data/report
#
# To run the local web UI from the container instead, override the entrypoint:
#   docker run --rm -p 8000:8000 -v "$PWD/data:/data" \
#       --entrypoint python adg-deid serve.py --host 0.0.0.0

FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir "spacy>=3.5" pyarrow openpyxl \
    && python -m spacy download en_core_web_sm

COPY deid.py package.py serve.py config.example.json README.md ./

# Default: run the CLI; args after the image name pass straight through.
ENTRYPOINT ["python", "deid.py"]
CMD ["--help"]
