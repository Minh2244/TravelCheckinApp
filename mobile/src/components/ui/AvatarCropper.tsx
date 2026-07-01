import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  Dimensions,
  Image,
  PanResponder,
  Animated,
} from "react-native";
import Slider from "@react-native-community/slider";
import * as ImageManipulator from "expo-image-manipulator";

interface AvatarCropperProps {
  visible: boolean;
  imageUri: string | null;
  onConfirm: (uri: string) => void;
  onCancel: () => void;
}

const W = Dimensions.get("window").width - 40; // Container size
const D = W * 0.8; // Circle crop diameter (80% of container)
const CIRCLE_LEFT = (W - D) / 2;
const CIRCLE_TOP = (W - D) / 2;

export default function AvatarCropper({
  visible,
  imageUri,
  onConfirm,
  onCancel,
}: AvatarCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const currentPan = useRef({ x: 0, y: 0 });

  // Reset states when image changes or modal opens
  useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (width, height) => {
          setNaturalSize({ width, height });
          setZoom(1);
          pan.setValue({ x: 0, y: 0 });
          currentPan.current = { x: 0, y: 0 };
        },
        (error) => {
          console.error("Lỗi lấy kích thước ảnh:", error);
        }
      );
    }
  }, [imageUri, visible]);

  if (!imageUri || !naturalSize) return null;

  const natW = naturalSize.width;
  const natH = naturalSize.height;

  // Initial scale so that min(width, height) = W
  const scale = W / Math.min(natW, natH);
  const imgW = natW * scale * zoom;
  const imgH = natH * scale * zoom;

  // Enforce boundary constraints
  const getClampedPan = (x: number, y: number, currentZoom: number) => {
    const currentImgW = natW * scale * currentZoom;
    const currentImgH = natH * scale * currentZoom;

    const minX = (W + D) / 2 - currentImgW;
    const maxX = (W - D) / 2;
    const minY = (W + D) / 2 - currentImgH;
    const maxY = (W - D) / 2;

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.setOffset({
        x: currentPan.current.x,
        y: currentPan.current.y,
      });
      pan.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: (e, gestureState) => {
      const nextX = currentPan.current.x + gestureState.dx;
      const nextY = currentPan.current.y + gestureState.dy;
      const clamped = getClampedPan(nextX, nextY, zoom);
      
      pan.setValue({
        x: clamped.x - currentPan.current.x,
        y: clamped.y - currentPan.current.y,
      });
    },
    onPanResponderRelease: () => {
      pan.flattenOffset();
      currentPan.current = {
        x: (pan.x as any)._value,
        y: (pan.y as any)._value,
      };
    },
  });

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    // When zoom changes, adjust pan to ensure it's still clamped
    const clamped = getClampedPan(currentPan.current.x, currentPan.current.y, newZoom);
    currentPan.current = clamped;
    pan.setValue(clamped);
  };

  const handleConfirm = async () => {
    try {
      // Crop calculations relative to natural image
      const finalZoomScale = scale * zoom;
      const cropXDisplay = CIRCLE_LEFT - currentPan.current.x;
      const cropYDisplay = CIRCLE_TOP - currentPan.current.y;

      const cropXNat = Math.max(0, cropXDisplay / finalZoomScale);
      const cropYNat = Math.max(0, cropYDisplay / finalZoomScale);
      const cropWNat = Math.min(natW - cropXNat, D / finalZoomScale);
      const cropHNat = Math.min(natH - cropYNat, D / finalZoomScale);

      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.round(cropXNat),
              originY: Math.round(cropYNat),
              width: Math.round(cropWNat),
              height: Math.round(cropHNat),
            },
          },
          {
            resize: {
              width: 500,
              height: 500,
            },
          },
        ],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
      );

      onConfirm(manipulated.uri);
    } catch (e) {
      console.error("Lỗi cắt ảnh:", e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 bg-black/90 items-center justify-center">
        <View className="w-full px-5 py-6">
          <Text className="text-white text-lg font-bold text-center mb-6">
            Cắt ảnh đại diện
          </Text>

          {/* Cropper Container */}
          <View
            style={{ width: W, height: W }}
            className="bg-zinc-900 overflow-hidden relative self-center rounded-2xl"
          >
            {/* Draggable Image */}
            <Animated.Image
              {...panResponder.panHandlers}
              source={{ uri: imageUri }}
              style={{
                width: imgW,
                height: imgH,
                transform: pan.getTranslateTransform(),
              }}
              resizeMode="cover"
            />

            {/* Circular Mask Overlay */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderWidth: CIRCLE_LEFT,
                borderColor: "rgba(0,0,0,0.6)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: D,
                  height: D,
                  borderRadius: D / 2,
                  borderWidth: 2,
                  borderColor: "#a855f7", // Purple-500
                }}
              />
            </View>
          </View>

          {/* Zoom Slider */}
          <View className="mt-8 px-4">
            <Text className="text-zinc-400 text-xs text-center mb-2">
              Kéo để phóng to / thu nhỏ
            </Text>
            <Slider
              minimumValue={1}
              maximumValue={4}
              value={zoom}
              onValueChange={handleZoomChange}
              minimumTrackTintColor="#a855f7"
              maximumTrackTintColor="#3f3f46"
              thumbTintColor="#a855f7"
            />
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-4 mt-8">
            <Pressable
              onPress={onCancel}
              className="flex-1 min-h-[50px] items-center justify-center rounded-2xl bg-zinc-800"
            >
              <Text className="text-white font-bold text-base">Hủy bỏ</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              className="flex-1 min-h-[50px] items-center justify-center rounded-2xl bg-purple-600 shadow-md shadow-purple-500/20"
            >
              <Text className="text-white font-bold text-base">Cắt ảnh</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
