import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import {
  FiCloudDrizzle,
  FiCompass,
  FiMapPin,
  FiMoon,
  FiNavigation,
  FiSearch,
  FiSun,
  FiWind,
} from 'react-icons/fi'
import { WiBarometer, WiHumidity, WiStrongWind } from 'react-icons/wi'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const API_KEY = import.meta.env.VITE_WEATHER_API_KEY || '97ff2968860e41f2889104430261904'
const API_BASE = 'https://api.weatherapi.com/v1'

const epaLabels = {
  1: 'Good',
  2: 'Moderate',
  3: 'Unhealthy for sensitive groups',
  4: 'Unhealthy',
  5: 'Very unhealthy',
  6: 'Hazardous',
}

function getTheme(conditionText = '', isDay = 1) {
  const value = conditionText.toLowerCase()

  if (!isDay) {
    if (value.includes('clear')) return 'moonlit'
    if (value.includes('rain') || value.includes('drizzle')) return 'storm-night'
    return 'midnight'
  }

  if (value.includes('sun') || value.includes('clear')) return 'sunburst'
  if (value.includes('rain') || value.includes('drizzle')) return 'monsoon'
  if (value.includes('snow') || value.includes('ice')) return 'frost'
  if (value.includes('cloud') || value.includes('mist') || value.includes('fog')) {
    return 'overcast'
  }

  return 'sunburst'
}

function asLocalDateTime(value) {
  if (!value) return null
  return new Date(value.replace(' ', 'T'))
}

function formatHourLabel(value) {
  const date = asLocalDateTime(value)
  if (!date) return '--'
  return date.toLocaleTimeString([], { hour: 'numeric' })
}

function formatFriendlyDate(value) {
  const date = asLocalDateTime(value)
  if (!date) return '--'
  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatFriendlyTime(value) {
  const date = asLocalDateTime(value)
  if (!date) return '--'
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildHourlyData(days = [], currentEpoch = 0, isCelsius = true) {
  return days
    .flatMap((day) => day.hour)
    .filter((hour) => hour.time_epoch >= currentEpoch - 3600)
    .slice(0, 24)
    .map((hour) => ({
      time: formatHourLabel(hour.time),
      temp: isCelsius ? hour.temp_c : hour.temp_f,
      rain: hour.chance_of_rain,
    }))
}

function getWeatherEffects(weather) {
  const text = weather?.current?.condition?.text?.toLowerCase() || ''
  const rainChance = Number(weather?.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || 0)
  const precip = Number(weather?.current?.precip_mm || 0)
  const wind = Number(weather?.current?.wind_kph || 0)
  const gust = Number(weather?.current?.gust_kph || 0)

  const stormText =
    text.includes('thunder') ||
    text.includes('storm') ||
    text.includes('rain') ||
    text.includes('drizzle') ||
    text.includes('shower')

  const isRainy = stormText || rainChance >= 35 || precip >= 1
  const isHeavyRain = rainChance >= 60 || precip >= 5 || text.includes('heavy')
  const isFloodRisk = rainChance >= 70 || precip >= 8 || text.includes('flood')
  const isWindy = wind >= 18 || gust >= 28 || text.includes('wind') || text.includes('gust')
  const isLightning = text.includes('thunder') || text.includes('storm')

  return {
    isRainy,
    isHeavyRain,
    isFloodRisk,
    isWindy,
    isLightning,
  }
}

function buildParticles(count, prefix, minDuration = 1.8, maxDuration = 3.8) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    left: `${(index * 13) % 100}%`,
    delay: `${(index * 0.17) % 3.5}s`,
    duration: `${minDuration + ((index * 0.31) % (maxDuration - minDuration))}s`,
  }))
}

