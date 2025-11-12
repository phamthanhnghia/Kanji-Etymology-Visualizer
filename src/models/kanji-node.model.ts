import * as d3 from 'd3';

export interface SentencePart {
  text: string;
  type: 'subject' | 'object' | 'verb' | 'particle' | 'adjective' | 'adverb' | 'other';
}

export interface ExampleSentence {
  sentence: SentencePart[];
  reading: SentencePart[];
  translation: SentencePart[];
}

export interface Vocabulary {
  word: string;
  reading: string;
  romaji: string;
  partOfSpeech: string;
  meaning: string;
}

export interface KanjiNode {
  id: string;
  character: string;
  vietnameseMeaning: string;
  explanation: string;
  hiraganaReading: string;
  romajiReading: string;
  components?: KanjiNode[];
  examples?: ExampleSentence[];
  vocabulary?: Vocabulary[];
  isRoot?: boolean;
}

export interface D3KanjiNode extends KanjiNode, d3.SimulationNodeDatum {
    isRoot: boolean;
}

export interface D3KanjiLink extends d3.SimulationLinkDatum<D3KanjiNode> {
  source: D3KanjiNode;
  target: D3KanjiNode;
}
