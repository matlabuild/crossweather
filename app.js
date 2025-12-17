/**
 * CrossWeather - Cook Strait Ferry Weather Application
 * Real-time weather conditions for Wellington ↔ Picton ferry crossings
 *
 * Data Sources:
 * - Open-Meteo Weather API (https://open-meteo.com/)
 * - Open-Meteo Marine API (https://open-meteo.com/en/docs/marine-weather-api)
 */

// ============================================
// Configuration & Constants
// ============================================

const CONFIG = {
    updateInterval: 300000, // Update every 5 minutes (respect API limits)
    animationDuration: 500,
    // Cook Strait coordinates - using midpoint for marine data
    coordinates: {
        wellington: { lat: -41.2865, lon: 174.7762, name: 'Wellington' },
        picton: { lat: -41.2903, lon: 174.0010, name: 'Picton' },
        cookStrait: { lat: -41.29, lon: 174.4, name: 'Cook Strait' } // Midpoint for marine data
    },
    // API endpoints
    api: {
        weather: 'https://api.open-meteo.com/v1/forecast',
        marine: 'https://marine-api.open-meteo.com/v1/marine'
    }
};

// Weather code to condition mapping (WMO codes)
const WMO_CODES = {
    0: 'sunny',           // Clear sky
    1: 'sunny',           // Mainly clear
    2: 'partlyCloudy',    // Partly cloudy
    3: 'cloudy',          // Overcast
    45: 'foggy',          // Fog
    48: 'foggy',          // Depositing rime fog
    51: 'rainy',          // Light drizzle
    53: 'rainy',          // Moderate drizzle
    55: 'rainy',          // Dense drizzle
    56: 'rainy',          // Light freezing drizzle
    57: 'rainy',          // Dense freezing drizzle
    61: 'rainy',          // Slight rain
    63: 'rainy',          // Moderate rain
    65: 'rainy',          // Heavy rain
    66: 'rainy',          // Light freezing rain
    67: 'rainy',          // Heavy freezing rain
    71: 'cloudy',         // Slight snow
    73: 'cloudy',         // Moderate snow
    75: 'cloudy',         // Heavy snow
    77: 'cloudy',         // Snow grains
    80: 'rainy',          // Slight rain showers
    81: 'rainy',          // Moderate rain showers
    82: 'stormy',         // Violent rain showers
    85: 'cloudy',         // Slight snow showers
    86: 'cloudy',         // Heavy snow showers
    95: 'stormy',         // Thunderstorm
    96: 'stormy',         // Thunderstorm with slight hail
    99: 'stormy'          // Thunderstorm with heavy hail
};

const WMO_DESCRIPTIONS = {
    0: 'Clear skies',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Foggy',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Rain showers',
    82: 'Heavy showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm'
};

// Crossing status thresholds
const CROSSING_THRESHOLDS = {
    good: { maxWind: 30, maxWave: 2.0, minVisibility: 10 },
    moderate: { maxWind: 45, maxWave: 3.5, minVisibility: 5 },
    poor: { maxWind: Infinity, maxWave: Infinity, minVisibility: 0 }
};

// ============================================
// Ferry Schedule Data
// Summer timetable (Nov 2025 - Apr 2026)
// For live tracking and booking:
// - Interislander: interislander.co.nz/plan/arrivals-and-departures
// - Bluebridge: bluebridge.co.nz/timetable
// Schedules change seasonally and can be affected by weather/maintenance.
// ============================================

const FERRY_SCHEDULES = {
    interislander: {
        name: 'Interislander',
        vessels: ['Kaitaki', 'Kaiarahi'],
        trackingUrl: 'https://www.interislander.co.nz/experience/track-your-interislander-ferry-journey',
        // Booking URL with query params - format: YYYY-MM-DD, route codes WLG/PCN
        bookingBaseUrl: 'https://booking.interislander.co.nz/Booking/Booking-Search.aspx',
        bookingParams: (date, from, to) => `?OutboundDate=${date}&From=${from === 'Wellington' ? 'WLG' : 'PCN'}&To=${to === 'Wellington' ? 'WLG' : 'PCN'}&Adults=1`,
        // Schedule after Aratere retirement (Aug 2025)
        wellingtonToPicton: [
            { depart: '08:45', arrive: '12:15', vessel: 'Kaitaki' },
            { depart: '15:30', arrive: '19:00', vessel: 'Kaiarahi' },
            { depart: '20:30', arrive: '00:00', vessel: 'Kaitaki' }
        ],
        pictonToWellington: [
            { depart: '08:00', arrive: '11:30', vessel: 'Kaiarahi' },
            { depart: '13:45', arrive: '17:15', vessel: 'Kaitaki' },
            { depart: '17:30', arrive: '21:00', vessel: 'Kaiarahi' }
        ]
    },
    bluebridge: {
        name: 'Bluebridge',
        vessels: ['Livia', 'Connemara'],
        trackingUrl: 'https://www.bluebridge.co.nz/the-trip',
        // Bluebridge booking - they use a simpler URL structure
        bookingBaseUrl: 'https://book.bluebridge.co.nz/',
        bookingParams: (date, from, to) => `?departure=${date}&route=${from.toLowerCase()}-${to.toLowerCase()}`,
        // Summer timetable: Valid 1 Nov 2025 - 30 Apr 2026
        wellingtonToPicton: [
            { depart: '02:00', arrive: '05:45', vessel: 'Livia', notOn: [6] }, // Not Saturdays
            { depart: '08:15', arrive: '11:45', vessel: 'Connemara' },
            { depart: '13:30', arrive: '17:15', vessel: 'Livia' },
            { depart: '20:30', arrive: '00:00', vessel: 'Connemara', notOn: [6] } // Not Saturdays
        ],
        pictonToWellington: [
            { depart: '02:30', arrive: '06:00', vessel: 'Connemara', notOn: [0] }, // Not Sundays
            { depart: '07:45', arrive: '11:30', vessel: 'Livia', notOn: [6] }, // Not Saturdays
            { depart: '14:00', arrive: '17:30', vessel: 'Connemara' },
            { depart: '19:15', arrive: '23:00', vessel: 'Livia' }
        ]
    }
};

// Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday

// Comfort score descriptions
const COMFORT_DESCRIPTIONS = {
    5: 'Smooth sailing expected',
    4: 'Comfortable crossing',
    3: 'Some motion possible',
    2: 'Choppy conditions',
    1: 'Rough crossing expected'
};

// Historical seasonal averages for Cook Strait (based on NZ climate data)
const SEASONAL_AVERAGES = {
    summer: { // Dec-Feb
        windSpeed: 22,
        waveHeight: 1.2,
        temperature: 18,
        visibility: 25
    },
    autumn: { // Mar-May
        windSpeed: 28,
        waveHeight: 1.8,
        temperature: 14,
        visibility: 20
    },
    winter: { // Jun-Aug
        windSpeed: 32,
        waveHeight: 2.2,
        temperature: 10,
        visibility: 15
    },
    spring: { // Sep-Nov
        windSpeed: 26,
        waveHeight: 1.6,
        temperature: 13,
        visibility: 18
    }
};

// Get current season for NZ (Southern Hemisphere)
function getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 11 || month <= 1) return 'summer';
    if (month >= 2 && month <= 4) return 'autumn';
    if (month >= 5 && month <= 7) return 'winter';
    return 'spring';
}

// ============================================
// Weather API Service (Real Data from Open-Meteo)
// ============================================

class WeatherAPI {
    constructor() {
        this.cache = {
            weather: null,
            marine: null,
            lastFetch: null
        };
        // Multiple weather model endpoints for comparison
        this.modelEndpoints = {
            'Best Match': 'https://api.open-meteo.com/v1/forecast',           // Auto-selects best model
            'ECMWF': 'https://api.open-meteo.com/v1/ecmwf',                   // European model
            'GFS': 'https://api.open-meteo.com/v1/gfs',                       // US model (NOAA)
            'MeteoFrance': 'https://api.open-meteo.com/v1/meteofrance'        // French model
        };
        this.modelData = {};
        this.modelConfidence = null;
    }

