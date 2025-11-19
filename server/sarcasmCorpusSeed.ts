import type { InsertSarcasmCorpus } from "../drizzle/schema";

/**
 * 台灣市場反串語料庫種子資料
 * 來源：PTT、Dcard 常見反串用語
 */
export const taiwanSarcasmExamples: Omit<InsertSarcasmCorpus, "id" | "createdBy" | "createdAt" | "updatedAt">[] = [
  {
    market: "taiwan",
    platform: "PTT",
    text: "超棒der，根本神作",
    explanation: "「der」是台灣網路用語，常用於反串。當搭配過度誇張的正面詞彙時，通常表示諷刺。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "PTT",
    text: "真香",
    explanation: "源自中國網路迷因，在台灣常用於諷刺「打臉」情況，表面說好但實際不好。",
    category: "irony",
  },
  {
    market: "taiwan",
    platform: "Dcard",
    text: "還行啦，勉強能用",
    explanation: "台灣常見的輕描淡寫（understatement），實際上可能非常滿意或非常不滿意，需看上下文。",
    category: "understatement",
  },
  {
    market: "taiwan",
    platform: "PTT",
    text: "笑死，業配文喔",
    explanation: "「笑死」是台灣網路用語，表示嘲諷。暗示內容是廣告而非真實評價。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "Dcard",
    text: "好啦好啦，你最棒",
    explanation: "重複「好啦」並搭配誇張稱讚，通常表示不耐煩或諷刺。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "PTT",
    text: "484業配？",
    explanation: "「484」是「是不是」的諧音，質疑是否為業配（業務配合、廣告）。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "Dcard",
    text: "呵呵，懂的都懂",
    explanation: "「呵呵」通常表示冷笑或諷刺，「懂的都懂」暗示有隱藏訊息。",
    category: "irony",
  },
  {
    market: "taiwan",
    platform: "PTT",
    text: "太神啦，跪求教學",
    explanation: "過度誇張的崇拜語氣，常用於反串，實際上可能在嘲諷。",
    category: "exaggeration",
  },
  {
    market: "taiwan",
    platform: "Dcard",
    text: "還可以啦，不會太爛",
    explanation: "雙重否定的輕描淡寫，實際評價可能更極端（很好或很差）。",
    category: "understatement",
  },
  {
    market: "taiwan",
    platform: "PTT",
    text: "收到錢了嗎？",
    explanation: "直接質疑是否收錢發文，暗示內容不客觀。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "Dcard",
    text: "哇，好厲害喔（棒讀）",
    explanation: "「棒讀」明確標示這是反串，表示語氣平淡無感情，實際上是諷刺。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "PTT",
    text: "嗯嗯，你說的都對",
    explanation: "敷衍的同意，通常表示不認同但懶得爭論。",
    category: "irony",
  },
  {
    market: "taiwan",
    platform: "Dcard",
    text: "87分不能再高了",
    explanation: "「87」是「白痴」的諧音，「87分」暗示評價很低，是反串的誇獎。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "PTT",
    text: "廠廠廠廠",
    explanation: "「廠」是「哈哈哈哈」的變體，但通常用於冷笑或諷刺。",
    category: "sarcasm",
  },
  {
    market: "taiwan",
    platform: "Dcard",
    text: "好喔，反正我也沒差",
    explanation: "表面同意但帶有不滿或諷刺意味。",
    category: "irony",
  },
];

/**
 * 日本市場反串語料庫種子資料
 * 來源：2ch、5ch 常見皮肉（ひにく）用語
 */
export const japanSarcasmExamples: Omit<InsertSarcasmCorpus, "id" | "createdBy" | "createdAt" | "updatedAt">[] = [
  {
    market: "japan",
    platform: "2ch",
    text: "さすがですね（笑）",
    explanation: "「さすが」（不愧是）搭配「（笑）」，表示諷刺而非真心稱讚。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "5ch",
    text: "すごいすごい（棒読み）",
    explanation: "「すごい」（厲害）搭配「棒読み」（平淡朗讀），明確標示反串。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "2ch",
    text: "はいはい、わかったわかった",
    explanation: "重複「はい」和「わかった」，表示敷衍或不耐煩。",
    category: "irony",
  },
  {
    market: "japan",
    platform: "5ch",
    text: "ステマ乙",
    explanation: "「ステマ」是 stealth marketing（隱性行銷）的縮寫，「乙」表示「辛苦了」，諷刺是業配文。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "2ch",
    text: "草生える",
    explanation: "「草」（草，類似 lol）表示嘲笑，「生える」（長出來）表示很好笑但帶諷刺意味。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "5ch",
    text: "まあまあだね",
    explanation: "「まあまあ」（還可以）是輕描淡寫，實際評價可能更極端。",
    category: "understatement",
  },
  {
    market: "japan",
    platform: "2ch",
    text: "神対応ですね（皮肉）",
    explanation: "「神対応」（神級應對）搭配「皮肉」（諷刺），明確標示是反串。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "5ch",
    text: "www",
    explanation: "「w」是「笑」的縮寫，多個「w」通常表示嘲笑而非真心覺得好笑。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "2ch",
    text: "そうですか（棒）",
    explanation: "「そうですか」（是嗎）搭配「棒」（平淡），表示冷淡或諷刺。",
    category: "irony",
  },
  {
    market: "japan",
    platform: "5ch",
    text: "やったぜ。",
    explanation: "「やったぜ」（太好了）在某些語境下是反串，表示諷刺或嘲諷。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "2ch",
    text: "流石だな（失笑）",
    explanation: "「流石」（不愧是）搭配「失笑」（苦笑），表示諷刺。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "5ch",
    text: "悪くないね",
    explanation: "「悪くない」（不差）是雙重否定的輕描淡寫，實際評價可能更極端。",
    category: "understatement",
  },
  {
    market: "japan",
    platform: "2ch",
    text: "お疲れ様です（嘲笑）",
    explanation: "「お疲れ様」（辛苦了）搭配「嘲笑」，表示諷刺而非真心感謝。",
    category: "sarcasm",
  },
  {
    market: "japan",
    platform: "5ch",
    text: "ほーん、で？",
    explanation: "「ほーん」（哦）搭配「で？」（然後呢？），表示不屑或諷刺。",
    category: "irony",
  },
  {
    market: "japan",
    platform: "2ch",
    text: "マジかよ最高だな（笑）",
    explanation: "「マジかよ」（真的嗎）搭配「最高」（最棒）和「（笑）」，是典型的反串誇獎。",
    category: "exaggeration",
  },
];

/**
 * 合併所有語料庫
 */
export const allSarcasmExamples = [...taiwanSarcasmExamples, ...japanSarcasmExamples];
