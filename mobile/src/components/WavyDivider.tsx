import React from "react";
import Svg, { Path } from "react-native-svg";
import { View } from "react-native";

interface WavyDividerProps {
  color?: string;
  height?: number;
}

export const WavyDivider: React.FC<WavyDividerProps> = ({ color = "#f8fafc", height = 40 }) => {
  return (
    <View style={{ width: "100%", height, position: "absolute", bottom: 0 }}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        style={{ transform: [{ translateY: 1 }] }} // to prevent subpixel gap
      >
        <Path
          d="M0,100 C50,-20 150,150 200,100 C250,-20 350,150 400,100 C450,-20 550,150 600,100 C650,-20 750,150 800,100 C850,-20 950,150 1000,100 L1000,100 L0,100 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
};