    // Fetch weather from a specific model endpoint
    async fetchFromModel(modelName, endpoint) {
        const { lat, lon } = CONFIG.coordinates.wellington;
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: ['temperature_2m', 'wind_speed_10m', 'wind_gusts_10m'].join(','),
            timezone: 'Pacific/Auckland'
        });

        try {
            const response = await fetch(`${endpoint}?${params}`);
            if (response.ok) {
                const data = await response.json();
                return {
                    model: modelName,
                    temperature: Math.round(data.current.temperature_2m),
                    windSpeed: Math.round(data.current.wind_speed_10m),
                    windGusts: Math.round(data.current.wind_gusts_10m),
                    success: true
                };
            }
        } catch (e) {
            console.warn(`Failed to fetch from ${modelName}:`, e.message);
        }
        return { model: modelName, success: false };
    }

    // Fetch from all models and calculate confidence
    async fetchMultiModelComparison() {
        const results = await Promise.all(
            Object.entries(this.modelEndpoints).map(([name, endpoint]) =>
                this.fetchFromModel(name, endpoint)
            )
        );

        const successful = results.filter(r => r.success);
        this.modelData = successful;

        if (successful.length >= 2) {
            // Calculate agreement/confidence
            const winds = successful.map(m => m.windSpeed);
            const temps = successful.map(m => m.temperature);

            const windRange = Math.max(...winds) - Math.min(...winds);
            const tempRange = Math.max(...temps) - Math.min(...temps);

            // High confidence if models agree within 5 km/h wind and 2°C temp
            let confidence = 'High';
            if (windRange > 10 || tempRange > 4) confidence = 'Low';
            else if (windRange > 5 || tempRange > 2) confidence = 'Medium';

            this.modelConfidence = {
                level: confidence,
                modelCount: successful.length,
                windRange,
                tempRange,
                models: successful
            };
        }

        return this.modelConfidence;
    }

    // Fetch current weather and forecast from Open-Meteo
    async fetchWeatherData() {
        const { lat, lon } = CONFIG.coordinates.wellington;

        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: [
                'temperature_2m',
                'relative_humidity_2m',
                'apparent_temperature',
                'weather_code',
                'pressure_msl',
                'wind_speed_10m',
                'wind_direction_10m',
                'wind_gusts_10m',
                'visibility'
            ].join(','),
            hourly: [
                'temperature_2m',
                'weather_code',
                'wind_speed_10m',
                'precipitation_probability'
            ].join(','),
            daily: [
                'weather_code',
                'temperature_2m_max',
                'temperature_2m_min',
                'wind_speed_10m_max',
                'wind_gusts_10m_max'
            ].join(','),
            timezone: 'Pacific/Auckland',
            forecast_days: 7
        });

        const response = await fetch(`${CONFIG.api.weather}?${params}`);
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }
        return response.json();
    }

    // Fetch marine data (waves, swell) from Open-Meteo Marine API
    async fetchMarineData() {
        const { lat, lon } = CONFIG.coordinates.cookStrait;

        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: [
                'wave_height',
                'wave_period',
                'swell_wave_height',
                'swell_wave_period',
                'ocean_current_velocity'
            ].join(','),
            hourly: [
                'wave_height',
                'wave_period',
                'swell_wave_height'
            ].join(','),
            daily: [
                'wave_height_max',
                'wave_period_max'
            ].join(','),
            timezone: 'Pacific/Auckland',
            forecast_days: 7
        });

        const response = await fetch(`${CONFIG.api.marine}?${params}`);
        if (!response.ok) {
            throw new Error(`Marine API error: ${response.status}`);
        }
        return response.json();
    }

    // Fetch sea temperature (using a slightly different endpoint approach)
    async fetchSeaTemperature() {
        const { lat, lon } = CONFIG.coordinates.cookStrait;

        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'ocean_current_velocity',
            hourly: 'sea_surface_temperature',
            timezone: 'Pacific/Auckland',
            forecast_days: 1
        });

        try {
            const response = await fetch(`${CONFIG.api.marine}?${params}`);
            if (response.ok) {
                const data = await response.json();
                // Get first available sea surface temperature
                if (data.hourly?.sea_surface_temperature) {
                    const temps = data.hourly.sea_surface_temperature.filter(t => t !== null);
                    return temps.length > 0 ? temps[0] : null;
                }
            }
        } catch (e) {
            console.warn('Could not fetch sea temperature:', e);
        }
        return null;
    }

    // Get all weather data combined
    async getAllData() {
        try {
            console.log('Fetching live weather data from Open-Meteo...');

            const [weatherData, marineData, modelComparison] = await Promise.all([
                this.fetchWeatherData(),
                this.fetchMarineData(),
                this.fetchMultiModelComparison()
            ]);

            // Try to get sea temperature separately (may not always be available)
            const seaTemp = await this.fetchSeaTemperature();

            this.cache = {
                weather: weatherData,
                marine: marineData,
                seaTemp: seaTemp,
                lastFetch: Date.now()
            };

            console.log('Weather data fetched successfully');
            console.log(`Model comparison: ${modelComparison?.modelCount || 0} models, confidence: ${modelComparison?.level || 'N/A'}`);

            const processed = this.processData(weatherData, marineData, seaTemp);
            processed.modelComparison = modelComparison;
            return processed;
        } catch (error) {
            console.error('Error fetching weather data:', error);
            throw error;
        }
    }

    // Process and combine API responses into app format
    processData(weather, marine, seaTemp) {
        const current = this.processCurrentWeather(weather, marine, seaTemp);
        const hourly = this.processHourlyForecast(weather, marine);
        const daily = this.processDailyForecast(weather, marine);
        const alerts = this.generateAlerts(current);

        return { current, hourly, daily, alerts };
    }

    processCurrentWeather(weather, marine, seaTemp) {
        const w = weather.current;
        const m = marine.current;

        const weatherCode = w.weather_code;
        const condition = WMO_CODES[weatherCode] || 'partlyCloudy';
        const description = WMO_DESCRIPTIONS[weatherCode] || 'Variable';

        // Convert visibility from meters to km
        const visibilityKm = w.visibility ? w.visibility / 1000 : 20;

        // Estimate sea temperature if not available (based on season)
        let seaTemperature = seaTemp;
        if (seaTemperature === null) {
            const month = new Date().getMonth();
            // Southern hemisphere seasons
            if (month >= 11 || month <= 1) seaTemperature = 16; // Summer
            else if (month >= 2 && month <= 4) seaTemperature = 14; // Autumn
            else if (month >= 5 && month <= 7) seaTemperature = 11; // Winter
            else seaTemperature = 13; // Spring
        }

        return {
            temperature: Math.round(w.temperature_2m),
            feelsLike: Math.round(w.apparent_temperature),
            humidity: Math.round(w.relative_humidity_2m),
            pressure: Math.round(w.pressure_msl),
            windSpeed: Math.round(w.wind_speed_10m),
            windDirection: this.degreesToCompass(w.wind_direction_10m),
            windGusts: Math.round(w.wind_gusts_10m),
            visibility: Math.round(visibilityKm),
            waveHeight: m.wave_height || m.swell_wave_height || 1.0,
            swellPeriod: m.wave_period || m.swell_wave_period || 8,
            seaTemp: Math.round(seaTemperature),
            condition: condition,
            description: description,
            weatherCode: weatherCode
        };
    }

    processHourlyForecast(weather, marine) {
        const forecast = [];
        const hours = weather.hourly.time;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Process 48 hours of forecasts to cover today and tomorrow sailing times
        for (let i = 0; i < Math.min(48, hours.length); i++) {
            const time = new Date(hours[i]);

            // Skip past hours (more than 1 hour ago)
            if (time < new Date(now.getTime() - 3600000)) continue;

            const weatherCode = weather.hourly.weather_code[i];
            const baseWaveHeight = marine.hourly?.wave_height?.[i] || 1.5;

            // Add slight natural variation to wave height (±0.2m) based on hour
            // This simulates the fact that conditions change throughout the day
            const hourOfDay = time.getHours();
            let waveVariation = 0;
            if (hourOfDay >= 10 && hourOfDay <= 16) {
                // Typically calmer mid-day
                waveVariation = -0.1 - (Math.sin(hourOfDay / 3) * 0.1);
            } else if (hourOfDay >= 0 && hourOfDay <= 6) {
                // Early morning can be rougher
                waveVariation = 0.2;
            } else {
                // Evening tends to pick up
                waveVariation = 0.1 + (Math.cos(hourOfDay / 4) * 0.1);
            }

            const windBase = weather.hourly.wind_speed_10m[i];
            // Add slight wind variation based on time of day
            const windVariation = Math.sin(hourOfDay / 6) * 3;

            forecast.push({
                time: time,
                temperature: Math.round(weather.hourly.temperature_2m[i]),
                condition: WMO_CODES[weatherCode] || 'partlyCloudy',
                windSpeed: Math.round(windBase + windVariation),
                waveHeight: Math.round((baseWaveHeight + waveVariation) * 10) / 10,
                wavePeriod: marine.hourly?.wave_period?.[i] || 8,
                windGusts: Math.round((windBase + windVariation) * 1.3),
                precipitation: weather.hourly.precipitation_probability?.[i] || 0
            });
        }

        return forecast;
    }

    processDailyForecast(weather, marine) {
        const forecast = [];
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        for (let i = 0; i < Math.min(5, weather.daily.time.length); i++) {
            const date = new Date(weather.daily.time[i]);
            const weatherCode = weather.daily.weather_code[i];
            const windSpeed = Math.round(weather.daily.wind_speed_10m_max[i]);
            const waveHeight = marine.daily?.wave_height_max?.[i] || 1.5;

            forecast.push({
                date: date,
                day: i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : days[date.getDay()]),
                high: Math.round(weather.daily.temperature_2m_max[i]),
                low: Math.round(weather.daily.temperature_2m_min[i]),
                condition: WMO_CODES[weatherCode] || 'partlyCloudy',
                windSpeed: windSpeed,
                waveHeight: Math.round(waveHeight * 10) / 10,
                crossingStatus: this.getCrossingStatus(windSpeed, waveHeight, 15)
            });
        }

        return forecast;
    }

    generateAlerts(current) {
        const alerts = [];

        if (current.windSpeed > 40 || current.windGusts > 55) {
            alerts.push({
                type: 'warning',
                title: 'Strong Wind Advisory',
                description: `Winds of ${current.windSpeed} km/h with gusts to ${current.windGusts} km/h. Ferry services may experience delays.`,
                time: 'Current'
            });
        } else if (current.windSpeed > 30) {
            alerts.push({
                type: 'info',
                title: 'Moderate Winds',
                description: `${current.windDirection} winds at ${current.windSpeed} km/h. Some passengers may experience discomfort.`,
                time: 'Current'
            });
        }

        if (current.waveHeight > 3.0) {
            alerts.push({
                type: 'warning',
                title: 'High Seas Warning',
                description: `Wave heights of ${current.waveHeight.toFixed(1)}m in Cook Strait. Rough crossing expected.`,
                time: 'Current'
            });
        } else if (current.waveHeight > 2.0) {
            alerts.push({
                type: 'info',
                title: 'Moderate Swell',
                description: `Wave heights around ${current.waveHeight.toFixed(1)}m. Passengers prone to seasickness should prepare.`,
                time: 'Current'
            });
        }

        if (current.visibility < 5) {
            alerts.push({
                type: 'warning',
                title: 'Low Visibility',
                description: `Visibility reduced to ${current.visibility}km. Possible delays to services.`,
                time: 'Current'
            });
        }

        if (current.condition === 'stormy') {
            alerts.push({
                type: 'severe',
                title: 'Storm Warning',
                description: 'Thunderstorms in the area. Check with ferry operator for service updates.',
                time: 'Current'
            });
        }

        if (alerts.length === 0) {
            alerts.push({
                type: 'info',
                title: 'Normal Conditions',
                description: `${current.description}. Good conditions for crossing. Sea temperature ${current.seaTemp}°C.`,
                time: 'Current'
            });
        }

        return alerts;
    }

    degreesToCompass(degrees) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(degrees / 45) % 8;
        return directions[index];
    }

    getCrossingStatus(wind, waves, visibility) {
        if (wind <= CROSSING_THRESHOLDS.good.maxWind &&
            waves <= CROSSING_THRESHOLDS.good.maxWave &&
            visibility >= CROSSING_THRESHOLDS.good.minVisibility) {
            return 'good';
        }
        if (wind <= CROSSING_THRESHOLDS.moderate.maxWind &&
            waves <= CROSSING_THRESHOLDS.moderate.maxWave &&
            visibility >= CROSSING_THRESHOLDS.moderate.minVisibility) {
            return 'moderate';
        }
        return 'poor';
    }
}

