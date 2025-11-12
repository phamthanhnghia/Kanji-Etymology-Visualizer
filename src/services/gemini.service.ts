import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { KanjiNode } from '../models/kanji-node.model';

declare global {
    interface Window {
      d3: any;
    }
}

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  private ai: GoogleGenAI;
  private readonly CACHE_PREFIX = 'kanji-etymology-cache-';

  constructor() {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getKanjiSuggestions(): Promise<string[]> {
    const prompt = "Liệt kê 5 chữ Kanji tiếng Nhật phổ biến và thú vị. Chỉ trả về một mảng JSON chứa các chữ Kanji dưới dạng chuỗi.";

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.STRING,
        },
    };

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        const suggestions = JSON.parse(jsonText) as string[];
        return suggestions.slice(0, 5); // Ensure only 5 are returned
    } catch (error) {
        console.error('Error fetching Kanji suggestions:', error);
        // Return a default set of suggestions on error to avoid breaking the UI
        return ['愛', '夢', '桜', '武', '道'];
    }
  }

  async getKanjiEtymology(kanji: string): Promise<KanjiNode> {
    const cachedData = this.getFromCache(kanji);
    if (cachedData) {
      return cachedData;
    }

    const prompt = `Phân tích cấu trúc chữ Hán sau đây theo dạng cây triết tự: "${kanji}". Đồng thời, cung cấp 3 câu ví dụ sử dụng chữ Hán này. Trả về kết quả dưới dạng JSON. "vietnameseMeaning" là nghĩa Hán Việt. "explanation" giải thích ngắn gọn ý nghĩa. Các trường "hiraganaReading" và "romajiReading" là bắt buộc. Nếu ký tự là một bộ phận không có cách đọc riêng, hãy trả về một chuỗi rỗng "" cho các trường đó. Đối với các câu ví dụ, mỗi câu phải có trường "sentence" (câu tiếng Nhật), "reading" (cách đọc hiragana), và "translation" (nghĩa tiếng Việt). Các ví dụ chỉ nên được cung cấp cho nút gốc. Quan trọng: Đối với mỗi ví dụ, hãy chia nhỏ các trường "sentence", "reading", và "translation" thành một mảng các phần tử (token). Mỗi phần tử phải là một đối tượng có thuộc tính "text" và "type". Các loại ("type") hợp lệ là: 'subject', 'object', 'verb', 'particle', 'adjective', 'adverb', và 'other'. Việc phân chia phải tương ứng và song song giữa câu gốc, phiên âm, và bản dịch.`;

    const commonProperties = {
        character: { type: Type.STRING },
        vietnameseMeaning: { type: Type.STRING },
        explanation: { type: Type.STRING },
        hiraganaReading: { type: Type.STRING },
        romajiReading: { type: Type.STRING },
    };
    
    const requiredFields = ['character', 'vietnameseMeaning', 'explanation', 'hiraganaReading', 'romajiReading'];

    const leafComponentSchema = {
        type: Type.OBJECT,
        properties: commonProperties,
        required: requiredFields,
    };

    const sentencePartSchema = {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        type: { type: Type.STRING },
      },
      required: ['text', 'type'],
    };

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        ...commonProperties,
        components: {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              properties: {
                  ...commonProperties,
                  components: {
                      type: Type.ARRAY,
                      items: leafComponentSchema,
                  }
              },
              required: requiredFields
          }
        },
        examples: {
            type: Type.ARRAY,
            description: 'Three example sentences using the root Kanji, with color-coded grammatical parts.',
            items: {
                type: Type.OBJECT,
                properties: {
                    sentence: { type: Type.ARRAY, items: sentencePartSchema },
                    reading: { type: Type.ARRAY, items: sentencePartSchema },
                    translation: { type: Type.ARRAY, items: sentencePartSchema },
                },
                required: ['sentence', 'reading', 'translation']
            }
        }
      },
      required: requiredFields,
    };

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });
      
      const jsonText = response.text.trim();
      const parsedData: any = JSON.parse(jsonText);
      const processedData = this.recursivelyProcessComponents(parsedData);
      
      this.saveToCache(kanji, processedData);

      return processedData;
      
    } catch (error) {
      console.error('Error fetching or parsing Kanji etymology:', error);
      throw new Error('Failed to get etymology data from Gemini API. The character might be invalid or the API call failed.');
    }
  }

  private getFromCache(kanji: string): KanjiNode | null {
    if (typeof window === 'undefined' || !window.localStorage) {
        return null;
    }
    const key = `${this.CACHE_PREFIX}${kanji}`;
    const item = localStorage.getItem(key);
    if (!item) {
        return null;
    }
    try {
        return JSON.parse(item) as KanjiNode;
    } catch (e) {
        console.error(`Failed to parse cached data for ${kanji}`, e);
        localStorage.removeItem(key);
        return null;
    }
  }

  private saveToCache(kanji: string, data: KanjiNode): void {
      if (typeof window === 'undefined' || !window.localStorage) {
          return;
      }
      const key = `${this.CACHE_PREFIX}${kanji}`;
      try {
          localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
          console.error(`Failed to save data to cache for ${kanji}`, e);
      }
  }

  private recursivelyProcessComponents(node: any): KanjiNode {
    return {
      character: node.character,
      vietnameseMeaning: node.vietnameseMeaning,
      explanation: node.explanation,
      hiraganaReading: node.hiraganaReading || '',
      romajiReading: node.romajiReading || '',
      id: '', // Will be assigned later
      components: node.components ? node.components.map((comp: any) => this.recursivelyProcessComponents(comp)) : [],
      examples: node.examples || [],
    };
  }
}