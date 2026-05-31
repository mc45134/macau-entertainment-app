import { Router } from "express";
import axios from "axios";
import { isEntertainmentRelated, getFilterResponse } from "../services/macauSkill";

const router = Router();

// Custom Coze proxy API configuration
const CUSTOM_API_URL = process.env.CUSTOM_COZE_API_URL || "https://g7dchz3n3j.coze.site/stream_run";
const CUSTOM_API_TOKEN = process.env.COZE_WORKLOAD_API_TOKEN || "";
const CUSTOM_PROJECT_ID = process.env.CUSTOM_COZE_PROJECT_ID || "7643669120080216079";

// Build headers for custom API
const buildHeaders = () => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${CUSTOM_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  return headers;
};

// Generate a simple session ID
const generateSessionId = () => {
  return "sess_" + Math.random().toString(36).substring(2, 15);
};

// Session storage for conversation context (in-memory, resets on server restart)
const sessions: Record<string, { messages: { role: string; content: string }[]; interests: string[] }> = {};

const getSession = (sessionId: string) => {
  if (!sessions[sessionId]) {
    sessions[sessionId] = { messages: [], interests: [] };
  }
  return sessions[sessionId];
};

// Call Coze API (non-streaming) to get recommendations
const getRecommendations = async (session: { messages: { role: string; content: string }[]; interests: string[] }): Promise<{ tags: string[]; items: { title: string; reason: string }[] } | null> => {
  try {
    // Get last assistant message for context-aware recommendations
    const lastAssistantMsg = [...session.messages].reverse().find(m => m.role === "assistant");
    const lastUserQuestion = [...session.messages].reverse().find(m => m.role === "user");

    const recentContext = lastAssistantMsg 
      ? `\n\n【AI助手刚刚回答的内容】\n${lastAssistantMsg.content.slice(-1000)}`
      : "";

    const userQ = lastUserQuestion?.content || "用户提问";

    const prompt = `你是澳门娱乐咨询APP的智能推荐引擎。请根据用户刚才的对话，生成高度相关的个性化推荐。

用户刚问了：${userQ}
${recentContext}

要求：
1. 兴趣标签必须准确反映这次对话的主题（如AI回答了美食→标签是"澳门美食、葡式料理"）
2. 推荐内容必须与AI回答的实际内容直接相关
   - 如果AI回答了具体餐厅/美食 → 推荐该餐厅或同类美食节
   - 如果AI回答了演唱会/电影 → 推荐具体的演出或影片  
   - 如果AI回答了景点/活动 → 推荐相关活动或周边信息
3. 推荐理由要引用AI回答中的具体细节

已知兴趣：${session.interests.join(", ") || "暂无"}

只返回JSON：
{
  "tags": ["准确标签1", "准确标签2"],
  "items": [
    {"title": "与回答直接相关的具体名称", "reason": "引用AI回答的具体信息的推荐理由"},
    {"title": "与回答直接相关的具体名称", "reason": "引用AI回答的具体信息的推荐理由"},
    {"title": "与回答直接相关的具体名称", "reason": "引用AI回答的具体信息的推荐理由"}
  ]}

只返回JSON，不要其他文字。`;

    const response = await fetch(CUSTOM_API_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify({
        content: { query: { prompt: [{ type: "text", content: { text: prompt } }] } },
        type: "query",
        session_id: "rec_" + generateSessionId(),
        project_id: CUSTOM_PROJECT_ID,
      }),
    });

    if (!response.ok) return null;

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullAnswer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          const dataText = trimmed.slice(5).trim();
          if (dataText === "[DONE]") continue;
          try {
            const parsed = JSON.parse(dataText);
            if (parsed.type === "answer" && parsed.content?.answer) {
              fullAnswer += parsed.content.answer;
            } else if (parsed.content?.answer) {
              fullAnswer += parsed.content.answer;
            }
          } catch {
            // skip
          }
        }
      }
    }

    // Parse JSON from answer
    const jsonMatch = fullAnswer.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (e) {
    console.error("Recommendation error:", e);
    return null;
  }
};