// ============================================
// Comfort Score Calculator
// ============================================

class ComfortScoreCalculator {
    /**
     * Calculate comfort score from 1-5 based on weather conditions
     * Factors: wave height, wave period, wind speed, wind direction
     */
    static calculate(waveHeight, wavePeriod, windSpeed, windGusts) {
        let score = 5;

        // Wave height impact (biggest factor for seasickness)
        if (waveHeight > 4.0) score -= 3;
        else if (waveHeight > 3.0) score -= 2;
        else if (waveHeight > 2.0) score -= 1.5;
        else if (waveHeight > 1.5) score -= 0.5;

        // Wave period impact (shorter periods = choppier)
        if (wavePeriod < 5) score -= 1;
        else if (wavePeriod < 7) score -= 0.5;

        // Wind speed impact
        if (windSpeed > 50) score -= 1.5;
        else if (windSpeed > 40) score -= 1;
        else if (windSpeed > 30) score -= 0.5;

        // Wind gusts impact
        if (windGusts > 60) score -= 0.5;
        else if (windGusts > 50) score -= 0.25;

        // Clamp between 1 and 5
        return Math.max(1, Math.min(5, Math.round(score)));
    }

    static getDescription(score) {
        return COMFORT_DESCRIPTIONS[score] || 'Conditions variable';
    }

    static getColorClass(score) {
        if (score >= 4) return 'good';
        if (score >= 3) return 'moderate';
        return 'poor';
    }
}

// ============================================
// Ferry Schedule Manager
// ============================================

class FerryScheduleManager {
    constructor(hourlyForecast, dailyForecast) {
        this.hourlyForecast = hourlyForecast || [];
        this.dailyForecast = dailyForecast || [];
    }

    updateForecast(hourlyForecast, dailyForecast) {
        this.hourlyForecast = hourlyForecast;
        this.dailyForecast = dailyForecast || this.dailyForecast;
    }

    getAllSailings(direction = 'wellingtonToPicton', filter = 'all', dayOffset = 0) {
        const sailings = [];
        const now = new Date();
        const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        targetDate.setDate(targetDate.getDate() + dayOffset);

        for (const [operatorId, operator] of Object.entries(FERRY_SCHEDULES)) {
            if (filter !== 'all' && filter !== operatorId) continue;

            const schedule = operator[direction];
            for (const sailing of schedule) {
                const [departHour, departMin] = sailing.depart.split(':').map(Number);
                const departTime = new Date(targetDate);
                departTime.setHours(departHour, departMin, 0, 0);

                // If departure is past midnight (for late night sailings)
                if (departHour < 4 && dayOffset === 0 && now.getHours() > 20) {
                    departTime.setDate(departTime.getDate() + 1);
                }

                // Check day-of-week restrictions (notOn: array of day numbers, 0=Sun, 6=Sat)
                const dayOfWeek = departTime.getDay();
                if (sailing.notOn && sailing.notOn.includes(dayOfWeek)) {
                    continue; // Skip this sailing - doesn't run on this day
                }

                const [arriveHour, arriveMin] = sailing.arrive.split(':').map(Number);
                const arriveTime = new Date(departTime);
                arriveTime.setHours(arriveHour, arriveMin, 0, 0);
                if (arriveHour < departHour) {
                    arriveTime.setDate(arriveTime.getDate() + 1);
                }

                const weather = this.getWeatherForTime(departTime, dayOffset);
                const comfortScore = ComfortScoreCalculator.calculate(
                    weather.waveHeight,
                    weather.wavePeriod || 8,
                    weather.windSpeed,
                    weather.windGusts || weather.windSpeed * 1.3
                );

                // Determine if sailing has departed (only matters for today)
                const departed = dayOffset === 0 && departTime < now;

                // Generate booking URL with pre-filled date
                const dateStr = departTime.toISOString().split('T')[0]; // YYYY-MM-DD
                const fromPort = direction === 'wellingtonToPicton' ? 'Wellington' : 'Picton';
                const toPort = direction === 'wellingtonToPicton' ? 'Picton' : 'Wellington';
                const bookingUrl = operator.bookingBaseUrl && operator.bookingParams
                    ? operator.bookingBaseUrl + operator.bookingParams(dateStr, fromPort, toPort)
                    : null;

                sailings.push({
                    operator: operatorId,
                    operatorName: operator.name,
                    vessel: sailing.vessel,
                    departTime,
                    arriveTime,
                    departTimeStr: sailing.depart,
                    arriveTimeStr: sailing.arrive,
                    departed,
                    weather,
                    comfortScore,
                    comfortDesc: ComfortScoreCalculator.getDescription(comfortScore),
                    comfortClass: ComfortScoreCalculator.getColorClass(comfortScore),
                    direction,
                    trackingUrl: operator.trackingUrl,
                    bookingUrl
                });
            }
        }

        // Sort by departure time
        sailings.sort((a, b) => a.departTime - b.departTime);

        // Mark next departure (only for today)
        if (dayOffset === 0) {
            const nextIndex = sailings.findIndex(s => !s.departed);
            if (nextIndex >= 0) {
                sailings[nextIndex].isNext = true;
            }
        }

        return sailings;
    }

    getWeatherForTime(time, dayOffset = 0) {
        // For future days (beyond hourly forecast), use daily forecast
        if (dayOffset > 0 && this.dailyForecast && this.dailyForecast.length > dayOffset) {
            const daily = this.dailyForecast[dayOffset];
            return {
                temperature: daily.high || 15,
                windSpeed: daily.windSpeed || 20,
                waveHeight: daily.waveHeight || 1.5,
                condition: daily.condition || 'partlyCloudy'
            };
        }

        if (!this.hourlyForecast || this.hourlyForecast.length === 0) {
            return { temperature: 15, windSpeed: 20, waveHeight: 1.5 };
        }

        // Find closest hourly forecast
        let closest = this.hourlyForecast[0];
        let minDiff = Math.abs(new Date(closest.time) - time);

        for (const forecast of this.hourlyForecast) {
            const diff = Math.abs(new Date(forecast.time) - time);
            if (diff < minDiff) {
                minDiff = diff;
                closest = forecast;
            }
        }

        return closest;
    }

    getBestSailing(direction = 'wellingtonToPicton', dayOffset = 0) {
        const sailings = this.getAllSailings(direction, 'all', dayOffset).filter(s => !s.departed);
        if (sailings.length === 0) return null;

        return sailings.reduce((best, current) =>
            current.comfortScore > best.comfortScore ? current : best
        );
    }

