---
name: clima-santiago
description: Muestra el clima actual y el pronóstico de los próximos días para Santiago de Chile. Úsala cuando el usuario pregunte por el clima, el tiempo, la temperatura, si va a llover, o invoque /clima-santiago.
---

# Clima en Santiago de Chile

Consulta el clima de Santiago de Chile usando la API pública de Open-Meteo (gratuita, sin API key).

## Pasos

1. Obtén los datos con este comando (Bash o PowerShell, `curl` está disponible en Windows):

   ```bash
   curl -s "https://api.open-meteo.com/v1/forecast?latitude=-33.4489&longitude=-70.6693&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=America%2FSantiago&forecast_days=3"
   ```

   Si `curl` falla, usa la herramienta WebFetch con la misma URL.

2. Traduce `weather_code` (códigos WMO) a una descripción en español con emoji:

   | Código | Descripción |
   |---|---|
   | 0 | ☀️ Despejado |
   | 1, 2 | 🌤️ Mayormente despejado / parcialmente nublado |
   | 3 | ☁️ Nublado |
   | 45, 48 | 🌫️ Niebla |
   | 51, 53, 55, 56, 57 | 🌦️ Llovizna |
   | 61, 63, 65, 66, 67 | 🌧️ Lluvia (débil / moderada / fuerte) |
   | 71, 73, 75, 77 | ❄️ Nieve |
   | 80, 81, 82 | 🌧️ Chubascos |
   | 85, 86 | 🌨️ Chubascos de nieve |
   | 95, 96, 99 | ⛈️ Tormenta eléctrica |

3. Responde **en español** con este formato:

   ```
   🌎 Clima en Santiago de Chile — <fecha y hora local>

   Ahora: <emoji> <descripción>, <temp>°C (sensación <aparente>°C)
   Humedad: <humedad>% · Viento: <viento> km/h · Precipitación: <mm> mm

   Pronóstico:
   - Hoy:     <emoji> <min>°C / <max>°C · Lluvia <prob>% · UV <uv>
   - Mañana:  ...
   - <día>:   ...
   ```

4. Cierra con una recomendación breve y práctica (ej.: "Lleva paraguas", "Usa bloqueador, UV alto", "Abrígate en la mañana"). Si el UV máximo es ≥ 8, menciónalo siempre.

## Notas

- Coordenadas: Santiago centro (-33.4489, -70.6693), zona horaria `America/Santiago`.
- No inventes datos: si la API no responde, dilo y sugiere reintentar.
