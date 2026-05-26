import express, { type Express, type Request, type Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import multer from "multer";
import { storage } from "./storage";
import { db } from "./db";
import { uploadImage, deleteImage, generateUploadSignature } from "./cloudinary";
import { verifyKvkNumber, getKvkApiStatus, verifyAndUpdateUserKvk, manuallyVerifyUserKvk, searchCompaniesByName } from "./kvk";
import { initializeWebSocketServer, notifyOrderStatusUpdate, notifyNewOrder, notifyTrackingUpdate, notifyContentShared, notifyUserWithData, NotificationType, notifyExploreImageUpdate, notifyCommentDeleted, notifyContentReported } from "./websocket";
import { createContentSuggestion, analyzeContent, getPersonalizedRecommendations, getCompletion } from "./ai";
import { ContentFilterLevel } from "@shared/schema";
import { and, or, eq, gte, lte, desc, sql } from "drizzle-orm";
import { z } from "zod";

// Rest of the routes file up to line 11862 (excluding first AI routes)
// ... (Keep all the existing code)

// Skip to line 12027 and include everything after
const httpServer = createServer(app);
  
// Initialize the WebSocket server on the HTTP server
const wss = initializeWebSocketServer(httpServer, storage);

// AI API Routes
app.post("/api/ai/suggest-content", async (req: Request, res: Response) => {
  try {
    const { contentType, keywords, style } = req.body;
    
    if (!contentType || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ 
        message: "Invalid request. Required: contentType (string) and keywords (array)" 
      });
    }
    
    const suggestion = await createContentSuggestion({
      contentType,
      keywords,
      style
    });
    
    res.json({ suggestion });
  } catch (error) {
    console.error("Error generating content suggestion:", error);
    res.status(500).json({ message: "Failed to generate content suggestion" });
  }
});

app.post("/api/ai/analyze", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ message: "Text is required for analysis" });
    }
    
    const analysis = await analyzeContent(text);
    res.json(analysis);
  } catch (error) {
    console.error("Error analyzing content:", error);
    res.status(500).json({ message: "Failed to analyze content" });
  }
});

app.post("/api/ai/recommendations", async (req: Request, res: Response) => {
  try {
    const { userInterests, itemType, count } = req.body;
    
    if (!userInterests || !Array.isArray(userInterests) || userInterests.length === 0) {
      return res.status(400).json({ message: "User interests are required" });
    }
    
    if (!itemType || !['events', 'services', 'products'].includes(itemType)) {
      return res.status(400).json({ 
        message: "Item type must be one of: events, services, products" 
      });
    }
    
    const recommendations = await getPersonalizedRecommendations({
      userInterests,
      itemType,
      count
    });
    
    res.json({ recommendations });
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({ message: "Failed to get recommendations" });
  }
});

app.post("/api/ai/completion", async (req: Request, res: Response) => {
  try {
    const { prompt, maxTokens, temperature, model } = req.body;
    
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ message: "Prompt is required" });
    }
    
    const completion = await getCompletion({
      prompt,
      maxTokens,
      temperature,
      model
    });
    
    res.json({ completion });
  } catch (error) {
    console.error("Error getting AI completion:", error);
    res.status(500).json({ message: "Failed to get AI completion" });
  }
});

return httpServer;
}