# AI Features Documentation

## Overview

This application integrates with OpenAI's API to provide AI-powered features for content generation, analysis, and personalized recommendations. These features enhance the user experience and add value to the Urban Culture platform.

## Features

1. **Content Generation**: Creates engaging content for posts, events, and services based on user-provided keywords and style preferences.
2. **Content Analysis**: Analyzes text to extract sentiment, topics, and keywords to provide insights to users.
3. **Personalized Recommendations**: Suggests events, services, or products based on user interests.
4. **Text Completion**: Provides direct access to GPT models for free-form text generation.

## Technical Implementation

### Server-Side Components

- `server/ai.ts`: Core implementation of AI features including OpenAI API integration
- `server/routes.ts`: API endpoints that expose AI functionality to the client

### Client-Side Components

- `client/src/hooks/use-ai.tsx`: React hook that provides access to AI features
- `client/src/pages/ai/index.tsx`: Main AI tools page
- `client/src/components/ai/ContentSuggestion.tsx`: Component for content generation

## Error Handling

The application implements robust error handling for AI features to ensure graceful degradation when the OpenAI API is unavailable:

1. **API Key Validation**: The server checks for the presence of the OpenAI API key at startup and validates it before making API calls.

2. **Standardized Error Responses**: All AI endpoints return a standard error format when the API key is missing:
   ```json
   {
     "message": "AI service unavailable. Please contact administrator to set up OpenAI API key.",
     "error": "OPENAI_API_KEY_MISSING",
     "serviceStatus": "unavailable"
   }
   ```

3. **Client-Side Fallbacks**: The client-side components detect these errors and display user-friendly messages instead of crashing.

4. **Service Status Indicators**: The AI page displays a service status notice to inform users about potential service availability issues.

## Configuration

The AI features require the following environment variables:

- `OPENAI_API_KEY`: Your OpenAI API key

These variables should be set in the `.env` file or through your hosting platform's environment configuration.

## Testing

A test script (`test-ai-error-handling.js`) is provided to verify the error handling functionality. This script temporarily disables the API key and tests all endpoints to ensure they respond correctly.

## Extending AI Features

When adding new AI features, follow these guidelines:

1. Use the existing error handling pattern in both the server and client code
2. Check for API key availability using the `isAIConfigured()` function
3. Provide meaningful fallback content when AI services are unavailable
4. Update documentation to reflect your changes