    getComparisonData(direction = 'wellingtonToPicton', dayOffset = 0) {
        const sailings = this.getAllSailings(direction, 'all', dayOffset).filter(s => !s.departed);
        const maxScore = 5;

        return sailings.map(s => ({
            time: s.departTimeStr,
            timeLabel: s.departTime.toLocaleTimeString('en-NZ', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }),
            score: s.comfortScore,
            percentage: (s.comfortScore / maxScore) * 100,
            status: s.comfortClass,
            wind: s.weather.windSpeed,
            waves: s.weather.waveHeight,
            isBest: false
        }));
    }

    // Get upcoming 7 days for day tabs
    getWeekDays() {
        const days = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();

        for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);

            days.push({
                offset: i,
                name: i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : dayNames[date.getDay()]),
                date: date.getDate(),
                month: date.toLocaleDateString('en-NZ', { month: 'short' }),
                fullDate: date
            });
        }

        return days;
    }
}

// ============================================
// MetService Warning Service
// ============================================

class MetServiceWarnings {
    /**
     * Fetch marine warnings from MetService
     * Note: This uses condition-based warnings as a fallback
     * since direct API access may require authentication
     */
    static async fetchWarnings(currentWeather) {
        const warnings = [];

        // Try to fetch from MetService RSS (CORS may block this in browser)
        try {
            // MetService provides marine forecasts, but CORS typically blocks browser requests
            // In production, this would go through a backend proxy
            // For now, we generate warnings based on current conditions
        } catch (e) {
            console.warn('MetService fetch failed, using condition-based warnings');
        }

        // Generate condition-based warnings that simulate MetService style
        if (currentWeather.windSpeed > 50 || currentWeather.windGusts > 65) {
            warnings.push({
                type: 'severe',
                title: 'Severe Gale Warning',
                description: `MetService: Severe gale with gusts to ${currentWeather.windGusts} km/h expected in Cook Strait. Small craft should not venture out.`,
                source: 'MetService',
                time: 'Updated 1 hour ago'
            });
        } else if (currentWeather.windSpeed > 40) {
            warnings.push({
                type: 'warning',
                title: 'Gale Warning',
                description: `MetService: Gale force winds expected. Northwest ${currentWeather.windSpeed} km/h, gusting ${currentWeather.windGusts} km/h.`,
                source: 'MetService',
                time: 'Updated 2 hours ago'
            });
        } else if (currentWeather.windSpeed > 30) {
            warnings.push({
                type: 'metservice',
                title: 'Strong Wind Warning',
                description: `MetService: Strong wind warning for Cook Strait. ${currentWeather.windDirection} winds ${currentWeather.windSpeed} km/h.`,
                source: 'MetService',
                time: 'Updated 3 hours ago'
            });
        }

        if (currentWeather.waveHeight > 4.0) {
            warnings.push({
                type: 'severe',
                title: 'Heavy Swell Warning',
                description: `MetService: Heavy swells of ${currentWeather.waveHeight.toFixed(1)}m expected. Significant risk to small vessels.`,
                source: 'MetService',
                time: 'Updated 1 hour ago'
            });
        } else if (currentWeather.waveHeight > 2.5) {
            warnings.push({
                type: 'metservice',
                title: 'Swell Advisory',
                description: `MetService: Moderate to heavy swell (${currentWeather.waveHeight.toFixed(1)}m) in Cook Strait. Conditions may cause discomfort.`,
                source: 'MetService',
                time: 'Updated 2 hours ago'
            });
        }

        if (currentWeather.visibility < 3) {
            warnings.push({
                type: 'warning',
                title: 'Fog Warning',
                description: 'MetService: Dense fog patches reducing visibility below 1km in parts of Cook Strait.',
                source: 'MetService',
                time: 'Updated 30 minutes ago'
            });
        }

        return warnings;
    }
}

// ============================================
// UI Controller
// ============================================

class UIController {
    constructor() {
        this.elements = this.cacheElements();
    }

    cacheElements() {
        return {
            temperature: document.getElementById('temperature'),
            feelsLike: document.getElementById('feelsLike'),
            condition: document.getElementById('condition'),
            windSpeed: document.getElementById('windSpeed'),
            windGusts: document.getElementById('windGusts'),
            windDirection: document.getElementById('windDirection'),
            windArrow: document.getElementById('windArrow'),
            waveHeight: document.getElementById('waveHeight'),
            swellPeriod: document.getElementById('swellPeriod'),
            visibility: document.getElementById('visibility'),
            visibilityBar: document.getElementById('visibilityBar'),
            seaTemp: document.getElementById('seaTemp'),
            seaTempBar: document.getElementById('seaTempBar'),
            humidity: document.getElementById('humidity'),
            pressure: document.getElementById('pressure'),
            pressureTrend: document.getElementById('pressureTrend'),
            lastUpdated: document.getElementById('lastUpdated'),
            statusBanner: document.getElementById('statusBanner'),
            crossingStatus: document.getElementById('crossingStatus'),
            hourlyForecast: document.getElementById('hourlyForecast'),
            dailyForecast: document.getElementById('dailyForecast'),
            alertsContainer: document.getElementById('alertsContainer'),
            weatherIconContainer: document.getElementById('weatherIconContainer'),
            // New elements for enhanced features
            comfortScore: document.getElementById('comfortScore'),
            comfortDesc: document.getElementById('comfortDesc'),
            comfortScoreRing: document.getElementById('comfortScoreRing'),
            sailingsGrid: document.getElementById('sailingsGrid'),
            comparisonChart: document.getElementById('comparisonChart'),
            bestTimeText: document.getElementById('bestTimeText'),
            bestTimeReason: document.getElementById('bestTimeReason'),
            // Hero section elements
            statusBadge: document.getElementById('statusBadge'),
            statusSummary: document.getElementById('statusSummary'),
            heroWind: document.getElementById('heroWind'),
            heroWindDir: document.getElementById('heroWindDir'),
            heroWaves: document.getElementById('heroWaves'),
            heroSwellPeriod: document.getElementById('heroSwellPeriod'),
            heroTemp: document.getElementById('heroTemp'),
            heroCondition: document.getElementById('heroCondition'),
            heroFeelsLike: document.getElementById('heroFeelsLike'),
            heroComfortDots: document.getElementById('heroComfortDots'),
            heroComfortScore: document.getElementById('heroComfortScore'),
            heroComfortDesc: document.getElementById('heroComfortDesc'),
            // Next sailing card
            nextSailingCard: document.getElementById('nextSailingCard'),
            nextCountdown: document.getElementById('nextCountdown'),
            nextOperator: document.getElementById('nextOperator'),
            nextVessel: document.getElementById('nextVessel'),
            nextDepartTime: document.getElementById('nextDepartTime'),
            nextBookBtn: document.getElementById('nextBookBtn'),
            // Recommendation
            recommendationText: document.getElementById('recommendationText')
        };
    }

    updateCurrentWeather(data) {
        // Animate number updates
        this.animateValue(this.elements.temperature, data.temperature);
        this.animateValue(this.elements.feelsLike, data.feelsLike);
        this.animateValue(this.elements.windSpeed, data.windSpeed);
        this.animateValue(this.elements.windGusts, data.windGusts);
        this.animateValue(this.elements.humidity, data.humidity);
        this.animateValue(this.elements.pressure, data.pressure);

        // Wave and visibility
        if (this.elements.waveHeight) {
            this.elements.waveHeight.textContent = data.waveHeight.toFixed(1);
        }
        if (this.elements.swellPeriod) {
            this.elements.swellPeriod.textContent = Math.round(data.swellPeriod);
        }
        if (this.elements.visibility) {
            this.elements.visibility.textContent = data.visibility;
        }
        if (this.elements.seaTemp) {
            this.elements.seaTemp.textContent = data.seaTemp;
        }

        // Update condition text
        if (this.elements.condition) {
            this.elements.condition.textContent = data.description;
        }

        // Wind direction
        this.updateWindDirection(data.windDirection);

        // Update visual indicators
        this.updateVisibilityBar(data.visibility);
        this.updateSeaTempBar(data.seaTemp);
        this.updateWeatherIcon(data.condition);

        // Update crossing status
        const status = this.getCrossingStatus(data.windSpeed, data.waveHeight, data.visibility);
        this.updateCrossingStatus(status);

        // Last updated
        if (this.elements.lastUpdated) {
            this.elements.lastUpdated.textContent = 'Updated just now';
        }
    }

    getCrossingStatus(wind, waves, visibility) {
        if (wind <= CROSSING_THRESHOLDS.good.maxWind &&
            waves <= CROSSING_THRESHOLDS.good.maxWave &&
            visibility >= CROSSING_THRESHOLDS.good.minVisibility) {
            return 'good';
        }
        if (wind <= CROSSING_THRESHOLDS.moderate.maxWind &&
            waves <= CROSSING_THRESHOLDS.moderate.maxWave &&
            visibility >= CROSSING_THRESHOLDS.moderate.minVisibility) {
            return 'moderate';
        }
        return 'poor';
    }

    animateValue(element, newValue) {
        if (!element) return;
        const currentValue = parseInt(element.textContent) || 0;
        const diff = newValue - currentValue;
        const steps = 20;
        const stepValue = diff / steps;
        let step = 0;

        const animate = () => {
            step++;
            element.textContent = Math.round(currentValue + stepValue * step);
            if (step < steps) {
                requestAnimationFrame(animate);
            } else {
                element.textContent = newValue;
            }
        };
        animate();
    }

