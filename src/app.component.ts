import { Component, ChangeDetectionStrategy, signal, computed, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';
import { KanjiNode, SentencePart } from './models/kanji-node.model';
import { KanjiGraphComponent } from './components/kanji-graph/kanji-graph.component';
import { StrokeOrderComponent } from './components/stroke-order/stroke-order.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, KanjiGraphComponent, StrokeOrderComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private readonly HISTORY_KEY = 'kanjiHistory';
  private readonly MAX_HISTORY_SIZE = 15;

  kanjiValue = signal<string>('');
  kanjiData = signal<KanjiNode | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  selectedNode = signal<KanjiNode | null>(null);
  history = signal<string[]>([]);
  
  suggestions = signal<string[]>(['愛', '夢', '桜', '武', '道']);
  loadingSuggestions = signal<boolean>(false);
  
  graphComponent = viewChild.required(KanjiGraphComponent);

  // Basic check for CJK characters
  isValidKanji = computed(() => {
    return this.isValidKanjiValue(this.kanjiValue());
  });

  constructor() {
    this.loadHistory();
  }

  onFormSubmit(event: Event) {
    event.preventDefault();
    this.startVisualization(this.kanjiValue());
  }

  onSuggestionClick(kanji: string): void {
    this.kanjiValue.set(kanji);
    this.startVisualization(kanji);
  }

  onHistoryClick(kanji: string): void {
    this.kanjiValue.set(kanji);
    this.startVisualization(kanji);
  }

  async fetchNewSuggestions(): Promise<void> {
    this.loadingSuggestions.set(true);
    try {
        const newSuggestions = await this.geminiService.getKanjiSuggestions();
        this.suggestions.set(newSuggestions);
    } catch (e) {
        console.error("Failed to fetch new suggestions", e);
        // The service has a fallback, so the UI won't break.
    } finally {
        this.loadingSuggestions.set(false);
    }
  }

  private async startVisualization(kanji: string): Promise<void> {
    if (!this.isValidKanjiValue(kanji)) {
        this.error.set('Vui lòng nhập một ký tự Kanji hợp lệ.');
        return;
    }
    
    this.loading.set(true);
    this.error.set(null);
    this.kanjiData.set(null);
    this.selectedNode.set(null);

    try {
      const data = await this.geminiService.getKanjiEtymology(kanji);
      this.kanjiData.set(data);
      this.selectedNode.set(data); // Select the root node by default
      this.updateHistory(kanji);
    } catch (e: any) {
      this.error.set(e.message || 'An unknown error occurred.');
      this.kanjiData.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  private isValidKanjiValue(value: string): boolean {
    if (value.length !== 1) return false;
    // CJK Unified Ideographs range
    const regex = /[\u4e00-\u9faf]/;
    return regex.test(value);
  }

  onNodeSelected(node: KanjiNode): void {
    this.selectedNode.set(node);
  }

  speak(text: string): void {
    if ('speechSynthesis' in window && text) {
      // Cancel any previous speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.8; // A bit slower for better clarity
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('Web Speech API is not supported by this browser.');
    }
  }

  public getSentenceText(parts: SentencePart[]): string {
    return parts.map(p => p.text).join('');
  }

  private loadHistory(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedHistory = localStorage.getItem(this.HISTORY_KEY);
      if (storedHistory) {
        try {
          this.history.set(JSON.parse(storedHistory));
        } catch (e) {
          console.error('Failed to parse history from localStorage', e);
          this.history.set([]);
        }
      }
    }
  }

  private updateHistory(kanji: string): void {
    const currentHistory = this.history();
    const filteredHistory = currentHistory.filter(item => item !== kanji);
    const newHistory = [kanji, ...filteredHistory].slice(0, this.MAX_HISTORY_SIZE);
    
    this.history.set(newHistory);
    
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(newHistory));
    }
  }
  
  clearHistory(): void {
    this.history.set([]);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.HISTORY_KEY);
    }
  }

  downloadPng(): void {
    this.graphComponent().exportAsPng();
  }

  downloadPdf(): void {
    this.graphComponent().exportAsPdf();
  }

  downloadJson(): void {
    const data = this.kanjiData();
    if (!data) {
      return;
    }

    const jsonString = JSON.stringify(data, null, 2); // Pretty-print JSON
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.character}.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadMarkdown(): void {
    const data = this.kanjiData();
    if (!data) {
      return;
    }

    const markdownContent = this.generateMarkdown(data);
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    // FIX: Pass the 'blob' object to createObjectURL, not the 'url' variable which is not yet defined.
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.character}-etymology.md`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private generateMarkdown(node: KanjiNode, level: number = 1): string {
    let content = `${'#'.repeat(level)} ${node.character}\n\n`;
    
    content += `*   **Hán Việt:** ${node.vietnameseMeaning}\n`;
    if (node.hiraganaReading && node.romajiReading) {
      content += `*   **Hiragana:** ${node.hiraganaReading}\n`;
      content += `*   **Romaji:** ${node.romajiReading}\n`;
    }
    content += `*   **Giải thích:** *${node.explanation}*\n\n`;

    if (node.components && node.components.length > 0) {
      content += `${'-'.repeat(3)}\n\n`;
      content += `### Thành phần:\n\n`;
      for (const component of node.components) {
        content += this.generateMarkdown(component, level + 1);
      }
    }

    return content;
  }
  
  public getTokenClass(type: string): string {
    switch (type) {
      case 'subject':   return 'text-yellow-400 font-medium';
      case 'object':    return 'text-green-400 font-medium';
      case 'verb':      return 'text-red-400 font-medium';
      case 'particle':  return 'text-cyan-400';
      case 'adjective': return 'text-purple-400 font-medium';
      case 'adverb':    return 'text-purple-400 font-medium';
      default:          return '';
    }
  }
}