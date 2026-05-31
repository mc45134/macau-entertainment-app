/**
 * AssemblyAI 语音识别服务 (STT)
 * 支持中文、粤语、英文
 */

import axios from "axios";

// AssemblyAI API 配置
const ASSEMBLYAI_API_URL = "https://api.assemblyai.com/v2";
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || "";

/**
 * 上传音频文件到 AssemblyAI
 */
async function uploadAudio(audioBuffer: Buffer): Promise<string> {
  const response = await axios.post(`${ASSEMBLYAI_API_URL}/upload`, audioBuffer, {
    headers: {
      "Authorization": ASSEMBLYAI_API_KEY,
      "Content-Type": "application/octet-stream",
    },
  });
  return response.data.upload_url;
}

/**
 * 提交转录任务
 */
async function submitTranscription(audioUrl: string): Promise<string> {
  const response = await axios.post(
    `${ASSEMBLYAI_API_URL}/transcript`,
    {
      audio_url: audioUrl,
      // 自动检测语言（支持中文、粤语、英文）
      language_detection: true,
      // 标点符号
      punctuate: true,
      // 自动格式化
      format_text: true,
    },
    {
      headers: {
        "Authorization": ASSEMBLYAI_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data.id;
}

/**
 * 获取转录结果
 */
async function getTranscriptionResult(transcriptId: string): Promise<{
  status: string;
  text?: string;
  error?: string;
}> {
  const response = await axios.get(
    `${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`,
    {
      headers: {
        "Authorization": ASSEMBLYAI_API_KEY,
      },
    }
  );
  return response.data;
}

/**
 * 等待转录完成
 */
async function waitForTranscription(transcriptId: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getTranscriptionResult(transcriptId);
    
    if (result.status === "completed") {
      return result.text || "";
    }
    
    if (result.status === "error") {
      throw new Error(`Transcription error: ${result.error}`);
    }
    
    // 等待 2 秒
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  
  throw new Error("Transcription timeout");
}

/**
 * 语音转文字主函数
 * @param audioBuffer 音频数据的 Buffer
 * @returns 识别的文字
 */
export async function speechToText(audioBuffer: Buffer): Promise<string> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error("ASSEMBLYAI_API_KEY is not configured");
  }
  
  // 1. 上传音频
  const uploadUrl = await uploadAudio(audioBuffer);
  
  // 2. 提交转录任务
  const transcriptId = await submitTranscription(uploadUrl);
  
  // 3. 等待并获取结果
  const text = await waitForTranscription(transcriptId);
  
  return text;
}

/**
 * 语音转文字（流式上传版本）
 * 适用于大文件或实时场景
 */
export async function speechToTextStream(
  audioData: string, // base64 编码的音频数据
  mimeType: string = "audio/webm"
): Promise<string> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error("ASSEMBLYAI_API_KEY is not configured");
  }
  
  // 解码 base64
  const buffer = Buffer.from(audioData, "base64");
  
  return speechToText(buffer);
}

export default {
  speechToText,
  speechToTextStream,
};