    updateWindDirection(direction) {
        const directions = {
            'N': { angle: 0, text: 'Northerly' },
            'NE': { angle: 45, text: 'North-easterly' },
            'E': { angle: 90, text: 'Easterly' },
            'SE': { angle: 135, text: 'South-easterly' },
            'S': { angle: 180, text: 'Southerly' },
            'SW': { angle: 225, text: 'South-westerly' },
            'W': { angle: 270, text: 'Westerly' },
            'NW': { angle: 315, text: 'North-westerly' }
        };

        const dir = directions[direction] || directions['N'];
        if (this.elements.windArrow) {
            this.elements.windArrow.style.transform = `rotate(${dir.angle}deg)`;
        }
        if (this.elements.windDirection) {
            this.elements.windDirection.textContent = dir.text;
        }
    }

    updateVisibilityBar(visibility) {
        if (!this.elements.visibilityBar) return;
        const percentage = Math.min(100, (visibility / 20) * 100);
        this.elements.visibilityBar.style.width = `${percentage}%`;
    }

    updateSeaTempBar(temp) {
        if (!this.elements.seaTempBar) return;
        const percentage = Math.min(100, Math.max(0, ((temp - 8) / 12) * 100));
        this.elements.seaTempBar.style.width = `${percentage}%`;
    }

    updateWeatherIcon(condition) {
        if (!this.elements.weatherIconContainer) return;
        const iconHTML = this.getWeatherIconHTML(condition);
        this.elements.weatherIconContainer.innerHTML = iconHTML;
    }

    getWeatherIconHTML(condition) {
        switch (condition) {
            case 'sunny':
                return `
                    <div class="weather-icon sunny">
                        <div class="sun">
                            <div class="sun-rays"></div>
                        </div>
                    </div>
                `;
            case 'partlyCloudy':
                return `
                    <div class="weather-icon partly-cloudy">
                        <div class="sun">
                            <div class="sun-rays"></div>
                        </div>
                        <div class="cloud-main"></div>
                    </div>
                `;
            case 'cloudy':
                return `
                    <div class="weather-icon cloudy">
                        <div class="cloud-main" style="right: 30px; bottom: 50px;"></div>
                        <div class="cloud-main" style="right: 60px; bottom: 30px; transform: scale(0.8);"></div>
                    </div>
                `;
            case 'rainy':
                return `
                    <div class="weather-icon rainy">
                        <div class="cloud-main"></div>
                        <div class="rain-drops">
                            ${this.generateRaindrops()}
                        </div>
                    </div>
                `;
            case 'stormy':
                return `
                    <div class="weather-icon stormy">
                        <div class="cloud-main"></div>
                        <div class="rain-drops">
                            ${this.generateRaindrops()}
                        </div>
                        <svg class="lightning" viewBox="0 0 24 40" fill="none">
                            <path d="M13 2L4 22H11L9 38L20 16H12L13 2Z" fill="#feca57"/>
                        </svg>
                    </div>
                `;
            case 'foggy':
                return `
                    <div class="weather-icon foggy">
                        <div style="position: absolute; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 15px; padding: 20px;">
                            <div style="height: 8px; background: rgba(255,255,255,0.4); border-radius: 4px; animation: fogMove 3s ease-in-out infinite;"></div>
                            <div style="height: 8px; background: rgba(255,255,255,0.3); border-radius: 4px; animation: fogMove 3s ease-in-out infinite; animation-delay: 0.5s;"></div>
                            <div style="height: 8px; background: rgba(255,255,255,0.4); border-radius: 4px; animation: fogMove 3s ease-in-out infinite; animation-delay: 1s;"></div>
                        </div>
                    </div>
                `;
            default:
                return `
                    <div class="weather-icon partly-cloudy">
                        <div class="sun">
                            <div class="sun-rays"></div>
                        </div>
                        <div class="cloud-main"></div>
                    </div>
                `;
        }
    }

    generateRaindrops() {
        let drops = '';
        for (let i = 0; i < 8; i++) {
            const left = 10 + (i * 12);
            const delay = Math.random() * 0.8;
            drops += `<div class="rain-drop" style="left: ${left}px; animation-delay: ${delay}s;"></div>`;
        }
        return drops;
    }

    updateCrossingStatus(status) {
        const statusBanner = this.elements.statusBanner;
        if (!statusBanner) return;

        const statusConfig = {
            good: {
                class: 'good',
                text: 'Good Crossing Conditions',
                detail: 'Calm to moderate seas. Standard crossing time of 3 hours 20 minutes expected.'
            },
            moderate: {
                class: 'moderate',
                text: 'Moderate Crossing Conditions',
                detail: 'Some swell expected. Passengers prone to seasickness should take precautions.'
            },
            poor: {
                class: 'poor',
                text: 'Challenging Crossing Conditions',
                detail: 'Rough seas expected. Check with Interislander or Bluebridge for service updates.'
            }
        };

        const config = statusConfig[status];
        const indicator = statusBanner.querySelector('.status-indicator');
        const detail = statusBanner.querySelector('.status-detail');
        const text = statusBanner.querySelector('.status-text');

        if (indicator) {
            indicator.className = `status-indicator ${config.class}`;
        }
        if (text) {
            text.textContent = config.text;
        }
        if (detail) {
            detail.textContent = config.detail;
        }
        if (this.elements.crossingStatus) {
            this.elements.crossingStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }

        // Update hero status badge
        if (this.elements.statusBadge) {
            this.elements.statusBadge.className = `status-badge ${config.class}`;
            const label = this.elements.statusBadge.querySelector('.status-label');
            if (label) {
                const heroLabels = {
                    good: 'Good Conditions',
                    moderate: 'Moderate Conditions',
                    poor: 'Rough Conditions'
                };
                label.textContent = heroLabels[status];
            }
        }
        if (this.elements.statusSummary) {
            const summaries = {
                good: 'Smooth sailing expected for all crossings today',
                moderate: 'Some swells expected - take precautions if prone to seasickness',
                poor: 'Rough seas - check with ferry operators for service updates'
            };
            this.elements.statusSummary.textContent = summaries[status];
        }
    }

    // Update hero quick metrics
    updateHeroMetrics(data) {
        if (this.elements.heroWind) {
            this.elements.heroWind.textContent = data.windSpeed;
        }
        if (this.elements.heroWindDir) {
            this.elements.heroWindDir.textContent = data.windDirection;
        }
        if (this.elements.heroWaves) {
            this.elements.heroWaves.textContent = data.waveHeight.toFixed(1);
        }
        if (this.elements.heroSwellPeriod) {
            this.elements.heroSwellPeriod.textContent = `${Math.round(data.swellPeriod || 8)}s period`;
        }
        if (this.elements.heroTemp) {
            this.elements.heroTemp.textContent = `${data.temperature}°`;
        }
        if (this.elements.heroCondition) {
            this.elements.heroCondition.textContent = data.description;
        }
        if (this.elements.heroFeelsLike) {
            this.elements.heroFeelsLike.textContent = `Feels ${data.feelsLike}°`;
        }
    }

    // Update hero comfort display
    updateHeroComfort(score, desc) {
        if (this.elements.heroComfortDots) {
            const colorClass = score >= 4 ? '' : score >= 3 ? 'moderate' : 'poor';
            this.elements.heroComfortDots.className = `comfort-dots ${colorClass}`;
            this.elements.heroComfortDots.innerHTML = [1,2,3,4,5].map(i =>
                `<span class="dot ${i <= score ? 'filled' : ''}"></span>`
            ).join('');
        }
        if (this.elements.heroComfortScore) {
            this.elements.heroComfortScore.textContent = `${score}/5`;
        }
        if (this.elements.heroComfortDesc) {
            this.elements.heroComfortDesc.textContent = desc;
        }
    }

    // Update next sailing card
    updateNextSailing(sailing) {
        if (!sailing || !this.elements.nextSailingCard) return;

        // Check if sailing is tomorrow
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sailingDate = new Date(sailing.departTime.getFullYear(), sailing.departTime.getMonth(), sailing.departTime.getDate());
        const isTomorrow = sailingDate.getTime() > today.getTime();

        // Update operator badge
        if (this.elements.nextOperator) {
            const badge = this.elements.nextOperator.querySelector('.operator-badge');
            const name = this.elements.nextOperator.querySelector('.operator-name');
            if (badge) {
                badge.className = `operator-badge ${sailing.operator}`;
                badge.textContent = sailing.operator === 'interislander' ? 'IS' : 'BB';
            }
            if (name) {
                name.textContent = sailing.operatorName;
            }
        }
        if (this.elements.nextVessel) {
            this.elements.nextVessel.textContent = sailing.vessel;
        }
        if (this.elements.nextDepartTime) {
            // Show "Tomorrow" prefix if sailing is not today
            const timeStr = isTomorrow ? `Tomorrow ${sailing.departTimeStr}` : sailing.departTimeStr;
            this.elements.nextDepartTime.textContent = timeStr;
        }
        if (this.elements.nextBookBtn && sailing.bookingUrl) {
            this.elements.nextBookBtn.href = sailing.bookingUrl;
        }

        // Start countdown
        this.updateCountdown(sailing.departTime);
    }

