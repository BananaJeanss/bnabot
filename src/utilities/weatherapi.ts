export async function fetchCurrentWeatherApi(location: string): Promise<any> {
  const apiKey = process.env.WEATHERAPI_APIKEY;
  const url = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(
    location
  )}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`WeatherAPI request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}
