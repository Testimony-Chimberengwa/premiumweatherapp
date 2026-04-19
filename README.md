# Premium Weather Pulse

A high-energy animated weather dashboard built with React and WeatherAPI.

## Highlights

- Animated premium UI with dynamic weather themes (sunny, rainy, overcast, night)
- Auto-detect current location via browser geolocation
- Search any city/location with live WeatherAPI suggestions
- Current conditions with feels-like, wind, pressure, precipitation, and humidity
- 24-hour visual chart for temperature and rain chance
- 3-day forecast cards
- Random quotes powered by RapidAPI with a local fallback when unavailable
- Air quality metrics and US EPA quality label
- Weather alerts panel (when available)
- Astronomy panel for sunrise, sunset, moonrise, and moon phase
- Unit switcher (C/F)

## Stack

- React + Vite
- Framer Motion for animation
- Recharts for data visualization
- React Icons for iconography

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file (copy from `.env.example`) and set your key:

```bash
VITE_WEATHER_API_KEY=your_weatherapi_key_here
VITE_QUOTES_API_KEY=your_rapidapi_key_here
```

3. Start dev server:

```bash
npm run dev
```

4. Build production bundle:

```bash
npm run build
```

## API

- Provider: WeatherAPI
- Docs: https://www.weatherapi.com/docs/

## Quotes API

- Provider: RapidAPI Famous Quotes
- Endpoint: `https://famous-quotes4.p.rapidapi.com/random?category=all&count=1`
- Host: `famous-quotes4.p.rapidapi.com`

## Notes

- Browser location access is required for automatic local weather detection.
- If location permission is denied, the app falls back to a default city and still supports full search.
