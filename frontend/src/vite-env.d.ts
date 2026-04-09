/// <reference types="vite/client" />

declare module '*.svg' {
  const content: React.FC<React.SVGProps<SVGElement>>;
  export default content;
}

declare module '@deck.gl/react' {
  const DeckGL: any;
  export { DeckGL };
}

declare module '@deck.gl/aggregation-layers' {
  const HeatmapLayer: any;
  export { HeatmapLayer };
}
