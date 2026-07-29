import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  Pressable,
  Text,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import * as ImageManipulator from "expo-image-manipulator";

interface AvatarCropperProps {
  visible: boolean;
  imageUri: string | null;
  onConfirm: (uri: string) => void;
  onCancel: () => void;
}

type Point = { x: number; y: number };

const W = Dimensions.get("window").width - 40;
const CROP_SIZE = W * 0.8;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const PINCH_POWER = 1.35;
const DOUBLE_TAP_MS = 280;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getDistance = (a: Point, b: Point) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export default function AvatarCropper({
  visible,
  imageUri,
  onConfirm,
  onCancel,
}: AvatarCropperProps) {
  const [sliderZoom, setSliderZoom] = useState(MIN_ZOOM);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const cropRef = useRef<View>(null);
  const cropOrigin = useRef<Point>({ x: 0, y: 0 });
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const imageWidth = useRef(new Animated.Value(CROP_SIZE)).current;
  const imageHeight = useRef(new Animated.Value(CROP_SIZE)).current;

  const currentPan = useRef<Point>({ x: 0, y: 0 });
  const currentZoom = useRef(MIN_ZOOM);
  const gestureMode = useRef<"none" | "pan" | "pinch">("none");
  const lastTapAt = useRef(0);

  const panStart = useRef<Point>({ x: 0, y: 0 });
  const touchStart = useRef<Point>({ x: 0, y: 0 });
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(MIN_ZOOM);
  const pinchStartCenter = useRef<Point>({ x: 0, y: 0 });
  const pinchStartPan = useRef<Point>({ x: 0, y: 0 });

  const measureCropOrigin = () => {
    cropRef.current?.measureInWindow((x, y) => {
      cropOrigin.current = { x, y };
    });
  };

  const getTouchPoint = (event: GestureResponderEvent, index: number): Point | null => {
    const touch = event.nativeEvent.touches[index];
    if (!touch) return null;

    return {
      x: touch.pageX - cropOrigin.current.x,
      y: touch.pageY - cropOrigin.current.y,
    };
  };

  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(
      imageUri,
      (width, height) => {
        const baseScale = CROP_SIZE / Math.min(width, height);
        const initialPan = clampPan(
          (CROP_SIZE - width * baseScale) / 2,
          (CROP_SIZE - height * baseScale) / 2,
          width,
          height,
          baseScale,
          MIN_ZOOM
        );

        currentZoom.current = MIN_ZOOM;
        currentPan.current = initialPan;
        setNaturalSize({ width, height });
        setSliderZoom(MIN_ZOOM);
        imageWidth.setValue(width * baseScale);
        imageHeight.setValue(height * baseScale);
        pan.setValue(initialPan);
        requestAnimationFrame(measureCropOrigin);
      },
      (error) => {
        console.error("Lỗi lấy kích thước ảnh:", error);
      }
    );
  }, [imageHeight, imageUri, imageWidth, pan, visible]);

  if (!imageUri || !naturalSize) return null;

  const natW = naturalSize.width;
  const natH = naturalSize.height;
  const baseScale = CROP_SIZE / Math.min(natW, natH);

  function clampPan(
    x: number,
    y: number,
    width: number,
    height: number,
    scale: number,
    nextZoom: number
  ) {
    const currentImgW = width * scale * nextZoom;
    const currentImgH = height * scale * nextZoom;
    const minX = CROP_SIZE - currentImgW;
    const minY = CROP_SIZE - currentImgH;

    return {
      x: clamp(x, minX, 0),
      y: clamp(y, minY, 0),
    };
  }

  const getClampedPan = (x: number, y: number, nextZoom: number) =>
    clampPan(x, y, natW, natH, baseScale, nextZoom);

  const applyPan = (nextPan: Point) => {
    currentPan.current = nextPan;
    pan.setValue(nextPan);
  };

  const applyZoom = (nextZoom: number, focusPoint: Point, syncSlider = false) => {
    const previousZoom = currentZoom.current;
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const previousScale = baseScale * previousZoom;
    const nextScale = baseScale * clampedZoom;
    const imagePointX = (focusPoint.x - currentPan.current.x) / previousScale;
    const imagePointY = (focusPoint.y - currentPan.current.y) / previousScale;
    const nextPan = getClampedPan(
      focusPoint.x - imagePointX * nextScale,
      focusPoint.y - imagePointY * nextScale,
      clampedZoom
    );

    currentZoom.current = clampedZoom;
    imageWidth.setValue(natW * baseScale * clampedZoom);
    imageHeight.setValue(natH * baseScale * clampedZoom);
    applyPan(nextPan);

    if (syncSlider) {
      setSliderZoom(clampedZoom);
    }
  };

  const syncSliderWithZoom = () => {
    setSliderZoom(currentZoom.current);
  };

  const handleZoomChange = (nextZoom: number) => {
    applyZoom(nextZoom, { x: CROP_SIZE / 2, y: CROP_SIZE / 2 });
  };

  const startPanGesture = (point: Point) => {
    gestureMode.current = "pan";
    panStart.current = currentPan.current;
    touchStart.current = point;
  };

  const startPinchGesture = (event: GestureResponderEvent) => {
    const first = getTouchPoint(event, 0);
    const second = getTouchPoint(event, 1);
    if (!first || !second) return;

    gestureMode.current = "pinch";
    pinchStartDistance.current = Math.max(1, getDistance(first, second));
    pinchStartZoom.current = currentZoom.current;
    pinchStartCenter.current = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
    pinchStartPan.current = currentPan.current;
  };

  const handleDoubleTap = (point: Point) => {
    const targetZoom = currentZoom.current < 2.8 ? 3.5 : MIN_ZOOM;
    applyZoom(targetZoom, point, true);
  };

  const cropResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (event) => {
      measureCropOrigin();

      const touches = event.nativeEvent.touches;
      const first = getTouchPoint(event, 0);

      if (touches.length >= 2) {
        startPinchGesture(event);
        return;
      }

      if (!first) return;

      const now = Date.now();
      if (now - lastTapAt.current < DOUBLE_TAP_MS) {
        lastTapAt.current = 0;
        handleDoubleTap(first);
        gestureMode.current = "none";
        return;
      }

      lastTapAt.current = now;
      startPanGesture(first);
    },
    onPanResponderMove: (event) => {
      const touches = event.nativeEvent.touches;

      if (touches.length >= 2) {
        const first = getTouchPoint(event, 0);
        const second = getTouchPoint(event, 1);
        if (!first || !second) return;

        if (gestureMode.current !== "pinch") {
          startPinchGesture(event);
        }

        const nextCenter = {
          x: (first.x + second.x) / 2,
          y: (first.y + second.y) / 2,
        };
        const distance = Math.max(1, getDistance(first, second));
        const distanceScale = Math.pow(distance / pinchStartDistance.current, PINCH_POWER);
        const nextZoom = clamp(pinchStartZoom.current * distanceScale, MIN_ZOOM, MAX_ZOOM);
        const startScale = baseScale * pinchStartZoom.current;
        const nextScale = baseScale * nextZoom;
        const focusImageX = (pinchStartCenter.current.x - pinchStartPan.current.x) / startScale;
        const focusImageY = (pinchStartCenter.current.y - pinchStartPan.current.y) / startScale;
        const nextPan = getClampedPan(
          nextCenter.x - focusImageX * nextScale,
          nextCenter.y - focusImageY * nextScale,
          nextZoom
        );

        currentZoom.current = nextZoom;
        imageWidth.setValue(natW * baseScale * nextZoom);
        imageHeight.setValue(natH * baseScale * nextZoom);
        applyPan(nextPan);
        return;
      }

      const first = getTouchPoint(event, 0);
      if (!first) return;

      if (gestureMode.current !== "pan") {
        startPanGesture(first);
      }

      const nextPan = getClampedPan(
        panStart.current.x + first.x - touchStart.current.x,
        panStart.current.y + first.y - touchStart.current.y,
        currentZoom.current
      );

      applyPan(nextPan);
    },
    onPanResponderRelease: () => {
      gestureMode.current = "none";
      syncSliderWithZoom();
    },
    onPanResponderTerminate: () => {
      gestureMode.current = "none";
      syncSliderWithZoom();
    },
  });

  const handleConfirm = async () => {
    try {
      const cropSize = Math.round(CROP_SIZE);
      const displayWidth = Math.max(cropSize, Math.round(natW * baseScale * currentZoom.current));
      const displayHeight = Math.max(cropSize, Math.round(natH * baseScale * currentZoom.current));
      const cropX = clamp(Math.round(-currentPan.current.x), 0, displayWidth - cropSize);
      const cropY = clamp(Math.round(-currentPan.current.y), 0, displayHeight - cropSize);

      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: displayWidth,
              height: displayHeight,
            },
          },
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropSize,
              height: cropSize,
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
    } catch (error) {
      console.error("Lỗi cắt ảnh:", error);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 items-center justify-center bg-black/90">
        <View className="w-full px-5 py-6">
          <Text className="mb-6 text-center text-lg font-bold text-white">
            Cắt ảnh đại diện
          </Text>

          <View
            ref={cropRef}
            {...cropResponder.panHandlers}
            collapsable={false}
            onLayout={measureCropOrigin}
            style={{
              width: CROP_SIZE,
              height: CROP_SIZE,
              borderRadius: CROP_SIZE / 2,
            }}
            className="relative self-center overflow-hidden bg-zinc-900"
          >
            <Animated.Image
              source={{ uri: imageUri }}
              style={{
                width: imageWidth,
                height: imageHeight,
                transform: pan.getTranslateTransform(),
              }}
              resizeMode="cover"
            />
            <View pointerEvents="none" className="absolute inset-0 border-2 border-purple-500" />
          </View>

          <View className="mt-8 px-4">
            <Text className="mb-2 text-center text-xs text-zinc-400">
              Kéo để canh ảnh, chụm/mở 2 ngón hoặc nhấn đúp để phóng to / thu nhỏ
            </Text>
            <Slider
              minimumValue={MIN_ZOOM}
              maximumValue={MAX_ZOOM}
              value={sliderZoom}
              onValueChange={handleZoomChange}
              onSlidingComplete={syncSliderWithZoom}
              minimumTrackTintColor="#a855f7"
              maximumTrackTintColor="#3f3f46"
              thumbTintColor="#a855f7"
            />
          </View>

          <View className="mt-8 flex-row gap-4">
            <Pressable
              onPress={onCancel}
              className="min-h-[50px] flex-1 items-center justify-center rounded-2xl bg-zinc-800"
            >
              <Text className="text-base font-bold text-white">Hủy bỏ</Text>
            </Pressable>

            <Pressable
              onPress={handleConfirm}
              className="min-h-[50px] flex-1 items-center justify-center rounded-2xl bg-purple-600 shadow-md shadow-purple-500/20"
            >
              <Text className="text-base font-bold text-white">Cắt ảnh</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
