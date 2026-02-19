import express from "express";
const app = express();
app.use(express.json());
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";
// Helper function
async function makeNWSRequest(url) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        console.error("Error making NWS request:", error);
        return null;
    }
}
// -----------------------------
// GET ALERTS
// -----------------------------
app.get("/alerts/:state", async (req, res) => {
    const stateCode = req.params.state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest(alertsUrl);
    if (!alertsData) {
        return res.status(500).json({ error: "Failed to retrieve alerts data" });
    }
    if (!alertsData.features || alertsData.features.length === 0) {
        return res.json({ message: `No active alerts for ${stateCode}` });
    }
    const formatted = alertsData.features.map((feature) => ({
        event: feature.properties.event,
        area: feature.properties.areaDesc,
        severity: feature.properties.severity,
        headline: feature.properties.headline,
    }));
    res.json({ state: stateCode, alerts: formatted });
});
// -----------------------------
// GET FORECAST
// -----------------------------
app.get("/forecast", async (req, res) => {
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) {
        return res.status(400).json({
            error: "Please provide latitude and longitude query parameters",
        });
    }
    const lat = Number(latitude);
    const lon = Number(longitude);
    const pointsUrl = `${NWS_API_BASE}/points/${lat},${lon}`;
    const pointsData = await makeNWSRequest(pointsUrl);
    if (!pointsData?.properties?.forecast) {
        return res.status(400).json({
            error: "Invalid location or unsupported by NWS (US only)",
        });
    }
    const forecastData = await makeNWSRequest(pointsData.properties.forecast);
    if (!forecastData?.properties?.periods) {
        return res.status(500).json({
            error: "Failed to retrieve forecast data",
        });
    }
    const periods = forecastData.properties.periods.map((period) => ({
        name: period.name,
        temperature: `${period.temperature}°${period.temperatureUnit}`,
        wind: `${period.windSpeed} ${period.windDirection}`,
        forecast: period.shortForecast,
    }));
    res.json({
        location: { latitude: lat, longitude: lon },
        forecast: periods,
    });
});
// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/", (_, res) => {
    res.json({ message: "Weather API is running" });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Weather API running on port ${PORT}`);
});
