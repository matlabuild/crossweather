/**
 * CrossWeather - Cook Strait Ferry Weather Application
 * Real-time weather conditions for Wellington ↔ Picton ferry crossings
 */

// ============================================
// Configuration & Constants
// ============================================

const CONFIG = {
    updateInterval: 60000, // Update every minute
    animationDuration: 500,
    location: {
        name: 'Cook Strait',
        wellington: { lat: -41.2865, lon: 174.7762 },
        picton: { lat: -41.2903, lon: 174.0010 }
    }
};

// Weather condition mappings
const WEATHER_CONDITIONS = {
    sunny: { icon: 'sunny', description: 'Clear skies' },
    partlyCloudy: { icon: 'partly-cloudy', description: 'Partly cloudy' },
    cloudy: { icon: 'cloudy', description: 'Cloudy' },
    rainy: { icon: 'rainy', description: 'Rain' },
    stormy: { icon: 'stormy', description: 'Stormy' },
    foggy: { icon: 'foggy', description: 'Foggy' }
};

// Crossing status thresholds
const CROSSING_THRESHOLDS = {
    good: { maxWind: 30, maxWave: 2.0, minVisibility: 10 },
    moderate: { maxWind: 45, maxWave: 3.5, minVisibility: 5 },
    poor: { maxWind: Infinity, maxWave: Infinity, minVisibility: 0 }
};

// ============================================
// Weather Data Generator (Simulated)
// ============================================

class WeatherDataGenerator {
    constructor() {
        this.baseConditions = this.generateBaseConditions();
    }

    generateBaseConditions() {
        // Generate realistic Cook Strait weather patterns
        const hour = new Date().getHours();
        const season = this.getSeason();

        return {
            temperature: this.getSeasonalTemp(season, hour),
            humidity: 65 + Math.random() * 25,
            pressure: 1010 + Math.random() * 20,
            windSpeed: 15 + Math.random() * 30,
            windDirection: this.getWindDirection(),
            windGusts: 25 + Math.random() * 25,
            waveHeight: 0.8 + Math.random() * 2.5,
            swellPeriod: 6 + Math.random() * 6,
            visibility: 8 + Math.random() * 15,
            seaTemp: this.getSeaTemp(season),
            condition: this.getCondition(hour)
        };
    }

    getSeason() {
        const month = new Date().getMonth();
        if (month >= 11 || month <= 1) return 'summer';
        if (month >= 2 && month <= 4) return 'autumn';
        if (month >= 5 && month <= 7) return 'winter';
        return 'spring';
    }

    getSeasonalTemp(season, hour) {
        const baseTemps = {
            summer: 20, autumn: 14, winter: 9, spring: 14
        };
        const base = baseTemps[season];
        const hourAdjust = Math.sin((hour - 6) * Math.PI / 12) * 5;
        return Math.round(base + hourAdjust + (Math.random() - 0.5) * 4);
    }

    getSeaTemp(season) {
        const temps = { summer: 16, autumn: 14, winter: 11, spring: 13 };
        return temps[season] + Math.round((Math.random() - 0.5) * 2);
    }

    getWindDirection() {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        // Cook Strait commonly gets NW and S winds
        const weights = [0.08, 0.05, 0.05, 0.1, 0.2, 0.12, 0.15, 0.25];
        const random = Math.random();
        let cumulative = 0;
        for (let i = 0; i < weights.length; i++) {
            cumulative += weights[i];
            if (random < cumulative) return directions[i];
        }
        return 'NW';
    }

    getCondition(hour) {
        const random = Math.random();
        if (random < 0.3) return 'partlyCloudy';
        if (random < 0.5) return 'cloudy';
        if (random < 0.65) return 'sunny';
        if (random < 0.8) return 'rainy';
        if (random < 0.95) return 'foggy';
        return 'stormy';
    }

    getCurrentWeather() {
        // Add slight variations to base conditions
        const base = this.baseConditions;
        return {
            ...base,
            temperature: base.temperature + Math.round((Math.random() - 0.5) * 2),
            windSpeed: Math.round(base.windSpeed + (Math.random() - 0.5) * 10),
            waveHeight: Math.round((base.waveHeight + (Math.random() - 0.5) * 0.5) * 10) / 10,
            feelsLike: base.temperature - Math.round(base.windSpeed / 10)
        };
    }

