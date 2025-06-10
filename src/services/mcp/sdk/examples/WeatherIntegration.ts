/**
 * Example MCP Integration: Weather Service
 * 
 * This example demonstrates how to create a custom MCP integration
 * using the SessionHub MCP SDK.
 */

import { MCPIntegrationSDK } from '../MCPIntegrationSDK';
import { MCPExecutionContext, MCPExecutionResult } from '../../server/types';

// Create the Weather Service integration
export const WeatherIntegration = MCPIntegrationSDK.createIntegration()
  .setName('Weather Service')
  .setVersion('1.0.0')
  .setDescription('Get weather information for any location')
  .setAuthor('SessionHub Examples')
  .setCategory('other')
  .setIcon('🌤️')
  .addPermission('network') // Need network access for API calls
  
  // Add the getCurrentWeather tool
  .addTool(
    MCPIntegrationSDK.createTool()
      .setName('getCurrentWeather')
      .setDescription('Get current weather for a specific location')
      .setInputSchema(
        MCPIntegrationSDK.schema.object({
          location: MCPIntegrationSDK.schema.string(
            'City name or coordinates (e.g., "New York" or "40.7,-74.0")'
          ),
          units: MCPIntegrationSDK.schema.string(
            'Temperature units',
            ['celsius', 'fahrenheit', 'kelvin']
          )
        }, ['location'])
      )
      .setOutputSchema(
        MCPIntegrationSDK.schema.object({
          temperature: MCPIntegrationSDK.schema.number('Current temperature'),
          description: MCPIntegrationSDK.schema.string('Weather description'),
          humidity: MCPIntegrationSDK.schema.number('Humidity percentage'),
          windSpeed: MCPIntegrationSDK.schema.number('Wind speed'),
          location: MCPIntegrationSDK.schema.string('Location name')
        })
      )
      .addExample(
        'New York Weather',
        { location: 'New York', units: 'fahrenheit' },
        {
          temperature: 72,
          description: 'Partly cloudy',
          humidity: 65,
          windSpeed: 8.5,
          location: 'New York, NY'
        }
      )
      .setRateLimit(60, 60) // 60 requests per minute
      .build()
  )
  
  // Add the getForecast tool
  .addTool(
    MCPIntegrationSDK.createTool()
      .setName('getForecast')
      .setDescription('Get weather forecast for the next 5 days')
      .setInputSchema(
        MCPIntegrationSDK.schema.object({
          location: MCPIntegrationSDK.schema.string('City name or coordinates'),
          days: MCPIntegrationSDK.schema.number('Number of days (1-5)', 1, 5),
          units: MCPIntegrationSDK.schema.string(
            'Temperature units',
            ['celsius', 'fahrenheit', 'kelvin']
          )
        }, ['location'])
      )
      .setOutputSchema(
        MCPIntegrationSDK.schema.object({
          location: MCPIntegrationSDK.schema.string('Location name'),
          forecast: MCPIntegrationSDK.schema.array(
            MCPIntegrationSDK.schema.object({
              date: MCPIntegrationSDK.schema.string('Date (YYYY-MM-DD)'),
              high: MCPIntegrationSDK.schema.number('High temperature'),
              low: MCPIntegrationSDK.schema.number('Low temperature'),
              description: MCPIntegrationSDK.schema.string('Weather description'),
              precipitation: MCPIntegrationSDK.schema.number('Precipitation chance %')
            })
          )
        })
      )
      .setRateLimit(30, 60) // 30 requests per minute
      .build()
  )
  
  // Add configuration for API key
  .setConfig({
    apiKey: process.env['WEATHER_API_KEY'] || '',
    baseUrl: 'https://api.openweathermap.org/data/2.5'
  })
  
  .build();

// Implementation of the weather service
export class WeatherServiceImplementation {
  constructor(config: any) {
    // TODO: Use config.apiKey and config.baseUrl in actual implementation
    // API key will be used for authentication in the actual implementation
    void config; // Suppress unused parameter warning
  }

  async executeToolCall(
    context: MCPExecutionContext
  ): Promise<MCPExecutionResult> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (context.tool) {
        case 'getCurrentWeather':
          result = await this.getCurrentWeather(context.params);
          break;
        
        case 'getForecast':
          result = await this.getForecast(context.params);
          break;
        
        default:
          throw new Error(`Unknown tool: ${context.tool}`);
      }

      return {
        success: true,
        data: result,
        metrics: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'WEATHER_API_ERROR',
          message: error.message,
          details: error
        },
        metrics: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  private async getCurrentWeather(params: any): Promise<any> {
    // In a real implementation, this would call the OpenWeatherMap API
    // For this example, we'll return mock data
    
    const units = params.units || 'celsius';
    const temp = units === 'fahrenheit' ? 72 : units === 'kelvin' ? 295 : 22;
    
    return {
      temperature: temp,
      description: 'Partly cloudy',
      humidity: 65,
      windSpeed: 8.5,
      location: params.location
    };
  }

  private async getForecast(params: any): Promise<any> {
    // Mock forecast data
    const days = params.days || 3;
    const forecast = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      forecast.push({
        date: date.toISOString().split('T')[0],
        high: 75 + Math.random() * 10,
        low: 60 + Math.random() * 10,
        description: ['Sunny', 'Partly cloudy', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 4)],
        precipitation: Math.floor(Math.random() * 100)
      });
    }
    
    return {
      location: params.location,
      forecast
    };
  }
}

// Example of how to register this integration with the MCP server
export async function registerWeatherIntegration(mcpServer: any): Promise<void> {
  // Validate the integration
  const errors = MCPIntegrationSDK.validate.integration(WeatherIntegration);
  if (errors.length > 0) {
    throw new Error(`Integration validation failed: ${errors.join(', ')}`);
  }

  // Register the integration
  await mcpServer.registerIntegration(WeatherIntegration);
  
  // Register the implementation handler
  const implementation = new WeatherServiceImplementation(WeatherIntegration.config);
  mcpServer.registerHandler('Weather Service', (tool: string, params: any, context: MCPExecutionContext) => {
    return implementation.executeToolCall({ ...context, tool, params });
  });
  
// REMOVED: console statement
}

// Test the integration
if (require.main === module) {
  (async () => {
    // Create test harness
    const harness = MCPIntegrationSDK.createTestHarness(WeatherIntegration);
    
    // Test getCurrentWeather
    await harness.testTool('getCurrentWeather', {
      location: 'San Francisco',
      units: 'celsius'
    });
    
    // Test getForecast
    await harness.testTool('getForecast', {
      location: 'San Francisco',
      days: 3,
      units: 'celsius'
    });
  })();
}