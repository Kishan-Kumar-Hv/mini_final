# MedCareGuardianApp

Medicare guardian-patient medication reminder platform.

## Features
- Guardian and patient authentication
- Medication scheduling and adherence tracking
- Reminder escalation workflow (SMS integration ready)
- Karnataka medical directory and health news

## Local Run
- Backend defaults to `127.0.0.1:8787`
- Frontend dev server defaults to `127.0.0.1`

Start MongoDB locally, or create a MongoDB Atlas cluster, then set the connection string:

```bash
cp .env.example .env
# optional local MongoDB with Docker
# docker compose up -d mongo
npm run server
```

The backend uses MongoDB through `MONGO_URI` and `MONGO_DB_NAME`. Demo seed data is off by default. Set `SEED_DEMO_DATA=true` in `.env` only if you want the sample guardian and patient accounts back.

Start the frontend:

```bash
npm run dev
```

Then open the local URL printed by Vite. If port `5173` is already in use, Vite will automatically use the next available localhost port.

## Run
- `npm install`
- `npm run build`
- `npm run start`

## Hosting
Set these environment variables on your host:
- `MONGO_URI`: your MongoDB Atlas or hosted Mongo connection string
- `MONGO_DB_NAME`: database name, defaults to `medassist`
- `HOST`: use `0.0.0.0` on Render/Railway/Fly if required by the host
- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`: Twilio credentials
- `TWILIO_SMS_FROM` or `TWILIO_MESSAGING_SERVICE_SID`: required for real SMS delivery

## Twilio
- `TWILIO_MESSAGING_SERVICE_SID` can power reminder SMS without a fixed sender number.