// POST /api/v1/chat - Send message to Coze Bot (Streaming)
router.post("/", async (req, res) => {
  try {
    const { message, session_id = generateSessionId() } = req.body;

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // 澳门娱乐内容过滤
    if (!isEntertainmentRelated(message)) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.write(`data: ${JSON.stringify({ type: "answer", content: getFilterResponse() })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const session = getSession(session_id);
    session.messages.push({ role: "user", content: message });

    console.log("Chat request received:", { message: message.substring(0, 50), session_id });

    // Build request body for custom API
    const requestBody = {
      content: {
        query: {
          prompt: [
            {
              type: "text",
              content: {
                text: message,
              },
            },
          ],
        },
      },
      type: "query",
      session_id: session_id,
      project_id: CUSTOM_PROJECT_ID,
    };

    const response = await fetch(CUSTOM_API_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Custom API error:", response.status, errorText);
      res.status(response.status).json({ error: "API error", details: errorText });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform, must-revalidate");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Stream the response to client
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let currentEvent = "";
    let fullResponse = "";

    const pump = () => {
      reader.read().then(async ({ done, value }) => {
        if (done) {
          if (!fullResponse) {
            res.write(`data: ${JSON.stringify({ type: "answer", content: "抱歉，暂时无法回答，请稍后再试。" })}\n\n`);
          }

          // Save assistant response to session
          session.messages.push({ role: "assistant", content: fullResponse });

          // After main answer, fetch recommendations (non-blocking)
          try {
            const recommendations = await getRecommendations(session);
            if (recommendations) {
              // Update interests
              if (recommendations.tags && recommendations.tags.length > 0) {
                session.interests = [...new Set([...session.interests, ...recommendations.tags])].slice(0, 10);
              }
              // Send recommendations as a separate event
              res.write(`data: ${JSON.stringify({ type: "recommendations", content: recommendations })}\n\n`);
            }
          } catch (e) {
            console.error("Failed to get recommendations:", e);
          }

          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "") {
            currentEvent = "";
            continue;
          }
          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice("event:".length).trim();
            continue;
          }
          if (trimmed.startsWith("data:")) {
            const dataText = trimmed.slice(5).trim();
            if (dataText === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataText);
              
              // Extract content from the response
              if (currentEvent === "message" && parsed.type === "answer") {
                const answer = parsed.content?.answer;
                if (answer) {
                  fullResponse += answer;
                  res.write(`data: ${JSON.stringify({ type: "answer", content: answer })}\n\n`);
                }
              } else if (parsed.content?.answer) {
                fullResponse += parsed.content.answer;
                res.write(`data: ${JSON.stringify({ type: "answer", content: parsed.content.answer })}\n\n`);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        pump();
      }).catch((err) => {
        console.error("Stream error:", err);
        if (!fullResponse) {
          res.write(`data: ${JSON.stringify({ type: "answer", content: "抱歉，发生了错误，请稍后再试。" })}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        res.end();
      });
    };

    pump();
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/chat/preferences/:session_id - Get user preferences
router.get("/preferences/:session_id", (req, res) => {
  const session = sessions[req.params.session_id];
  res.json({
    interests: session?.interests || [],
    messageCount: session?.messages.length || 0,
  });
});

// POST /api/v1/chat/recommend - Get personalized recommendations
router.post("/recommend", async (req, res) => {
  try {
    const { message, aiResponse } = req.body;
    if (!message) {
      res.json({ recommendations: [], interests: [] });
      return;
    }

    // Build context with both user question and AI answer for more relevant recommendations
    const contextText = aiResponse 
      ? `\n\nAI助手的回答：${aiResponse.slice(-800)}`
      : "";

    // Use AI to analyze user interests and generate recommendations based on full context
    const cozePayload = {
      content: {
        query: {
          prompt: [{ type: "text", content: { text: `用户在澳门娱乐咨询APP中问了："${message}"${contextText}

请根据以上完整对话内容，分析用户真正感兴趣的内容，并从AI回答中提取关键信息，生成3个最相关的个性化推荐。

要求：
- 推荐必须与AI回答的实际内容高度相关（比如AI回答了美食，就推荐具体餐厅/美食节；回答了演唱会，就推荐具体演出）
- 兴趣标签要准确反映对话主题
- 推荐理由要引用AI回答中的具体信息

请严格按以下JSON格式返回，不要有任何其他文字：
{"interests":["兴趣1","兴趣2"],"recommendations":[{"title":"具体名称","reason":"结合AI回答的具体推荐理由","type":"concert|movie|event"}]}` } }],
        },
      },
      type: "query",
      session_id: `reco_${Date.now()}`,
      project_id: "7643669120080216079",
    };

    let fullAnswer = "";
    const cozeResponse = await axios.post(
      "https://g7dchz3n3j.coze.site/stream_run",
      cozePayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.COZE_WORKLOAD_API_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        responseType: "stream",
        timeout: 30000,
      }
    );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("timeout")), 25000);
      cozeResponse.data.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data:")) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.type === "answer" && data.content?.answer) {
                fullAnswer += data.content.answer;
              }
            } catch {}
          }
        }
      });
      cozeResponse.data.on("end", () => { clearTimeout(timeout); resolve(); });
      cozeResponse.data.on("error", () => { clearTimeout(timeout); resolve(); });
    });

    // Parse AI response
    let result = { recommendations: [], interests: [] as string[] };
    try {
      const jsonMatch = fullAnswer.match(/\{[\s\S]*\}/);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch {}

    res.json(result);
  } catch (error) {
    console.error("Recommend error:", error);
    res.json({ recommendations: [], interests: [] });
  }
});

export default router;
