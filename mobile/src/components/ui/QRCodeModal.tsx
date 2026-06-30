import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, View, Image, StyleSheet } from "react-native";

interface QRCodeModalProps {
  visible: boolean;
  qrUrl: string | null;
  onClose: () => void;
}

export function QRCodeModal({ visible, qrUrl, onClose }: QRCodeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#475569" />
          </Pressable>
          {qrUrl ? (
            <Image
              source={{ uri: qrUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    padding: 32,
    borderRadius: 24,
    alignItems: "center",
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 4,
  },
  qrImage: {
    width: 250,
    height: 250,
    marginTop: 16,
  },
});
