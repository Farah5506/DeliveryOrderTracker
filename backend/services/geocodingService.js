const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ||
  'DeliveryOrderTracker-Team07/1.0 (BUE Intro to Cloud Computing student project)';
const TIMEOUT_MS = 3000;


async function geocode(address) {
  const url = `${SEARCH_URL}?${new URLSearchParams({ q: address, format: 'jsonv2', limit: '1' })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      signal: controller.signal
    });
    if (!response.ok) {
      console.warn(`[geocode] Nominatim answered ${response.status}`);
      return { status: 'unavailable' };
    }
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      return { status: 'not_found' };
    }
    return { status: 'found', lat: Number(results[0].lat), lon: Number(results[0].lon) };
  } catch (error) {
    console.warn(`[geocode] Nominatim could not be reached: ${error.name}`);
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { geocode };