    getHourlyForecast() {
        const forecast = [];
        const now = new Date();
        const baseTemp = this.baseConditions.temperature;
        const baseWind = this.baseConditions.windSpeed;

        for (let i = 0; i < 24; i++) {
            const hour = new Date(now.getTime() + i * 3600000);
            const hourNum = hour.getHours();
            const tempVariation = Math.sin((hourNum - 6) * Math.PI / 12) * 4;

            forecast.push({
                time: hour,
                temperature: Math.round(baseTemp + tempVariation + (Math.random() - 0.5) * 3),
                condition: this.getCondition(hourNum),
                windSpeed: Math.round(baseWind + (Math.random() - 0.5) * 15),
                waveHeight: Math.round((1 + Math.random() * 2) * 10) / 10,
                precipitation: Math.round(Math.random() * 40)
            });
        }
        return forecast;
    }

    getDailyForecast() {
        const forecast = [];
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const now = new Date();

        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() + i * 86400000);
            const dayVariation = Math.sin(i * 0.5) * 3;

            forecast.push({
                date: date,
                day: i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : days[date.getDay()]),
                high: Math.round(this.baseConditions.temperature + 3 + dayVariation + (Math.random() - 0.5) * 4),
                low: Math.round(this.baseConditions.temperature - 5 + dayVariation + (Math.random() - 0.5) * 3),
                condition: this.getCondition(12),
                windSpeed: Math.round(15 + Math.random() * 30),
                waveHeight: Math.round((1 + Math.random() * 2.5) * 10) / 10,
                crossingStatus: this.getCrossingStatus(15 + Math.random() * 30, 1 + Math.random() * 2.5, 10 + Math.random() * 10)
            });
        }
        return forecast;
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

    getAlerts() {
        const alerts = [];
        const weather = this.baseConditions;

        // Generate contextual alerts based on conditions
        if (weather.windSpeed > 35) {
            alerts.push({
                type: 'warning',
                title: 'Strong Wind Advisory',
                description: `Northwest winds gusting to ${Math.round(weather.windGusts)} km/h expected. Possible delays to ferry services.`,
                time: '2 hours ago'
            });
        }

        if (weather.waveHeight > 2.5) {
            alerts.push({
                type: 'warning',
                title: 'High Seas Warning',
                description: `Wave heights of ${weather.waveHeight.toFixed(1)}m expected in Cook Strait. Passengers prone to seasickness advised to take precautions.`,
                time: '1 hour ago'
            });
        }

        if (weather.visibility < 8) {
            alerts.push({
                type: 'info',
                title: 'Reduced Visibility',
                description: 'Morning fog patches possible in Marlborough Sounds. Brief delays may occur.',
                time: '3 hours ago'
            });
        }

        // Always show at least one info alert
        if (alerts.length === 0) {
            alerts.push({
                type: 'info',
                title: 'Normal Operations',
                description: 'All ferry services operating to schedule. Current conditions are favorable for crossings.',
                time: 'Just now'
            });
        }

        return alerts;
    }
}

// ============================================
// UI Controller
// ============================================

class UIController {
    constructor(weatherGenerator) {
        this.weather = weatherGenerator;
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
        this.animateValue(this.elements.windSpeed, Math.round(data.windSpeed));
        this.animateValue(this.elements.windGusts, Math.round(data.windGusts));
        this.animateValue(this.elements.humidity, Math.round(data.humidity));
        this.animateValue(this.elements.pressure, Math.round(data.pressure));

        // Wave and visibility
        this.elements.waveHeight.textContent = data.waveHeight.toFixed(1);
        this.elements.swellPeriod.textContent = Math.round(data.swellPeriod);
        this.elements.visibility.textContent = Math.round(data.visibility);
        this.elements.seaTemp.textContent = data.seaTemp;

        // Update condition text
        this.elements.condition.textContent = WEATHER_CONDITIONS[data.condition]?.description || 'Variable';

        // Wind direction
        this.updateWindDirection(data.windDirection);

        // Update visual indicators
        this.updateVisibilityBar(data.visibility);
        this.updateSeaTempBar(data.seaTemp);
        this.updateWeatherIcon(data.condition);

        // Update crossing status
        const status = this.weather.getCrossingStatus(data.windSpeed, data.waveHeight, data.visibility);
        this.updateCrossingStatus(status);

        // Last updated
        this.elements.lastUpdated.textContent = 'Updated just now';
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
        // Scale: 0-20km maps to 0-100%
        const percentage = Math.min(100, (visibility / 20) * 100);
        this.elements.visibilityBar.style.width = `${percentage}%`;
    }

