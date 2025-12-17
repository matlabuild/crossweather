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
// Weather API Service (Real Data from Open-Meteo)
// ============================================

class WeatherAPI {
    constructor() {
        this.cache = {
            weather: null,
            marine: null,
            lastFetch: null
        };
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

            const [weatherData, marineData] = await Promise.all([
                this.fetchWeatherData(),
                this.fetchMarineData()
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
            return this.processData(weatherData, marineData, seaTemp);
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

        for (let i = 0; i < Math.min(24, hours.length); i++) {
            const time = new Date(hours[i]);
            if (time < now && i > 0) continue; // Skip past hours except current

            const weatherCode = weather.hourly.weather_code[i];

            forecast.push({
                time: time,
                temperature: Math.round(weather.hourly.temperature_2m[i]),
                condition: WMO_CODES[weatherCode] || 'partlyCloudy',
                windSpeed: Math.round(weather.hourly.wind_speed_10m[i]),
                waveHeight: marine.hourly?.wave_height?.[i] || 1.0,
                precipitation: weather.hourly.precipitation_probability?.[i] || 0
            });

            if (forecast.length >= 12) break;
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
            weatherIconContainer: document.getElementById('weatherIconContainer')
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
        this.lastUpdate = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    async init() {
        console.log('CrossWeather App initializing...');
        console.log('Data source: Open-Meteo API (https://open-meteo.com)');

        initNavigation();

        // Show loading state
        this.uiController.showLoading();

        // Initial data fetch
        await this.updateAllData();

        // Set up periodic updates (every 5 minutes)
        setInterval(() => this.updateAllData(), CONFIG.updateInterval);

        // Update "last updated" text every 30 seconds
        setInterval(() => this.updateLastUpdatedText(), 30000);

        console.log('CrossWeather App initialized with live data');
    }

    async updateAllData() {
        try {
            const data = await this.weatherAPI.getAllData();

            this.uiController.updateCurrentWeather(data.current);
            this.uiController.updateHourlyForecast(data.hourly);
            this.uiController.updateDailyForecast(data.daily);
            this.uiController.updateAlerts(data.alerts);

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
