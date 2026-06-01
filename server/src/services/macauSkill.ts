/**
 * 澳门娱乐资讯技能服务
 * 负责过滤非澳门娱乐相关的用户输入
 */

// 娱乐相关关键词
const ENTERTAINMENT_KEYWORDS = [
  // 电影 & 影院
  "电影", "影院", "上映", "票房", "影评", "预告片",
  "导演", "演员", "好莱坞", "港片", "国产片", "片",
  
  // 演唱会 & 音乐会
  "演唱会", "音乐会", "歌", "歌手", "乐团", "乐队",
  "音乐", "演出", "门票", "票价", "票务", "演唱",
  
  // 表演 & 秀场
  "舞台剧", "歌舞剧", "话剧", "戏剧", "表演", "秀",
  "魔术", "魔术秀", "脱口秀", "相声", "小品", "相声",
  "马戏团", "杂技", "舞蹈", "芭蕾", "表演",
  
  // 展览 & 活动
  "展览", "博览会", "博物馆", "艺术展", "画展", "展会",
  "摄影展", "设计展", "动漫展", "游戏展", "会展",
  
  // 体育 & 赛事
  "赛事", "比赛", "赛车", "大赛车", "格兰披治",
  "足球", "篮球", "网球", "拳击", "格斗", "体育",
  
  // 娱乐场所
  "剧院", "表演厅", "威尼斯人", "银河", "新濠",
  "永利", "葡京", "娱乐场", "赌场", "度假村",
  
  // 节庆 & 夜生活
  "节庆", "嘉年华", "烟花", "派对", "夜生活",
  "酒吧", "夜店", "club",
  
  // 电竞 & 游戏
  "电竞", "游戏展", "动漫", "cosplay", "游戏",
];

// 澳门相关词
const MACAU_KEYWORDS = ["澳门", "macau", "macao", "氹仔", "路氹"];

// 过滤响应
const FILTER_RESPONSE = `您好！我是澳门娱乐资讯助手 😊

本应用专为提供澳门娱乐相关资讯而设计，包括：
• 🎬 最新电影上映信息
• 🎤 演唱会及音乐活动
• 🎭 舞台表演、魔术秀
• 🖼️ 艺术展览及节庆活动
• ⚽ 体育赛事资讯

❌ 您的问题似乎与澳门娱乐无关。

请告诉我您想了解哪方面的澳门娱乐资讯，我会尽力为您提供帮助！🎭`;

/**
 * 检查消息是否与澳门娱乐相关
 */
export function isEntertainmentRelated(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // 检查澳门关键词
  const hasMacauKeyword = MACAU_KEYWORDS.some(k => 
    lowerMessage.includes(k.toLowerCase())
  );
  
  // 检查娱乐关键词
  const hasEntertainmentKeyword = ENTERTAINMENT_KEYWORDS.some(k =>
    lowerMessage.includes(k.toLowerCase())
  );
  
  // 如果包含澳门 + 娱乐关键词
  if (hasMacauKeyword && hasEntertainmentKeyword) {
    return true;
  }
  
  // 如果只有娱乐关键词（可能是通用询问）
  if (hasEntertainmentKeyword) {
    return true;
  }
  
  // 如果只有澳门关键词
  if (hasMacauKeyword) {
    return true;
  }
  
  return false;
}

/**
 * 获取过滤响应
 */
export function getFilterResponse(): string {
  return FILTER_RESPONSE;
}

export default {
  isEntertainmentRelated,
  getFilterResponse,
};