    updateSeaTempBar(temp) {
        if (!this.elements.seaTempBar) return;
        // Scale: 8-20°C maps to 0-100%
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
                detail: 'Moderate seas expected. Standard crossing time of 3 hours 20 minutes.'
            },
            moderate: {
                class: 'moderate',
                text: 'Moderate Crossing Conditions',
                detail: 'Some swell expected. Passengers prone to seasickness should take precautions.'
            },
            poor: {
                class: 'poor',
                text: 'Challenging Crossing Conditions',
                detail: 'Heavy seas expected. Check with ferry operator for possible delays or cancellations.'
            }
        };

        const config = statusConfig[status];
        const indicator = statusBanner.querySelector('.status-indicator');
        const detail = statusBanner.querySelector('.status-detail');
        const dot = statusBanner.querySelector('.status-dot');
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
}

// ============================================
// Ferry Animation Controller
// ============================================

class FerryAnimationController {
    constructor() {
        this.ferryElement = document.getElementById('ferryIcon');
        this.animationPaused = false;
    }

    updateFerryPosition(progress) {
        // Progress: 0 = Wellington, 1 = Picton
        if (!this.ferryElement) return;

        // Bezier curve path matching the SVG
        const startX = 180, startY = 95;
        const endX = 200, endY = 405;
        const midX = 220, midY = 250;

        const t = progress;
        const x = (1-t)*(1-t)*startX + 2*(1-t)*t*midX + t*t*endX;
        const y = (1-t)*(1-t)*startY + 2*(1-t)*t*midY + t*t*endY;

        // Add slight bobbing motion
        const bob = Math.sin(Date.now() / 500) * 2;
        const rotation = Math.sin(Date.now() / 800) * 5;

        this.ferryElement.style.transform = `translate(${x}px, ${y + bob}px) rotate(${rotation}deg)`;
    }
}

// ============================================
// Navigation & Smooth Scroll
// ============================================

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');

    // Smooth scroll
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

    // Active state on scroll
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;
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

    // Header background on scroll
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
// Initialize Application
// ============================================

class CrossWeatherApp {
    constructor() {
        this.weatherGenerator = new WeatherDataGenerator();
        this.uiController = new UIController(this.weatherGenerator);
        this.ferryController = new FerryAnimationController();
        this.lastUpdate = Date.now();
    }

    init() {
        // Initialize navigation
        initNavigation();

        // Initial data load
        this.updateAllData();

        // Set up periodic updates
        setInterval(() => this.updateAllData(), CONFIG.updateInterval);

        // Update "last updated" text
        setInterval(() => this.updateLastUpdatedText(), 10000);

        console.log('CrossWeather App initialized');
    }

    updateAllData() {
        const currentWeather = this.weatherGenerator.getCurrentWeather();
        const hourlyForecast = this.weatherGenerator.getHourlyForecast();
        const dailyForecast = this.weatherGenerator.getDailyForecast();
        const alerts = this.weatherGenerator.getAlerts();

        this.uiController.updateCurrentWeather(currentWeather);
        this.uiController.updateHourlyForecast(hourlyForecast);
        this.uiController.updateDailyForecast(dailyForecast);
        this.uiController.updateAlerts(alerts);

        this.lastUpdate = Date.now();
    }

    updateLastUpdatedText() {
        const element = document.getElementById('lastUpdated');
        if (!element) return;

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

// Add fog animation keyframes dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes fogMove {
        0%, 100% { transform: translateX(-5px); opacity: 0.3; }
        50% { transform: translateX(5px); opacity: 0.5; }
    }
`;
document.head.appendChild(style);
