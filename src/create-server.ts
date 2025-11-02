import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  generateColorScheme,
  generateCorePaletteColors,
  supportedCategories,
} from "./tools/color-scheme.js";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

function ensureHashPrefix(hex: string): string {
  const trimmed = hex.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;

  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

// Tool definitions for export
export const toolDefinitions = [
  {
    name: "get-alerts",
    description: "Get weather alerts for a state",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: {
          type: "string" as const,
          description: "Two-letter state code (e.g. CA, NY)",
          minLength: 2,
          maxLength: 2,
        },
      },
      required: ["state"],
    },
  },
  {
    name: "get-forecast",
    description: "Get weather forecast for a location",
    inputSchema: {
      type: "object" as const,
      properties: {
        latitude: {
          type: "number" as const,
          description: "Latitude of the location",
          minimum: -90,
          maximum: 90,
        },
        longitude: {
          type: "number" as const,
          description: "Longitude of the location",
          minimum: -180,
          maximum: 180,
        },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "generate_material_scheme_by_category",
    description: "Generate a Material Design color scheme using Material Color Utilities",
    inputSchema: {
      type: "object" as const,
      properties: {
        seedColor: {
          type: "string" as const,
          description: "Seed color hex code (e.g. #6200EE)",
          pattern: "^#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
        },
        category: {
          type: "string" as const,
          description: "Material color scheme category",
        },
      },
      required: ["seedColor", "category"],
    },
  },
  {
    name: "generate_corepalette_colors",
    description: "Generate the six key colors from Material Color Utilities CorePalette",
    inputSchema: {
      type: "object" as const,
      properties: {
        seedColor: {
          type: "string" as const,
          description: "Seed color hex code (e.g. #6200EE)",
          pattern: "^#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$",
        },
      },
      required: ["seedColor"],
    },
  },
];

export const createServer = () => {
  // Create server instance
  const server = new McpServer({
    name: "weather",
    version: "1.0.0",
  });

  // Register weather tools
  server.tool(
    "get-alerts",
    "Get weather alerts for a state",
    {
      state: z
        .string()
        .length(2)
        .describe("Two-letter state code (e.g. CA, NY)"),
    },
    async ({ state }) => {
      const stateCode = state.toUpperCase();
      const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
      const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

      if (!alertsData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve alerts data",
            },
          ],
        };
      }

      const features = alertsData.features || [];
      if (features.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No active alerts for ${stateCode}`,
            },
          ],
        };
      }

      const formattedAlerts = features.map(formatAlert);
      const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join(
        "\n"
      )}`;

      return {
        content: [
          {
            type: "text",
            text: alertsText,
          },
        ],
      };
    }
  );

  server.tool(
    "get-forecast",
    "Get weather forecast for a location",
    {
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .describe("Latitude of the location"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Longitude of the location"),
    },
    async ({ latitude, longitude }) => {
      // Get grid point data
      const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
        4
      )},${longitude.toFixed(4)}`;
      const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

      if (!pointsData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
            },
          ],
        };
      }

      const forecastUrl = pointsData.properties?.forecast;
      if (!forecastUrl) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to get forecast URL from grid point data",
            },
          ],
        };
      }

      // Get forecast data
      const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
      if (!forecastData) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to retrieve forecast data",
            },
          ],
        };
      }

      const periods = forecastData.properties?.periods || [];
      if (periods.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No forecast periods available",
            },
          ],
        };
      }

      // Format forecast periods
      const formattedForecast = periods.map((period: ForecastPeriod) =>
        [
          `${period.name || "Unknown"}:`,
          `Temperature: ${period.temperature || "Unknown"}°${
            period.temperatureUnit || "F"
          }`,
          `Wind: ${period.windSpeed || "Unknown"} ${
            period.windDirection || ""
          }`,
          `${period.shortForecast || "No forecast available"}`,
          "---",
        ].join("\n")
      );

      const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
        "\n"
      )}`;

      return {
        content: [
          {
            type: "text",
            text: forecastText,
          },
        ],
      };
    }
  );

  const seedColorSchema = z
    .string()
    .trim()
    .regex(/^#?(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
    .describe("Seed color hex code (e.g. #6200EE)");

  const supportedCategoryDescription = `Material color scheme category. Supported categories: ${supportedCategories()
    .map((name) => `"${name}"`)
    .join(", ")}`;


  server.tool(
    "generate_material_scheme_by_category",
    "Generate a Material Design color scheme using Material Color Utilities, by receiving a seed color and a category",
    {
      seedColor: seedColorSchema,
      category: z
        .string()
        .trim()
        .min(1)
        .describe(supportedCategoryDescription),
    },
    async ({ seedColor, category }) => {
      const formattedSeed = ensureHashPrefix(seedColor);

      try {
        const colors = await generateColorScheme({
          seedColor: formattedSeed,
          category,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(colors, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error generating color scheme";

        return {
          content: [
            {
              type: "text",
              text: `Failed to generate color scheme: ${message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "generate_corepalette_colors",
    "Generate the six key colors from Material Color Utilities CorePalette",
    {
      seedColor: seedColorSchema,
    },
    async ({ seedColor }) => {
      const formattedSeed = ensureHashPrefix(seedColor);

      try {
        const colors = await generateCorePaletteColors(formattedSeed);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(colors, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error generating core palette colors";

        return {
          content: [
            {
              type: "text",
              text: `Failed to generate core palette colors: ${message}`,
            },
          ],
        };
      }
    }
  );

  return { server };
};
