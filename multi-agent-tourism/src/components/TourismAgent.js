import React, { useState } from "react";

const TourismAgent = () => {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [displayOption, setDisplayOption] = useState("both");

  const fetchTourismData = async (placeName) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Geocode using Nominatim
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          placeName
        )}`
      );
      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        setError("Sorry, I don’t know this place exists.");
        setLoading(false);
        return;
      }

      const { lat, lon, display_name } = geoData[0];

      // Step 2: Get weather from Open-Meteo
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=precipitation`
      );
      const weatherData = await weatherRes.json();
      const weather = weatherData.current_weather;

      // Extract precipitation from hourly data for the current hour
      let precipitation = "N/A";
      if (weatherData.hourly && weatherData.hourly.precipitation && weatherData.hourly.time) {
        const currentTime = weather.time;

        // Find the closest time index in the hourly.time array
        const timeStrings = weatherData.hourly.time;
        let closestIndex = 0;
        let minDiff = Infinity;
        const currentTimestamp = new Date(currentTime).getTime();

        for (let i = 0; i < timeStrings.length; i++) {
          const timeStamp = new Date(timeStrings[i]).getTime();
          const diff = Math.abs(currentTimestamp - timeStamp);
          if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
          }
        }

        precipitation = weatherData.hourly.precipitation[closestIndex];
      }

      // Step 3: Get tourist places from Overpass API
      const overpassQuery = `
        [out:json][timeout:25];
        (
          node["tourism"="attraction"](around:5000,${lat},${lon});
          way["tourism"="attraction"](around:5000,${lat},${lon});
          relation["tourism"="attraction"](around:5000,${lat},${lon});
        );
        out center 5;
      `;
      const placesRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: overpassQuery,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });
      const placesData = await placesRes.json();

      let places = placesData.elements
        .map((element) => element.tags && element.tags.name)
        .filter(Boolean)
        .slice(0, 5);

      setResult({
        placeName: display_name.split(",")[0], // short version of place
        weather: {
          ...weather,
          precipitation,
        },
        places,
      });
    } catch (err) {
      setError("Failed to fetch data, please try again later.");
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    fetchTourismData(input.trim());
  };

  return (
    <div className="tourism-agent">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter place to visit..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          required
        />
        <button type="submit" disabled={loading}>
          Plan my trip
        </button>
      </form>

      {/* Display options */}
      {result && (
        <div className="display-options">
          <label>
            <input
              type="radio"
              name="displayOption"
              value="weather"
              checked={displayOption === "weather"}
              onChange={() => setDisplayOption("weather")}
            />
            Weather
          </label>
          <label style={{ marginLeft: "10px" }}>
            <input
              type="radio"
              name="displayOption"
              value="places"
              checked={displayOption === "places"}
              onChange={() => setDisplayOption("places")}
            />
            Places
          </label>
          <label style={{ marginLeft: "10px" }}>
            <input
              type="radio"
              name="displayOption"
              value="both"
              checked={displayOption === "both"}
              onChange={() => setDisplayOption("both")}
            />
            Both
          </label>
        </div>
      )}

      {loading && <p>Loading data...</p>}

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          {(displayOption === "weather" || displayOption === "both") && (
            <p>
              In {result.placeName} it’s currently{" "}
              {result.weather.temperature}°C with rainfall{" "}
              {result.weather.precipitation} mm.
            </p>
          )}

          {(displayOption === "places" || displayOption === "both") && (
            <>
              {result.places.length > 0 ? (
                <>
                  <p>And these are the places you can go:</p>
                  <ul>
                    {result.places.map((place, idx) => (
                      <li key={idx}>{place}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>No tourist attractions found nearby.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TourismAgent;
