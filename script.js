const API_KEY = "5ffb74aad8e6b8b58196ba9340c010e1";
const BASE_URL = "https://api.openweathermap.org/data/2.5";


const $ = (id) => document.getElementById(id);
const state = { data: null, forecast: null, unit: "metric" };

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) throw new Error("City not found. Check the spelling and try again.");
    if (res.status === 401) throw new Error("Invalid API key. Update API_KEY in script.js.");
    throw new Error("Could not load weather data. Try again in a moment.");
  }
  return res.json();
}

function buildQuery(params) {
  return new URLSearchParams({ ...params, appid: API_KEY, units: "metric" }).toString();
}

async function getWeather(params) {
  const q = buildQuery(params);
  const [current, forecast] = await Promise.all([
    fetchJSON(`${BASE_URL}/weather?${q}`),
    fetchJSON(`${BASE_URL}/forecast?${q}`)
  ]);
  return { current, forecast };
}

/* ---------- Helpers ---------- */
const toF = (c) => c * 9 / 5 + 32;
const temp = (c) => Math.round(state.unit === "metric" ? c : toF(c)) + "°";
const speed = (ms) => state.unit === "metric" ? `${Math.round(ms * 3.6)} km/h` : `${Math.round(ms * 2.237)} mph`;
const timeAt = (unix, tz) =>
  new Date((unix + tz) * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function themeFor(w) {
  const id = w.weather[0].id;
  const night = w.dt < w.sys.sunrise || w.dt > w.sys.sunset;
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "mist";
  if (id > 800) return "clouds";
  return night ? "clear-night" : "clear-day";
}

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

/* ---------- Rendering ---------- */
function render() {
  const { current: w, forecast: f } = state.data;
  document.body.dataset.theme = themeFor(w);

  $("place").textContent = `${w.name}, ${w.sys.country}`;
  $("date").textContent = new Date((w.dt + w.timezone) * 1000)
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  $("temp").textContent = temp(w.main.temp);
  $("condition").textContent = w.weather[0].description;
  $("feels").textContent = temp(w.main.feels_like);
  $("humidity").textContent = `${w.main.humidity}%`;
  $("wind").textContent = speed(w.wind.speed);
  $("pressure").textContent = `${w.main.pressure} hPa`;
  $("sunrise").textContent = timeAt(w.sys.sunrise, w.timezone);
  $("sunset").textContent = timeAt(w.sys.sunset, w.timezone);

  // Group 3-hourly forecast into days (skip today)
  const days = {};
  f.list.forEach((item) => {
    const key = new Date((item.dt + f.city.timezone) * 1000).toISOString().slice(0, 10);
    (days[key] ||= []).push(item);
  });
  const today = new Date((w.dt + w.timezone) * 1000).toISOString().slice(0, 10);
  const html = Object.entries(days).filter(([k]) => k !== today).slice(0, 5).map(([k, items]) => {
    const min = Math.min(...items.map((i) => i.main.temp_min));
    const max = Math.max(...items.map((i) => i.main.temp_max));
    const mid = items[Math.floor(items.length / 2)];
    const name = new Date(k + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    return `<li>
      <p class="day">${name}</p>
      <img src="https://openweathermap.org/img/wn/${mid.weather[0].icon}@2x.png" alt="${mid.weather[0].description}">
      <p class="range">${temp(max)} / ${temp(min)}</p>
    </li>`;
  }).join("");
  $("forecast").innerHTML = html;

  $("current").hidden = false;
  $("forecast-wrap").hidden = false;
}

/* ---------- Actions ---------- */
async function load(params) {
  if (API_KEY === "YOUR_API_KEY_HERE") {
    setStatus("Add your API key in script.js to load live weather.", true);
    return;
  }
  setStatus("Loading weather…");
  try {
    state.data = await getWeather(params);
    setStatus("");
    render();
    localStorage.setItem("lastCity", state.data.current.name);
  } catch (err) {
    setStatus(err.message, true);
  }
}

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  load({ q: $("city-input").value.trim() });
});

$("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Location is not supported in this browser.", true);
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (p) => load({ lat: p.coords.latitude, lon: p.coords.longitude }),
    () => setStatus("Location access was blocked. Search for a city instead.", true)
  );
});

function setUnit(unit) {
  state.unit = unit;
  $("unit-c").classList.toggle("active", unit === "metric");
  $("unit-f").classList.toggle("active", unit === "imperial");
  if (state.data) render();
}
$("unit-c").addEventListener("click", () => setUnit("metric"));
$("unit-f").addEventListener("click", () => setUnit("imperial"));

// Load last searched city on start
load({ q: localStorage.getItem("lastCity") || "Delhi" });
