/**
 * 语音识别 API 路由
 * POST /api/v1/stt - 语音转文字
 */

import { Router } from "express";
import { speechToTextStream } from "../services/assemblyAI";

const router = Router();

// POST /api/v1/stt - 语音转文字
router.post("/", async (req, res) => {
  try {
    const { audio, mimeType } = req.body;

    if (!audio) {
      res.status(400).json({ error: "Audio data is required" });
      return;
    }

    console.log("STT request received, audio length:", audio.length);

    // 调用 AssemblyAI 进行语音识别
    const text = await speechToTextStream(audio, mimeType || "audio/webm");

    console.log("STT result:", text);

    res.json({
      success: true,
      text: text,
    });
  } catch (error) {
    console.error("STT error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Speech recognition failed",
    });
  }
});

export default router;
