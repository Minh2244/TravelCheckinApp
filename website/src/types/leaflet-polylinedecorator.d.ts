import * as L from "leaflet";

declare module "leaflet" {
  namespace Symbol {
    interface ArrowHeadOptions {
      pixelSize?: number;
      polygon?: boolean;
      pathOptions?: L.PathOptions;
    }

    function arrowHead(options?: ArrowHeadOptions): L.Symbol;
  }

  interface PolylineDecoratorPattern {
    offset?: string | number;
    repeat?: string | number;
    symbol: L.Symbol;
  }

  interface PolylineDecoratorOptions {
    patterns: PolylineDecoratorPattern[];
  }

  class PolylineDecorator extends L.Layer {
    constructor(
      paths: L.Polyline | L.LatLngExpression[] | L.LatLngExpression[][],
      options?: PolylineDecoratorOptions,
    );
  }

  function polylineDecorator(
    paths: L.Polyline | L.LatLngExpression[] | L.LatLngExpression[][],
    options?: PolylineDecoratorOptions,
  ): PolylineDecorator;
}
