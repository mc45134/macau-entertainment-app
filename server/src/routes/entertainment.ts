import { Router } from "express";
import { FetchClient, Config } from "coze-coding-dev-sdk";
import axios from "axios";

const router = Router();

const COZE_API_URL = "https://g7dchz3n3j.coze.site/stream_run";
const COZE_TOKEN = process.env.COZE_WORKLOAD_API_TOKEN || "";
const PROJECT_ID = "7643669120080216079";

// 缓存：10分钟有效
const CACHE_TTL = 10 * 60 * 1000;
const cache: Record<string, { data: any; timestamp: number }> = {};

function getCached(key: string): any | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  cache[key] = { data, timestamp: Date.now() };
}

/**
 * 调用 Coze 智能体获取实时信息（非流式，收集完整响应）
 */
async function queryCozeAgent(prompt: string): Promise<string> {
  const sessionId = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const response = await fetch(COZE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COZE_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      content: {
        query: {
          prompt: [{ type: "text", content: { text: prompt } }],
        },
      },
      type: "query",
      session_id: sessionId,
      project_id: PROJECT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`Coze API error: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split("\n");
  let fullContent = "";

  // Coze stream_run SSE 格式: 
  // event: message
  // data: {"answer": "增量文字", "thinking": null, ...}
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 只处理 data: 开头的行
    if (!trimmed.startsWith("data:")) continue;
    
    const dataText = trimmed.slice(5).trim();
    if (!dataText || dataText === "[DONE]") continue;

    try {
      const parsed = JSON.parse(dataText);

      // Coze stream_run 格式: 
      // { type: "answer", content: { answer: "增量文字" } }
      if (parsed.type === "answer" && parsed.content && parsed.content.answer) {
        fullContent += parsed.content.answer;
      }
    } catch {
      // 非JSON行跳过
    }
  }

  console.log("[Coze Agent] Full response length:", fullContent.length);
  console.log("[Coze Agent] First 500 chars:", fullContent.slice(0, 500));
  return fullContent;
}

/**
 * 从AI回复中提取JSON数组
 */
function extractJSONArray(text: string): any[] {
  // 尝试直接解析
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr;
  } catch {
    // 继续
  }

  // 尝试提取 ```json ... ``` 代码块
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      const arr = JSON.parse(jsonBlockMatch[1]);
      if (Array.isArray(arr)) return arr;
    } catch {
      // 继续
    }
  }

  // 尝试提取 [...] 部分
  const bracketMatch = text.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      const arr = JSON.parse(bracketMatch[0]);
      if (Array.isArray(arr)) return arr;
    } catch {
      // 继续
    }
  }

  return [];
}

// 从 URL 抓取文本内容
async function fetchUrlContent(url: string): Promise<string> {
  try {
    const config = new Config();
    const client = new FetchClient(config);
    const result = await client.fetch(url);
    const texts = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
    return texts.slice(0, 8000);
  } catch (e) {
    console.error("Failed to fetch URL:", url, e);
    return "";
  }
}

// 从 URL 抓取图片列表
async function fetchUrlImages(url: string): Promise<string[]> {
  try {
    const config = new Config();
    const client = new FetchClient(config);
    const result = await client.fetch(url);
    const images = result.content
      .filter((c: any) => c.type === "image" && c.image?.display_url)
      .map((c: any) => c.image.display_url as string)
      .filter((url: string) => url.length > 0);
    return images;
  } catch (e) {
    console.error("Failed to fetch images from URL:", url, e);
    return [];
  }
}

// Fallback 图片池
const headlineImagePool = [
  "https://images.unsplash.com/photo-1596443686990-e064cfec31e4?w=800&q=80",
  "https://images.unsplash.com/photo-1501084823326-987e8a6ab5a3?w=800&q=80",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80",
  "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&q=80",
];

const movieImagePool = [
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&q=80",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80",
  "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400&q=80",
  "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?w=400&q=80",
  "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=400&q=80",
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&q=80",
];

const concertImagePool = [
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80",
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80",
  "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&q=80",
  "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=400&q=80",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=80",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80",
];

// 为每条数据分配不同的图片
function getImageForIndex(pool: string[], index: number): string {
  return pool[index % pool.length];
}

const commonQuestions = [
  { id: "1", question: "澳门有哪些必去的景点？" },
  { id: "2", question: "如何办理澳门签证？" },
  { id: "3", question: "澳门有哪些好吃的葡式餐厅？" },
  { id: "4", question: "澳门娱乐场营业时间？" },
  { id: "5", question: "从珠海到澳门怎么走？" },
  { id: "6", question: "澳门有哪些适合家庭的活动？" },
];

// GET /api/v1/entertainment/headlines - Get entertainment headlines (real-time from AI)
router.get("/headlines", async (req, res) => {
  const cached = getCached("headlines");
  if (cached) {
    res.json(cached);
    return;
  }
  try {
    // 抓取澳门新闻网站的真实图片
    const headlineImages = await fetchUrlImages("https://www.exmoo.com");

    const aiResult = await queryCozeAgent(
      "现在是2026年5月。请搜索并列出澳门最新的5条娱乐头条新闻（必须是2026年的最新消息），包括标题、摘要、分类。请严格以JSON数组格式返回，格式如下：\n[{\"title\":\"标题\",\"summary\":\"摘要\",\"category\":\"分类\",\"image\":\"图片URL\"}]\n如果有相关图片请提供URL，没有则留空。只返回JSON，不要其他文字。务必搜索最新资讯，不要编造旧数据。"
    );

    let headlines = extractJSONArray(aiResult);

    // 为每条头条添加ID和图片
    headlines = headlines.slice(0, 6).map((item: any, index: number) => ({
      id: String(index + 1),
      title: item.title || "未知标题",
      summary: item.summary || item.content || "",
      category: item.category || "娱乐",
      image: item.image || headlineImages[index] || getImageForIndex(headlineImagePool, index),
      publishTime: new Date().toISOString(),
    }));

    const result = {
      code: 0,
      data: {
        headlines,
        updateTime: new Date().toISOString(),
      },
    };
    setCache("headlines", result);
    res.json(result);
  } catch (error) {
    console.error("Failed to fetch headlines from AI:", error);
    res.json({
      code: 0,
      data: {
        headlines: [],
        updateTime: new Date().toISOString(),
        error: "获取实时数据失败",
      },
    });
  }
});

// GET /api/v1/entertainment/movies - Get movie recommendations (real-time from AI)
router.get("/movies", async (req, res) => {
  const cached = getCached("movies");
  if (cached) {
    res.json(cached);
    return;
  }
  try {
    // 先抓取 macaumovie.com 的真实数据和海报图片
    const [websiteContent, moviePosters] = await Promise.all([
      fetchUrlContent("https://macaumovie.com/tc"),
      fetchUrlImages("https://macaumovie.com/tc"),
    ]);
    const contextPart = websiteContent
      ? `\n\n以下是 macaumovie.com 网站的内容，请从中提取澳门电影院正在上映的电影信息：\n${websiteContent}`
      : "";
    const posterInfo = moviePosters.length > 0
      ? `\n\n以下是 macaumovie.com 网站上的图片URL（按顺序对应电影），请按顺序使用这些图片作为poster：\n${moviePosters.map((url, i) => `电影${i + 1}: ${url}`).join("\n")}`
      : "";

    const aiResult = await queryCozeAgent(
      `现在是2026年5月。请列出澳门目前正在上映的5部电影，必须包含片名、评分、类型、时长、影院和场次。请严格以JSON数组格式返回，格式如下：\n[{"title":"片名","rating":9.0,"genre":"类型","duration":"120分钟","cinema":"影院名","showtimes":["14:00","17:30","21:00"],"poster":"海报图片URL"}]\n请务必使用真实数据，不要编造。只返回JSON，不要其他文字。${contextPart}${posterInfo}`
    );

    let movies = extractJSONArray(aiResult);

    movies = movies.slice(0, 6).map((item: any, index: number) => ({
      id: String(index + 1),
      title: item.title || "未知电影",
      rating: item.rating || 0,
      genre: item.genre || "未知",
      duration: item.duration || "未知",
      cinema: item.cinema || "未知影院",
      showtimes: Array.isArray(item.showtimes) ? item.showtimes : [],
      poster: item.poster || item.image || moviePosters[index] || getImageForIndex(movieImagePool, index),
    }));

    const result = {
      code: 0,
      data: { movies },
    };
    setCache("movies", result);
    res.json(result);
  } catch (error) {
    console.error("Failed to fetch movies from AI:", error);
    res.json({
      code: 0,
      data: { movies: [], error: "获取实时数据失败" },
    });
  }
});

// GET /api/v1/entertainment/concerts - Get concert info (directly from macauticket.com)
router.get("/concerts", async (req, res) => {
  const cached = getCached("concerts");
  if (cached) {
    res.json(cached);
    return;
  }
  try {
    const concerts: any[] = [];

    // 用 axios 直接抓取 macauticket.com（超时15秒）
    try {
      const listResp = await axios.get(
        "https://www.macauticket.com/TicketWeb2023/eventAndActivities?cat=Music",
        { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }
      );
      const html = listResp.data as string;

      // 从列表页提取节目ID和图片
      const programmeRegex = /programme\/(P-\d+)/g;
      const programmeIds: string[] = [];
      let m;
      while ((m = programmeRegex.exec(html)) !== null) {
        if (!programmeIds.includes(m[1])) programmeIds.push(m[1]);
      }

      // 提取列表页图片（macauticket.com 使用 /Image/Ticket/Show/ 路径）
      const imgRegex = /src="(https?:\/\/www\.macauticket\.com\/Image\/Ticket\/Show\/[^"]+)"/g;
      const listImages: string[] = [];
      let imgM;
      while ((imgM = imgRegex.exec(html)) !== null) {
        listImages.push(imgM[1]);
      }

      // 抓取每个节目的详情
      const maxProgrammes = Math.min(programmeIds.length, 6);
      for (let i = 0; i < maxProgrammes; i++) {
        try {
          const detailResp = await axios.get(
            `https://www.macauticket.com/TicketWeb2023/programme/${programmeIds[i]}`,
            { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }
          );
          const detailHtml = detailResp.data as string;

          // 提取标题
          const titleMatch = detailHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
          // 提取日期时间
          const dateMatch = detailHtml.match(/(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})/);
          // 提取价格
          const priceMatch = detailHtml.match(/\$[\d,]+(?:\s*[-~]\s*\$?[\d,]*)*/);
          // 提取场馆
          const venueMatch = detailHtml.match(/([\u4e00-\u9fff]+(?:劇院|剧院|中心|館|馆|廳|厅|酒店|場|场|舞台))/);
          // 提取详情页图片
          const detailImgMatch = detailHtml.match(/src="(https?:\/\/www\.macauticket\.com\/Image\/Ticket\/Show\/[^"]+)"/) 
            || detailHtml.match(/src="(\/Image\/Ticket\/Show\/[^"]+)"/);
          const detailImg = detailImgMatch 
            ? (detailImgMatch[1].startsWith("http") ? detailImgMatch[1] : `https://www.macauticket.com${detailImgMatch[1]}`)
            : "";

          const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
          if (title) {
            concerts.push({
              id: String(i + 1),
              artist: title,
              venue: venueMatch ? venueMatch[1].trim() : "澳门",
              date: dateMatch ? dateMatch[1] : "待定",
              time: dateMatch ? dateMatch[2] : "待定",
              price: priceMatch ? `MOP ${priceMatch[0]}` : "待定",
              status: "售票中",
              poster: detailImg || listImages[i] || getImageForIndex(concertImagePool, i),
            });
          }
        } catch (e) {
          console.error(`Failed to fetch programme ${programmeIds[i]}:`, (e as Error).message);
        }
      }
    } catch (e) {
      console.error("Failed to fetch macauticket.com list:", (e as Error).message);
    }

    // 如果直接抓取失败，fallback 到 AI + FetchClient 图片
    if (concerts.length === 0) {
      const concertImages = await fetchUrlImages("https://www.macauticket.com");
      const aiResult = await queryCozeAgent(
        "现在是2026年5月。请搜索 macauticket.com 上澳门2026年5月和6月正在售票的演唱会，包括演出名、场馆、日期、票价和售票状态。请严格以JSON数组格式返回：\n[{\"artist\":\"演出名\",\"venue\":\"场馆\",\"date\":\"2026-06-15\",\"time\":\"20:00\",\"price\":\"MOP 880-2880\",\"status\":\"售票中\",\"poster\":\"\"}]\n只返回JSON。"
      );
      const aiConcerts = extractJSONArray(aiResult);
      aiConcerts.slice(0, 6).forEach((item: any, index: number) => {
        concerts.push({
          id: String(index + 1),
          artist: item.artist || item.title || "未知演出",
          venue: item.venue || "未知场馆",
          date: item.date || "待定",
          time: item.time || "待定",
          price: item.price || "待定",
          status: item.status || "未知",
          poster: item.poster || item.image || concertImages[index] || getImageForIndex(concertImagePool, index),
        });
      });
    }

    const result = {
      code: 0,
      data: { concerts },
    };
    setCache("concerts", result);
    res.json(result);
  } catch (error) {
    console.error("Failed to fetch concerts from AI:", error);
    res.json({
      code: 0,
      data: { concerts: [], error: "获取实时数据失败" },
    });
  }
});

// GET /api/v1/entertainment/questions - Get common questions
router.get("/questions", (req, res) => {
  res.json({
    code: 0,
    data: { questions: commonQuestions },
  });
});

export default router;
