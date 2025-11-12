import { Component, ChangeDetectionStrategy, input, viewChild, ElementRef, effect, output } from '@angular/core';
import { KanjiNode, D3KanjiNode, D3KanjiLink } from '../../models/kanji-node.model';

declare var d3: any;
declare var jspdf: any;

@Component({
  selector: 'app-kanji-graph',
  standalone: true,
  template: `
    <div class="w-full h-full rounded-lg relative overflow-hidden" #graphContainer>
      <svg #svg class="w-full h-full"></svg>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanjiGraphComponent {
  kanjiData = input.required<KanjiNode | null>();
  nodeSelected = output<D3KanjiNode>();

  svgRef = viewChild.required<ElementRef<SVGElement>>('svg');
  containerRef = viewChild.required<ElementRef<HTMLDivElement>>('graphContainer');

  private simulation: any;

  constructor() {
    effect(() => {
        const data = this.kanjiData();
        if (data && this.svgRef() && this.containerRef()) {
            this.createGraph(data);
        } else {
            this.clearGraph();
        }
    });
  }

  private clearGraph() {
    const container = d3.select(this.containerRef().nativeElement);
    container.select('svg').selectAll('*').remove();
    // Also remove any existing tooltips to prevent duplication
    container.selectAll('.tooltip').remove();
  }

  private flattenData(root: KanjiNode): { nodes: D3KanjiNode[]; links: D3KanjiLink[] } {
    const nodes: D3KanjiNode[] = [];
    const links: D3KanjiLink[] = [];
    
    function recurse(node: KanjiNode, parent: D3KanjiNode | null, isRoot: boolean) {
      const d3Node: D3KanjiNode = { ...node, id: node.character, isRoot };
      nodes.push(d3Node);
      if (parent) {
        links.push({ source: parent, target: d3Node });
      }
      if (node.components) {
        node.components.forEach(child => recurse(child, d3Node, false));
      }
    }
    
    recurse(root, null, true);
    return { nodes, links };
  }

  private createGraph(data: KanjiNode) {
    this.clearGraph();
    const { nodes, links } = this.flattenData(data);
    
    const containerEl = this.containerRef().nativeElement;
    const width = containerEl.clientWidth;
    const height = containerEl.clientHeight;

    const svg = d3.select(this.svgRef().nativeElement)
      .attr('viewBox', [0, 0, width, height])
      .style('cursor', 'grab');

    const tooltip = d3.select(containerEl)
      .append('div')
      .attr('class', 'tooltip absolute bg-gray-950 border border-gray-700 rounded-lg p-3 text-gray-200 pointer-events-none opacity-0 transition-opacity duration-200 z-10 shadow-xl')
      .style('max-width', '250px');

    if (this.simulation) {
      this.simulation.stop();
    }
    
    const g = svg.append('g');
    
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', ticked);

    const link = g.append('g')
      .attr('stroke', '#4b5563') // gray-600
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 2);

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(this.drag(this.simulation));

    node.append('circle')
      .attr('r', d => (d.isRoot ? 30 : 25))
      .attr('fill', d => (d.isRoot ? '#3b82f6' : '#1f2937')) // blue-500 : gray-800
      .attr('stroke', d => (d.isRoot ? '#60a5fa' : '#4b5563')) // blue-400 : gray-600
      .attr('stroke-width', 2.5);

    node.append('text')
      .text((d: any) => d.character)
      .attr('font-size', '1.5em')
      .attr('fill', '#e5e7eb') // gray-200
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em');

    node.on('click', (event: MouseEvent, d: D3KanjiNode) => {
        this.nodeSelected.emit(d);
        event.stopPropagation();
    });

    node.on('mouseover', (event: MouseEvent, d: D3KanjiNode) => {
        d3.select(event.currentTarget as SVGGElement).select('circle').transition().duration(150).attr('r', d.isRoot ? 35 : 30);
        tooltip.style('opacity', 1);
        tooltip.html(`
            <div class="font-bold text-base text-blue-400">${d.vietnameseMeaning}</div>
            <p class="mt-1 text-sm text-gray-300">${d.explanation}</p>
        `);
    })
    .on('mousemove', (event: MouseEvent) => {
        const [x, y] = d3.pointer(event, containerEl);
        tooltip.style('left', `${x + 20}px`).style('top', `${y}px`);
    })
    .on('mouseout', (event: MouseEvent, d: D3KanjiNode) => {
        d3.select(event.currentTarget as SVGGElement).select('circle').transition().duration(150).attr('r', d.isRoot ? 30 : 25);
        tooltip.style('opacity', 0);
    });

    function ticked() {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);
    }

    const zoom = d3.zoom()
      .scaleExtent([0.2, 5])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
        const k = event.transform.k;
        g.selectAll('text').style('display', k < 0.7 ? 'none' : null);
      });
    
    svg.call(zoom);
  }

  private drag(simulation: any) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
  }

  private createExportCanvas(): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const svgElement = this.svgRef().nativeElement;

      const svgClone = svgElement.cloneNode(true) as SVGElement;
      const d3Clone = d3.select(svgClone);
      const gClone = d3Clone.select('g');
  
      if (!gClone.node()) {
        return reject(new Error("Graph group not found for export."));
      }
  
      const originalNodeData = d3.select(svgElement).selectAll('g.node-group').data();
      gClone.selectAll('g.node-group').data(originalNodeData);
  
      gClone.attr('transform', null);
  
      gClone.selectAll('g.node-group')
        .append('g')
        .attr('class', 'export-text-block')
        .attr('text-anchor', 'middle')
        .each(function(d: any) {
          const group = d3.select(this);
          const radius = d.isRoot ? 30 : 25;
          group.attr('transform', `translate(0, ${radius + 12})`);
          
          let yOffset = 0;
  
          group.append('text')
            .attr('y', yOffset)
            .attr('font-size', '13px')
            .attr('font-weight', 'bold')
            .attr('fill', '#93c5fd')
            .text(d.vietnameseMeaning);
          yOffset += 15;
  
          if (d.hiraganaReading) {
            group.append('text')
              .attr('y', yOffset)
              .attr('font-size', '12px')
              .attr('fill', '#e5e7eb')
              .text(`${d.hiraganaReading} (${d.romajiReading})`);
            yOffset += 15;
          }
  
          const words = d.explanation.split(/\s+/);
          let line = '';
          const lines = [];
          
          for (const word of words) {
            if ((line + ' ' + word).length > 30 && line.length > 0) {
              lines.push(line);
              line = word;
            } else {
              if (line.length > 0) line += ' ';
              line += word;
            }
          }
          lines.push(line);
  
          lines.slice(0, 2).forEach((textLine, i) => {
              if (i === 1 && lines.length > 2) textLine += '...';
              group.append('text')
                .attr('y', yOffset + (i * 12))
                .attr('font-size', '10px')
                .attr('fill', '#d1d5db')
                .attr('font-style', 'italic')
                .text(textLine);
          });
        });
  
      const graphBBox = (gClone.node() as SVGGElement).getBBox();
      const padding = 60;
      const scaleFactor = 4; // Increased scale factor for higher resolution
  
      const maxDim = Math.max(graphBBox.width, graphBBox.height);
      const finalSize = maxDim + padding * 2;
      
      const canvas = document.createElement('canvas');
      canvas.width = finalSize * scaleFactor;
      canvas.height = finalSize * scaleFactor;
      const ctx = canvas.getContext('2d');
  
      if (!ctx) {
        return reject(new Error("Could not get canvas context"));
      }
  
      d3Clone.attr('width', finalSize).attr('height', finalSize);
      
      const dx = -graphBBox.x + padding + (maxDim - graphBBox.width) / 2;
      const dy = -graphBBox.y + padding + (maxDim - graphBBox.height) / 2;
      
      gClone.attr('transform', `translate(${dx}, ${dy})`);
      
      const svgString = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
  
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load SVG into image for export."));
      };
      img.src = url;
    });
  }

  public async exportAsPng(): Promise<void> {
    try {
      const canvas = await this.createExportCanvas();
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `${this.kanjiData()?.character || 'kanji'}-etymology.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error exporting as PNG:", error);
    }
  }

  public async exportAsPdf(): Promise<void> {
    try {
      const canvas = await this.createExportCanvas();
      // Use lossless PNG for PDF to ensure maximum quality
      const imgData = canvas.toDataURL('image/png', 1.0); 
      const { jsPDF } = jspdf;
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      // Add image as PNG, not JPEG
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${this.kanjiData()?.character || 'kanji'}-etymology.pdf`);

    } catch (error) {
        console.error("Error exporting as PDF:", error);
    }
  }
}