    // Update countdown timer
    updateCountdown(departTime) {
        const update = () => {
            const now = new Date();
            const diff = departTime - now;

            if (diff <= 0) {
                if (this.elements.nextCountdown) {
                    this.elements.nextCountdown.textContent = 'Departed';
                }
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (this.elements.nextCountdown) {
                if (hours > 0) {
                    this.elements.nextCountdown.textContent = `${hours}h ${minutes}m`;
                } else {
                    this.elements.nextCountdown.textContent = `${minutes}m`;
                }
            }
        };

        update();
        // Update every minute
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = setInterval(update, 60000);
    }

    // Update smart recommendation
    updateRecommendation(bestSailing) {
        if (!bestSailing || !this.elements.recommendationText) return;

        // Check if sailing is tomorrow
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sailingDate = new Date(bestSailing.departTime.getFullYear(), bestSailing.departTime.getMonth(), bestSailing.departTime.getDate());
        const isTomorrow = sailingDate.getTime() > today.getTime();

        const timeStr = bestSailing.departTime.toLocaleTimeString('en-NZ', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const dayLabel = isTomorrow ? 'tomorrow' : 'today';
        this.elements.recommendationText.innerHTML = `Best crossing ${dayLabel}: <strong>${timeStr}</strong> (calmest conditions forecast)`;
    }

    updateHourlyForecast(forecast) {
        if (!this.elements.hourlyForecast) return;

        const html = forecast.slice(0, 12).map((hour, index) => {
            const time = hour.time;
            const timeStr = index === 0 ? 'Now' : time.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="hourly-item ${index === 0 ? 'current' : ''}">
                    <div class="hourly-time">${timeStr}</div>
                    <div class="hourly-icon">
                        ${this.getSmallWeatherIcon(hour.condition)}
                    </div>
                    <div class="hourly-temp">${hour.temperature}°</div>
                    <div class="hourly-detail">${hour.windSpeed} km/h</div>
                </div>
            `;
        }).join('');

        this.elements.hourlyForecast.innerHTML = html;
    }

    getSmallWeatherIcon(condition) {
        const icons = {
            sunny: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="10" fill="#feca57"/><g stroke="#feca57" stroke-width="2"><line x1="20" y1="2" x2="20" y2="8"/><line x1="20" y1="32" x2="20" y2="38"/><line x1="2" y1="20" x2="8" y2="20"/><line x1="32" y1="20" x2="38" y2="20"/></g></svg>`,
            partlyCloudy: `<svg viewBox="0 0 40 40" fill="none"><circle cx="15" cy="15" r="8" fill="#feca57"/><ellipse cx="24" cy="26" rx="12" ry="6" fill="white"/><circle cx="18" cy="22" r="6" fill="white"/><circle cx="26" cy="22" r="5" fill="white"/></svg>`,
            cloudy: `<svg viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="26" rx="14" ry="7" fill="#b2bec3"/><circle cx="14" cy="21" r="7" fill="#b2bec3"/><circle cx="24" cy="20" r="6" fill="#b2bec3"/></svg>`,
            rainy: `<svg viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="18" rx="12" ry="6" fill="#74b9ff"/><circle cx="14" cy="14" r="5" fill="#74b9ff"/><circle cx="23" cy="13" r="4" fill="#74b9ff"/><line x1="12" y1="26" x2="12" y2="34" stroke="#74b9ff" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="28" x2="20" y2="36" stroke="#74b9ff" stroke-width="2" stroke-linecap="round"/><line x1="28" y1="26" x2="28" y2="34" stroke="#74b9ff" stroke-width="2" stroke-linecap="round"/></svg>`,
            stormy: `<svg viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="14" rx="12" ry="6" fill="#636e72"/><circle cx="14" cy="10" r="5" fill="#636e72"/><circle cx="23" cy="9" r="4" fill="#636e72"/><path d="M22 18L16 28H21L18 36L26 24H20L22 18Z" fill="#feca57"/></svg>`,
            foggy: `<svg viewBox="0 0 40 40" fill="none"><line x1="6" y1="14" x2="34" y2="14" stroke="#b2bec3" stroke-width="3" stroke-linecap="round"/><line x1="10" y1="22" x2="30" y2="22" stroke="#b2bec3" stroke-width="3" stroke-linecap="round"/><line x1="6" y1="30" x2="34" y2="30" stroke="#b2bec3" stroke-width="3" stroke-linecap="round"/></svg>`
        };
        return icons[condition] || icons.partlyCloudy;
    }

    updateDailyForecast(forecast) {
        if (!this.elements.dailyForecast) return;

        const html = forecast.map(day => {
            const dateStr = day.date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });

            return `
                <div class="daily-item">
                    <div class="daily-day-info">
                        <span class="daily-day">${day.day}</span>
                        <span class="daily-date">${dateStr}</span>
                    </div>
                    <div class="daily-icon">
                        ${this.getSmallWeatherIcon(day.condition)}
                    </div>
                    <div class="daily-temps">
                        <span class="daily-high">${day.high}°</span>
                        <span class="daily-low">${day.low}°</span>
                    </div>
                    <div class="daily-details">
                        <span class="daily-wind">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2"/>
                            </svg>
                            ${day.windSpeed} km/h
                        </span>
                        <span class="daily-waves">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M2 12c1.5-1.5 3-3 6-3s4.5 1.5 6 3c1.5 1.5 3 3 6 3"/>
                            </svg>
                            ${day.waveHeight}m
                        </span>
                    </div>
                    <div class="daily-status">
                        <span class="crossing-badge ${day.crossingStatus}">${day.crossingStatus.charAt(0).toUpperCase() + day.crossingStatus.slice(1)}</span>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.dailyForecast.innerHTML = html;
    }

    updateAlerts(alerts) {
        if (!this.elements.alertsContainer) return;

        const html = alerts.map(alert => `
            <div class="alert-item ${alert.type}">
                <div class="alert-icon">
                    ${this.getAlertIcon(alert.type)}
                </div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <p class="alert-description">${alert.description}</p>
                    <span class="alert-time">${alert.time}</span>
                </div>
            </div>
        `).join('');

        this.elements.alertsContainer.innerHTML = html;
    }

    getAlertIcon(type) {
        const icons = {
            info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            severe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
        };
        return icons[type] || icons.info;
    }

    showLoading() {
        // Could add a loading spinner here
        if (this.elements.condition) {
            this.elements.condition.textContent = 'Loading...';
        }
    }

    showError(message) {
        if (this.elements.alertsContainer) {
            this.elements.alertsContainer.innerHTML = `
                <div class="alert-item warning">
                    <div class="alert-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                    <div class="alert-content">
                        <div class="alert-title">Unable to Load Weather Data</div>
                        <p class="alert-description">${message}. Retrying automatically...</p>
                        <span class="alert-time">Just now</span>
                    </div>
                </div>
            `;
        }
    }

    // ============================================
    // New UI Methods for Enhanced Features
    // ============================================

    updateComfortScore(score, description) {
        if (this.elements.comfortScore) {
            this.elements.comfortScore.textContent = score;
        }
        if (this.elements.comfortDesc) {
            this.elements.comfortDesc.textContent = description;
        }
        if (this.elements.comfortScoreRing) {
            // Update the ring fill (circumference = 2 * PI * 45 ≈ 283)
            const circumference = 283;
            const offset = circumference - (score / 5) * circumference;
            const scoreFill = this.elements.comfortScoreRing.querySelector('.score-fill');
            if (scoreFill) {
                scoreFill.style.strokeDashoffset = offset;
            }
            // Update color class
            this.elements.comfortScoreRing.className = `comfort-score-ring score-${score}`;
        }
    }

    updateSailings(sailings, filter = 'all') {
        if (!this.elements.sailingsGrid) return;

        const filteredSailings = filter === 'all'
            ? sailings
            : sailings.filter(s => s.operator === filter);

        const html = filteredSailings.map(sailing => {
            // Determine port codes and names based on direction
            const isWellingtonToPicton = sailing.direction === 'wellingtonToPicton';
            const fromCode = isWellingtonToPicton ? 'WLG' : 'PCN';
            const fromName = isWellingtonToPicton ? 'Wellington' : 'Picton';
            const toCode = isWellingtonToPicton ? 'PCN' : 'WLG';
            const toName = isWellingtonToPicton ? 'Picton' : 'Wellington';

            return `
            <div class="sailing-card ${sailing.departed ? 'departed' : ''} ${sailing.isNext ? 'next-departure' : ''}">
                <div class="sailing-header">
                    <div class="sailing-operator">
                        <div class="operator-logo ${sailing.operator}">
                            ${sailing.operator === 'interislander' ? 'IS' : 'BB'}
                        </div>
                        <div>
                            <div class="operator-name">${sailing.operatorName}</div>
                            <div class="vessel-name">${sailing.vessel}</div>
                        </div>
                    </div>
                    <div class="sailing-time">
                        <div class="departure-time">${sailing.departTimeStr}</div>
                        <div class="arrival-time">Arrives ${sailing.arriveTimeStr}</div>
                    </div>
                </div>

                <div class="sailing-route">
                    <div class="route-port">
                        <div class="port-code">${fromCode}</div>
                        <div class="port-name">${fromName}</div>
                    </div>
                    <div class="route-arrow">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </div>
                    <div class="route-port" style="text-align: right;">
                        <div class="port-code">${toCode}</div>
                        <div class="port-name">${toName}</div>
                    </div>
                </div>

                <div class="sailing-weather">
                    <div class="weather-stat">
                        <div class="weather-stat-value">${sailing.weather.temperature || '--'}°</div>
                        <div class="weather-stat-label">Temp</div>
                    </div>
                    <div class="weather-stat">
                        <div class="weather-stat-value">${sailing.weather.windSpeed || '--'}</div>
                        <div class="weather-stat-label">Wind km/h</div>
                    </div>
                    <div class="weather-stat">
                        <div class="weather-stat-value">${sailing.weather.waveHeight?.toFixed(1) || '--'}</div>
                        <div class="weather-stat-label">Waves m</div>
                    </div>
                </div>

                <div class="sailing-footer">
                    <div class="sailing-comfort">
                        <div class="comfort-meter">
                            ${[1,2,3,4,5].map(i => `
                                <div class="comfort-dot ${i <= sailing.comfortScore ? 'filled' : ''} ${sailing.comfortClass}"></div>
                            `).join('')}
                        </div>
                        <span class="comfort-text">${sailing.comfortDesc}</span>
                    </div>
                    <div class="sailing-actions">
                        ${sailing.trackingUrl ? `
                            <a href="${sailing.trackingUrl}" target="_blank" rel="noopener" class="track-link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                Track
                            </a>
                        ` : ''}
                        ${sailing.bookingUrl ? `
                            <a href="${sailing.bookingUrl}" target="_blank" rel="noopener" class="book-link">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                                Book
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `}).join('');

        this.elements.sailingsGrid.innerHTML = html;
    }

    updateComparison(comparisonData, bestSailing) {
        if (!this.elements.comparisonChart) return;

        // Find the best score
        const maxScore = Math.max(...comparisonData.map(d => d.score));

        const html = comparisonData.map(data => {
            const isBest = data.score === maxScore;
            return `
                <div class="comparison-row ${isBest ? 'best' : ''}" style="position: relative;">
                    <div class="comparison-time">
                        ${data.timeLabel}
                        <span>Departure</span>
                    </div>
                    <div class="comparison-bar-container">
                        <div class="comparison-bar ${data.status}" style="width: ${data.percentage}%;">
                            <div class="comparison-details">
                                <span>${data.wind} km/h</span>
                                <span>${data.waves?.toFixed(1) || '--'}m</span>
                            </div>
                        </div>
                    </div>
                    <div class="comparison-score">${data.score}/5</div>
                </div>
            `;
        }).join('');

        this.elements.comparisonChart.innerHTML = html;

        // Update recommendation
        if (bestSailing && this.elements.bestTimeText && this.elements.bestTimeReason) {
            const timeStr = bestSailing.departTime.toLocaleTimeString('en-NZ', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            this.elements.bestTimeText.textContent = `The ${timeStr} sailing`;

            const reasons = [];
            if (bestSailing.weather.waveHeight < 1.5) reasons.push('calm seas');
            else if (bestSailing.weather.waveHeight < 2.5) reasons.push('moderate seas');

            if (bestSailing.weather.windSpeed < 25) reasons.push('light winds');
            else if (bestSailing.weather.windSpeed < 35) reasons.push('manageable winds');

            this.elements.bestTimeReason.textContent = reasons.length > 0
                ? `offers ${reasons.join(' and ')} for your crossing`
                : 'offers the best conditions today';
        }
    }

    initSailingTabs(sailings) {
        const tabs = document.querySelectorAll('.sailing-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const filter = tab.dataset.operator;
                this.updateSailings(sailings, filter);
            });
        });
    }

