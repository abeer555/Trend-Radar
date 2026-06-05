FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /data

ENV SQLITE_DB_PATH=/data/market_predictor.db

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
