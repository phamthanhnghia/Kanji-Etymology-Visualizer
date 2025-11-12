import { Component, ChangeDetectionStrategy, input, viewChild, ElementRef, effect } from '@angular/core';

declare var HanziWriter: any;

@Component({
  selector: 'app-stroke-order',
  standalone: true,
  template: `
    <div class="w-full aspect-square bg-gray-900/50 rounded-lg" #writerContainer></div>
    <div class="flex justify-center gap-2 mt-4">
      <button (click)="animate()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-200 text-sm font-semibold w-24">
        Animate
      </button>
      <button (click)="startQuiz()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 text-sm font-semibold w-24">
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
  writerContainer = viewChild.required<ElementRef<HTMLDivElement>>('writerContainer');

  private writer: any;

  constructor() {
    effect(() => {
      const char = this.character();
      const writerContainerRef = this.writerContainer();

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

    this.writer = HanziWriter.create(target, character, {
      width: size,
      height: size,
      padding: 5,
      showOutline: true,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 200,
      strokeColor: '#60a5fa', // blue-400
      radicalColor: '#a78bfa', // violet-400
      outlineColor: '#4b5563', // gray-600
      drawingColor: '#f9fafb', // gray-50
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