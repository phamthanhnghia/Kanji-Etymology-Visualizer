import { Component, ChangeDetectionStrategy, input, viewChild, ElementRef, effect } from '@angular/core';

declare var HanziWriter: any;

@Component({
  selector: 'app-stroke-order',
  standalone: true,
  template: `
    <div class="w-full aspect-square bg-black/5 dark:bg-white/5 ring-1 ring-black/10 dark:ring-white/10 rounded-lg" #writerContainer></div>
    <div class="flex justify-center gap-2 mt-4">
      <button (click)="animate()" class="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 transition duration-200 text-sm font-semibold w-24 shadow-lg shadow-sky-600/20">
        Animate
      </button>
      <button (click)="startQuiz()" class="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 text-sm font-semibold w-24 shadow-lg shadow-indigo-500/20">
        Quiz
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    svg {
      display: block;
      margin: auto;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrokeOrderComponent {
  character = input.required<string>();
  theme = input.required<'light' | 'dark'>();
  writerContainer = viewChild.required<ElementRef<HTMLDivElement>>('writerContainer');

  private writer: any;

  constructor() {
    effect(() => {
      const char = this.character();
      const writerContainerRef = this.writerContainer();
      this.theme(); // Re-run effect when theme changes

      if (char && writerContainerRef) {
        const container = writerContainerRef.nativeElement;
        // Ensure the container is visible and has dimensions before initializing HanziWriter
        if (container.getBoundingClientRect().width > 0) {
          this.createWriter(char, container);
        }
      }
    });
  }

  private createWriter(character: string, target: HTMLElement): void {
    target.innerHTML = '';
    
    const size = target.getBoundingClientRect().width;
    const isDark = this.theme() === 'dark';

    this.writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 5,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 200,
      strokeColor: isDark ? '#38bdf8' : '#0284c7', // sky-400 dark, sky-600 light
      radicalColor: isDark ? '#a78bfa' : '#7c3aed', // violet-400 dark, violet-600 light
      outlineColor: isDark ? '#4b5563' : '#d1d5db', // gray-600 dark, gray-300 light
      drawingColor: isDark ? '#f9fafb' : '#1f2937', // gray-50 dark, gray-800 light
      drawingWidth: 10,
    });
  }

  animate(): void {
    this.writer?.animateCharacter();
  }

  startQuiz(): void {
    this.writer?.quiz();
  }
}