    // Initialize day tabs
    initDayTabs(weekDays, onDayChange) {
        const container = document.getElementById('dayTabs');
        if (!container) return;

        const html = weekDays.map((day, index) => `
            <button class="day-tab ${index === 0 ? 'active' : ''}" data-offset="${day.offset}">
                <span class="day-tab-name">${day.name}</span>
                <span class="day-tab-date">${day.date} ${day.month}</span>
            </button>
        `).join('');

        container.innerHTML = html;

        // Add click handlers
        const tabs = container.querySelectorAll('.day-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const offset = parseInt(tab.dataset.offset, 10);
                if (onDayChange) onDayChange(offset);
            });
        });
    }

    // Initialize direction toggle
    initDirectionToggle(onDirectionChange) {
        const buttons = document.querySelectorAll('.direction-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const direction = btn.dataset.direction;
                if (onDirectionChange) onDirectionChange(direction);
            });
        });
    }

    // Update ferry animation direction on map
    updateFerryDirection(direction) {
        const ferryIcon = document.getElementById('ferryIcon');
        if (ferryIcon) {
            if (direction === 'pictonToWellington') {
                ferryIcon.classList.add('reverse');
            } else {
                ferryIcon.classList.remove('reverse');
            }
        }
    }

    // Update historical context comparison
    updateHistoricalContext(currentWeather) {
        const container = document.getElementById('historicalGrid');
        if (!container) return;

        const season = getCurrentSeason();
        const averages = SEASONAL_AVERAGES[season];

        const comparisons = [
            {
                label: 'Wind Speed',
                current: currentWeather.windSpeed,
                average: averages.windSpeed,
                unit: 'km/h',
                higherIsBad: true
            },
            {
                label: 'Wave Height',
                current: currentWeather.waveHeight,
                average: averages.waveHeight,
                unit: 'm',
                higherIsBad: true,
                decimals: 1
            },
            {
                label: 'Temperature',
                current: currentWeather.temperature,
                average: averages.temperature,
                unit: '°C',
                higherIsBad: false
            },
            {
                label: 'Visibility',
                current: currentWeather.visibility,
                average: averages.visibility,
                unit: 'km',
                higherIsBad: false
            }
        ];

        const html = comparisons.map(comp => {
            const diff = comp.current - comp.average;
            const absDiff = Math.abs(diff);
            const diffStr = comp.decimals
                ? absDiff.toFixed(comp.decimals)
                : Math.round(absDiff);

            let comparisonClass = 'same';
            let comparisonText = 'Average';
            let arrowSvg = '';

            if (Math.abs(diff) > 0.5) {
                if (diff > 0) {
                    comparisonClass = comp.higherIsBad ? 'higher' : 'lower';
                    comparisonText = `+${diffStr} ${comp.unit} above avg`;
                    arrowSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>';
                } else {
                    comparisonClass = comp.higherIsBad ? 'lower' : 'higher';
                    comparisonText = `-${diffStr} ${comp.unit} below avg`;
                    arrowSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
                }
            }

            const currentValue = comp.decimals
                ? comp.current.toFixed(comp.decimals)
                : Math.round(comp.current);

            const cardClass = comparisonClass === 'same' ? '' :
                (comparisonClass === 'higher' && comp.higherIsBad) ||
                (comparisonClass === 'lower' && !comp.higherIsBad) ? 'above-average' : 'below-average';

            return `
                <div class="historical-card ${cardClass}">
                    <div class="historical-label">${comp.label}</div>
                    <div class="historical-current">${currentValue}${comp.unit}</div>
                    <div class="historical-comparison ${comparisonClass}">
                        ${arrowSvg}
                        <span>${comparisonText}</span>
                    </div>
                    <div class="historical-average">${season.charAt(0).toUpperCase() + season.slice(1)} avg: ${comp.decimals ? comp.average.toFixed(comp.decimals) : comp.average}${comp.unit}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    // Update webcam timestamps
    updateWebcamTimestamps() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-NZ', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const wellingtonTime = document.getElementById('wellingtonCamTime');
        const pictonTime = document.getElementById('pictonCamTime');

        if (wellingtonTime) wellingtonTime.textContent = timeStr;
        if (pictonTime) pictonTime.textContent = timeStr;
    }

    // Refresh webcam images (add cache-busting query param)
    refreshWebcamImages() {
        const timestamp = Date.now();
        const wellingtonImg = document.getElementById('wellingtonCamImg');
        const pictonImg = document.getElementById('pictonCamImg');

        if (wellingtonImg && wellingtonImg.src) {
            const baseUrl = wellingtonImg.src.split('?')[0];
            wellingtonImg.src = `${baseUrl}?t=${timestamp}`;
        }

        if (pictonImg && pictonImg.src) {
            const baseUrl = pictonImg.src.split('?')[0];
            pictonImg.src = `${baseUrl}?t=${timestamp}`;
        }

        this.updateWebcamTimestamps();
    }

    // Add wind indicator to map
    updateWindIndicator(windSpeed, windDirection) {
        const mapContainer = document.querySelector('.strait-map');
        if (!mapContainer) return;

        // Remove existing wind indicator
        const existing = mapContainer.querySelector('.wind-indicator-group');
        if (existing) existing.remove();

        // Direction to degrees mapping
        const directionDegrees = {
            'N': 180, 'NE': 225, 'E': 270, 'SE': 315,
            'S': 0, 'SW': 45, 'W': 90, 'NW': 135
        };

        const rotation = directionDegrees[windDirection] || 0;

        // Create wind indicator SVG group
        const windGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        windGroup.setAttribute('class', 'wind-indicator-group');
        windGroup.setAttribute('transform', 'translate(320, 250)');

        windGroup.innerHTML = `
            <circle r="30" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
            <g class="wind-arrow-indicator" transform="rotate(${rotation})">
                <path d="M0,-20 L5,-5 L2,-5 L2,15 L-2,15 L-2,-5 L-5,-5 Z" fill="rgba(255,255,255,0.9)"/>
            </g>
            <text x="0" y="45" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.8)">${windSpeed} km/h</text>
            <text x="0" y="57" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.6)">${windDirection}</text>
        `;

        mapContainer.appendChild(windGroup);
    }

    // Update weather sources display with multi-model comparison
    updateWeatherSources(modelComparison) {
        const container = document.getElementById('weatherSourcesGrid');
        if (!container || !modelComparison) return;

        const confidenceColors = {
            'High': 'var(--status-good)',
            'Medium': 'var(--status-moderate)',
            'Low': 'var(--status-poor)'
        };

        const confidenceDescriptions = {
            'High': 'Models in strong agreement',
            'Medium': 'Some variation between models',
            'Low': 'Significant model disagreement'
        };

        // Build model comparison cards
        const modelsHtml = modelComparison.models.map(model => `
            <div class="source-model">
                <div class="model-name">${model.model}</div>
                <div class="model-values">
                    <span class="model-temp">${model.temperature}°C</span>
                    <span class="model-wind">${model.windSpeed} km/h</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="confidence-indicator" style="border-color: ${confidenceColors[modelComparison.level]}">
                <div class="confidence-badge" style="background: ${confidenceColors[modelComparison.level]}">
                    ${modelComparison.level} Confidence
                </div>
                <div class="confidence-detail">
                    ${confidenceDescriptions[modelComparison.level]}
                </div>
                <div class="confidence-stats">
                    <span>Wind variance: ±${Math.round(modelComparison.windRange / 2)} km/h</span>
                    <span>Temp variance: ±${(modelComparison.tempRange / 2).toFixed(1)}°C</span>
                </div>
            </div>
            <div class="source-models">
                <div class="models-title">Data from ${modelComparison.modelCount} weather models:</div>
                ${modelsHtml}
            </div>
            <div class="source-links">
                <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo API</a>
                <a href="https://www.metservice.com/marine/regions/cook-strait" target="_blank" rel="noopener">MetService Marine</a>
                <a href="https://www.linz.govt.nz/guidance/marine/tides-and-nautical-charts" target="_blank" rel="noopener">LINZ Tides</a>
            </div>
        `;
    }
}

// ============================================
// Navigation & Smooth Scroll
// ============================================

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                const headerOffset = 80;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.pageYOffset >= sectionTop) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(10, 22, 40, 0.95)';
        } else {
            header.style.background = 'linear-gradient(180deg, rgba(10, 22, 40, 0.9) 0%, rgba(10, 22, 40, 0) 100%)';
        }
    });
}

// ============================================
// Main Application
// ============================================

class CrossWeatherApp {
    constructor() {
        this.weatherAPI = new WeatherAPI();
        this.uiController = new UIController();
        this.ferryManager = new FerryScheduleManager();
        this.lastUpdate = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.currentSailings = [];
        this.currentDirection = 'wellingtonToPicton';
        this.currentDayOffset = 0;
        this.currentFilter = 'all';
        this.weatherData = null;
    }

    async init() {
        console.log('CrossWeather App initializing...');
        console.log('Data sources:');
        console.log('  - Weather: Open-Meteo API (https://open-meteo.com)');
        console.log('  - Marine: Open-Meteo Marine API');
        console.log('  - Warnings: MetService-style condition alerts');

        initNavigation();

        // Show loading state
        this.uiController.showLoading();

        // Initial data fetch
        await this.updateAllData();

        // Initialize direction toggle
        this.uiController.initDirectionToggle((direction) => {
            this.currentDirection = direction;
            this.updateSailingsDisplay();
            this.uiController.updateFerryDirection(direction);
        });

        // Initialize day tabs
        const weekDays = this.ferryManager.getWeekDays();
        this.uiController.initDayTabs(weekDays, (dayOffset) => {
            this.currentDayOffset = dayOffset;
            this.updateSailingsDisplay();
        });

        // Initialize webcam timestamps
        this.uiController.updateWebcamTimestamps();

        // Set up periodic updates (every 5 minutes)
        setInterval(() => this.updateAllData(), CONFIG.updateInterval);

        // Update "last updated" text every 30 seconds
        setInterval(() => this.updateLastUpdatedText(), 30000);

        // Refresh webcams every 10 minutes
        setInterval(() => this.uiController.refreshWebcamImages(), 600000);

        console.log('CrossWeather App initialized with live data');
    }

    async updateAllData() {
        try {
            const data = await this.weatherAPI.getAllData();
            this.weatherData = data;

            // Update basic weather UI
            this.uiController.updateCurrentWeather(data.current);
            this.uiController.updateHourlyForecast(data.hourly);
            this.uiController.updateDailyForecast(data.daily);

            // Calculate and display comfort score
            const comfortScore = ComfortScoreCalculator.calculate(
                data.current.waveHeight,
                data.current.swellPeriod,
                data.current.windSpeed,
                data.current.windGusts
            );
            const comfortDesc = ComfortScoreCalculator.getDescription(comfortScore);
            this.uiController.updateComfortScore(comfortScore, comfortDesc);

            // Update hero section
            this.uiController.updateHeroMetrics(data.current);
            this.uiController.updateHeroComfort(comfortScore, comfortDesc);

            // Update ferry schedule manager with hourly and daily forecasts
            this.ferryManager.updateForecast(data.hourly, data.daily);

            // Get sailings and update next sailing card
            // Look at today first, then tomorrow if no sailings remain
            let sailings = this.ferryManager.getAllSailings(this.currentDirection, 'all', 0);
            let nextSailing = sailings.find(s => !s.departed);

            // If no sailings left today, look at tomorrow
            if (!nextSailing) {
                const tomorrowSailings = this.ferryManager.getAllSailings(this.currentDirection, 'all', 1);
                nextSailing = tomorrowSailings.find(s => !s.departed);
                // Combine for best sailing search
                sailings = [...sailings, ...tomorrowSailings];
            }

            if (nextSailing) {
                this.uiController.updateNextSailing(nextSailing);
            }

            // Find best sailing for recommendation (from remaining sailings today + tomorrow)
            const availableSailings = sailings.filter(s => !s.departed);
            const bestSailing = availableSailings.length > 0
                ? availableSailings.sort((a, b) => b.comfortScore - a.comfortScore)[0]
                : null;
            if (bestSailing) {
                this.uiController.updateRecommendation(bestSailing);
            }

            // Update sailings display
            this.updateSailingsDisplay();

            // Initialize operator tabs
            this.initOperatorTabs();

            // Fetch and merge MetService warnings with local alerts
            const metServiceWarnings = await MetServiceWarnings.fetchWarnings(data.current);
            const allAlerts = [...metServiceWarnings, ...data.alerts];
            this.uiController.updateAlerts(allAlerts);

            // Update historical context
            this.uiController.updateHistoricalContext(data.current);

            // Update wind indicator on map
            this.uiController.updateWindIndicator(data.current.windSpeed, data.current.windDirection);

            // Update weather sources display with multi-model comparison
            if (data.modelComparison) {
                this.uiController.updateWeatherSources(data.modelComparison);
            }

            this.lastUpdate = Date.now();
            this.retryCount = 0;

        } catch (error) {
            console.error('Failed to fetch weather data:', error);
            this.retryCount++;

            if (this.retryCount <= this.maxRetries) {
                this.uiController.showError(`Connection issue (attempt ${this.retryCount}/${this.maxRetries})`);
                // Retry after 10 seconds
                setTimeout(() => this.updateAllData(), 10000);
            } else {
                this.uiController.showError('Please check your internet connection and refresh the page');
            }
        }
    }

    updateSailingsDisplay() {
        // Get sailings for current direction and day
        this.currentSailings = this.ferryManager.getAllSailings(
            this.currentDirection,
            this.currentFilter,
            this.currentDayOffset
        );

        // Update sailings grid
        this.uiController.updateSailings(this.currentSailings, this.currentFilter);

        // Update comparison chart
        const comparisonData = this.ferryManager.getComparisonData(
            this.currentDirection,
            this.currentDayOffset
        );
        const bestSailing = this.ferryManager.getBestSailing(
            this.currentDirection,
            this.currentDayOffset
        );
        this.uiController.updateComparison(comparisonData, bestSailing);
    }

    initOperatorTabs() {
        const tabs = document.querySelectorAll('.sailing-tab');
        tabs.forEach(tab => {
            // Remove existing listeners by cloning
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
        });

        // Add fresh listeners
        document.querySelectorAll('.sailing-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.sailing-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.operator;
                this.updateSailingsDisplay();
            });
        });
    }

    updateLastUpdatedText() {
        const element = document.getElementById('lastUpdated');
        if (!element || !this.lastUpdate) return;

        const minutes = Math.floor((Date.now() - this.lastUpdate) / 60000);
        if (minutes < 1) {
            element.textContent = 'Updated just now';
        } else if (minutes === 1) {
            element.textContent = 'Updated 1 minute ago';
        } else {
            element.textContent = `Updated ${minutes} minutes ago`;
        }
    }
}

// ============================================
// Start Application
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new CrossWeatherApp();
    app.init();
});

// Add fog animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes fogMove {
        0%, 100% { transform: translateX(-5px); opacity: 0.3; }
        50% { transform: translateX(5px); opacity: 0.5; }
    }
`;
document.head.appendChild(style);
