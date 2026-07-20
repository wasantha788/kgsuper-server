import express from 'express';
import aiChatController from '../controllers/aiChatController.js'; 

const aiRouter = express.Router();

// This matches the axios.post("/api/ai/chat", ...) in your frontend
aiRouter.post('/chat', aiChatController);

export default aiRouter;