function normalizeLocationLabel(value = '') {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function CustomChartTooltip({ active, payload, label, unitLabel }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <p>{label}</p>
      <p>
        {Math.round(payload[0].value)}{unitLabel}
      </p>
      <p>Rain chance: {Math.round(payload[1].value)}%</p>
    </div>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCelsius, setIsCelsius] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [locationMode, setLocationMode] = useState('default')

  const loadWeather = useCallback(async (location, mode = 'search') => {
    if (!API_KEY) {
      setError('Missing WeatherAPI key. Add it in VITE_WEATHER_API_KEY.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const url = `${API_BASE}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(location)}&days=3&aqi=yes&alerts=yes`
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error?.message || 'Unable to load weather right now.')
      }

      setWeather(data)
      setLocationMode(mode)
      setQuery(`${data.location.name}, ${data.location.country}`)
      setSuggestions([])
      setShowSuggestions(false)
    } catch (fetchError) {
      setError(fetchError.message || 'Could not fetch weather data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => {
        loadWeather('Harare', 'default')
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        loadWeather(`${coords.latitude},${coords.longitude}`, 'geolocation')
      },
      () => {
        loadWeather('Harare', 'default')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    )
  }, [loadWeather])

  useEffect(() => {
    if (!API_KEY) return

    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const url = `${API_BASE}/search.json?key=${API_KEY}&q=${encodeURIComponent(trimmedQuery)}`
        const response = await fetch(url, { signal: controller.signal })
        const data = await response.json()
        if (Array.isArray(data)) {
          setSuggestions(data.slice(0, 6))
        }
      } catch {
        setSuggestions([])
      }
    }, 280)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  const unitLabel = isCelsius ? 'C' : 'F'
  const theme = getTheme(weather?.current?.condition?.text, weather?.current?.is_day)
  const forecastDays = weather?.forecast?.forecastday || []
  const alerts = weather?.alerts?.alert || []
  const airQuality = weather?.current?.air_quality || null
  const epaIndex = airQuality?.['us-epa-index'] || 0
  const weatherEffects = getWeatherEffects(weather)
  const rainDrops = buildParticles(weatherEffects.isHeavyRain ? 46 : weatherEffects.isRainy ? 28 : 0, 'rain', 1.4, 2.6)
  const windStreaks = buildParticles(weatherEffects.isWindy ? 18 : 0, 'wind', 1.8, 3.5)
  const floodWaves = buildParticles(weatherEffects.isFloodRisk ? 8 : weatherEffects.isHeavyRain ? 5 : 0, 'flood', 3.5, 6)
  const lightningBolts = buildParticles(weatherEffects.isLightning ? 4 : 0, 'bolt', 4, 7)
  const activeLocationLabel = normalizeLocationLabel(
    weather?.location ? `${weather.location.name}, ${weather.location.country}` : '',
  )
  const suggestionItems = suggestions.filter((item) => {
    const suggestionLabel = normalizeLocationLabel(`${item.name}, ${item.country}`)
    return suggestionLabel !== activeLocationLabel
  })

  const hourlyData = buildHourlyData(
    forecastDays,
    weather?.current?.last_updated_epoch || 0,
    isCelsius,
  )

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      setShowSuggestions(false)
      loadWeather(trimmed, 'search')
    }
  }

  const selectSuggestion = (item) => {
    const location = `${item.name}, ${item.country}`
    setShowSuggestions(false)
    loadWeather(location, 'search')
  }

  const refreshMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        loadWeather(`${coords.latitude},${coords.longitude}`, 'geolocation')
      },
      () => {
        setError('Location access denied. Search for a city to continue.')
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    )
  }

  return (
    <div className={`weather-shell theme-${theme}`}>
      <div className="background-layer" aria-hidden="true">
        <div className="aurora one" />
        <div className="aurora two" />
        <div className="grid-overlay" />
      </div>

      <Motion.header
        className="topbar panel"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
      >
        <div className="brand">
          <span className="brand-mark">PW</span>
          <div>
            <h1>Premium Weather Pulse</h1>
            <p>Hyper-visual weather intelligence for every location.</p>
          </div>
        </div>

        <form className="searchbar" onSubmit={handleSubmit}>
          <FiSearch />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setShowSuggestions(true)
              if (event.target.value.trim().length < 2) {
                setSuggestions([])
              }
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowSuggestions(false)
              }, 120)
            }}
            placeholder="Search city, region, or coordinates"
            aria-label="Search for weather by location"
          />
          <button type="submit" disabled={loading}>
            Find
          </button>

          <AnimatePresence>
            {showSuggestions && query.trim().length >= 2 && suggestionItems.length > 0 && (
              <Motion.ul
                className="suggestions"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                {suggestionItems.map((item) => (
                  <li key={`${item.id}-${item.lat}-${item.lon}`}>
                    <button
                      type="button"
                      onClick={() => selectSuggestion(item)}
                    >
                      <FiMapPin />
                      {item.name}, {item.country}
                    </button>
                  </li>
                ))}
              </Motion.ul>
            )}
          </AnimatePresence>
        </form>

        <div className="topbar-actions">
          <button type="button" className="ghost" onClick={refreshMyLocation}>
            <FiNavigation /> My location
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => setIsCelsius((value) => !value)}
          >
            {isCelsius ? 'Switch to F' : 'Switch to C'}
          </button>
        </div>
      </Motion.header>

      <AnimatePresence>
        {error && (
          <Motion.div
            className="error-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {error}
          </Motion.div>
        )}
      </AnimatePresence>

      {loading && !weather && <div className="loading">Pulling fresh sky data...</div>}

      {weather && (
        <main className="dashboard">
          <Motion.section
            className="hero-card panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="hero-effects" aria-hidden="true">
              {weatherEffects.isRainy && (
                <div className="weather-overlay rain-overlay">
                  {rainDrops.map((drop) => (
                    <span
                      key={drop.id}
                      className="rain-drop"
                      style={{ left: drop.left, animationDelay: drop.delay, animationDuration: drop.duration }}
                    />
                  ))}
                </div>
              )}
              {weatherEffects.isWindy && (
                <div className="weather-overlay wind-overlay">
                  {windStreaks.map((streak) => (
                    <span
                      key={streak.id}
                      className="wind-streak"
                      style={{ top: streak.left, animationDelay: streak.delay, animationDuration: streak.duration }}
                    />
                  ))}
                </div>
              )}
              {(weatherEffects.isFloodRisk || weatherEffects.isHeavyRain) && (
                <div className="weather-overlay flood-overlay">
                  <div className="flood-glow" />
                  <div className="flood-water">
                    {floodWaves.map((wave) => (
                      <span
                        key={wave.id}
                        className="flood-wave"
                        style={{ left: wave.left, animationDelay: wave.delay, animationDuration: wave.duration }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {weatherEffects.isLightning && (
                <div className="weather-overlay lightning-overlay">
                  {lightningBolts.map((bolt) => (
                    <span
                      key={bolt.id}
                      className="lightning-bolt"
                      style={{ left: bolt.left, animationDelay: bolt.delay, animationDuration: bolt.duration }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="hero-main">
              <p className="eyebrow">
                {locationMode === 'geolocation' ? 'Live from your location' : 'Searched location'}
              </p>
              <h2>
                {weather.location.name}, {weather.location.country}
              </h2>
              <p className="localtime">
                Local time: {formatFriendlyDate(weather.location.localtime)} at{' '}
                {formatFriendlyTime(weather.location.localtime)}
              </p>
              <div className="temperature-row">
                <span className="temperature">
                  {Math.round(isCelsius ? weather.current.temp_c : weather.current.temp_f)}
                </span>
                <span className="unit">{unitLabel}</span>
              </div>
              <p className="condition">{weather.current.condition.text}</p>
              <p className="feels-like">
                Feels like {Math.round(isCelsius ? weather.current.feelslike_c : weather.current.feelslike_f)}
                {unitLabel}
              </p>
            </div>

            <div className="hero-aside">
              <img
                src={weather.current.condition.icon}
                alt={weather.current.condition.text}
              />
              <div className="wind-chip">
                <FiWind /> Wind {Math.round(weather.current.wind_kph)} km/h
              </div>
              <div className="wind-chip">
                <FiCompass /> {weather.current.wind_dir}
              </div>
            </div>
          </Motion.section>

          {alerts.length > 0 && (
            <Motion.section
              className="alerts panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <h3>Weather Alerts</h3>
              {alerts.slice(0, 2).map((alert) => (
                <article key={`${alert.headline}-${alert.effective}`}>
                  <h4>{alert.headline}</h4>
                  <p>{alert.desc?.slice(0, 210) || 'No details provided.'}</p>
                </article>
              ))}
            </Motion.section>
          )}

          <section className="metrics-grid">
            <Motion.article
              className="panel metric"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06 }}
            >
              <WiHumidity />
              <p>Humidity</p>
              <h3>{weather.current.humidity}%</h3>
            </Motion.article>

            <Motion.article
              className="panel metric"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 }}
            >
              <WiBarometer />
              <p>Pressure</p>
              <h3>{Math.round(weather.current.pressure_mb)} mb</h3>
            </Motion.article>

            <Motion.article
              className="panel metric"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.18 }}
            >
              <WiStrongWind />
              <p>Gust</p>
              <h3>{Math.round(weather.current.gust_kph)} km/h</h3>
            </Motion.article>

            <Motion.article
              className="panel metric"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.24 }}
            >
              <FiCloudDrizzle />
              <p>Precipitation</p>
              <h3>{weather.current.precip_mm} mm</h3>
            </Motion.article>
          </section>

          <section className="two-column">
            <Motion.article
              className="panel chart-panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
            >
              <div className="panel-head">
                <h3>Next 24 Hours</h3>
                <p>Temperature curve and rain probability</p>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff8c42" stopOpacity={0.75} />
                        <stop offset="95%" stopColor="#ff8c42" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.14)" />
                    <XAxis dataKey="time" stroke="rgba(255,255,255,0.55)" tickLine={false} />
                    <YAxis
                      yAxisId="left"
                      stroke="rgba(255,255,255,0.55)"
                      tickLine={false}
                      width={36}
                    />
                    <YAxis yAxisId="right" orientation="right" hide domain={[0, 100]} />
                    <Tooltip
                      content={
                        <CustomChartTooltip unitLabel={unitLabel} />
                      }
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="temp"
                      stroke="#ffd27f"
                      fill="url(#tempGradient)"
                      strokeWidth={3}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="rain"
                      stroke="#79d7ff"
                      fill="rgba(121, 215, 255, 0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Motion.article>

            <Motion.article
              className="panel air-panel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
            >
              <h3>Air Quality and Visibility</h3>
              <p className="quality-value">US EPA Index: {epaIndex || '--'}</p>
              <p>{epaLabels[epaIndex] || 'No classification available'}</p>
              <div className="air-list">
                <div>
                  <span>PM2.5</span>
                  <strong>{Math.round(airQuality?.pm2_5 || 0)}</strong>
                </div>
                <div>
                  <span>PM10</span>
                  <strong>{Math.round(airQuality?.pm10 || 0)}</strong>
                </div>
                <div>
                  <span>CO</span>
                  <strong>{Math.round(airQuality?.co || 0)}</strong>
                </div>
                <div>
                  <span>Visibility</span>
                  <strong>{weather.current.vis_km} km</strong>
                </div>
              </div>
            </Motion.article>
          </section>

          <Motion.section
            className="panel forecast-panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.23 }}
          >
            <h3>3-Day Forecast</h3>
            <div className="forecast-list">
              {forecastDays.map((day) => (
                <article key={day.date_epoch} className="forecast-card">
                  <h4>{formatFriendlyDate(day.date)}</h4>
                  <img src={day.day.condition.icon} alt={day.day.condition.text} />
                  <p>{day.day.condition.text}</p>
                  <p className="range">
                    {Math.round(isCelsius ? day.day.mintemp_c : day.day.mintemp_f)} /{' '}
                    {Math.round(isCelsius ? day.day.maxtemp_c : day.day.maxtemp_f)}{unitLabel}
                  </p>
                  <p>Rain chance: {day.day.daily_chance_of_rain}%</p>
                </article>
              ))}
            </div>
          </Motion.section>

          <Motion.section
            className="panel astro-panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.27 }}
          >
            <h3>Sun and Moon</h3>
            <div className="astro-grid">
              <div>
                <FiSun />
                <span>Sunrise</span>
                <strong>{forecastDays[0]?.astro?.sunrise || '--'}</strong>
              </div>
              <div>
                <FiSun />
                <span>Sunset</span>
                <strong>{forecastDays[0]?.astro?.sunset || '--'}</strong>
              </div>
              <div>
                <FiMoon />
                <span>Moonrise</span>
                <strong>{forecastDays[0]?.astro?.moonrise || '--'}</strong>
              </div>
              <div>
                <FiMoon />
                <span>Moon phase</span>
                <strong>{forecastDays[0]?.astro?.moon_phase || '--'}</strong>
              </div>
            </div>
          </Motion.section>
        </main>
      )}

      <footer className="footer-note">
        Data source: WeatherAPI forecast, alerts, and air quality endpoints.
      </footer>
    </div>
  )
}

export default App


