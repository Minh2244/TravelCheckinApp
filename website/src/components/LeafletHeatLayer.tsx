type HeatPoint = [number, number, number?];

type Props = {
  points: HeatPoint[];
  radius?: number;
  blur?: number;
  maxZoom?: number;
};

// NOTE: Heatmap (leaflet.heat) đã được gỡ bỏ. Component này được giữ lại như no-op
// để tránh lỗi build nếu còn import legacy ở đâu đó.
const LeafletHeatLayer = (_props: Props) => {
  void _props;
  return null;
};

export default LeafletHeatLayer;
