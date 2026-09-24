import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, font, radii, spacing } from "@/src/theme";

// Curated popular GIFs for quick selection
const POPULAR_GIFS = [
  { id: "1", title: "Mind Blown", url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
  { id: "2", title: "Celebration", url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" },
  { id: "3", title: "Applaud", url: "https://media.giphy.com/media/3o7qDSOv7gJLcaVWD6/giphy.gif" },
  { id: "4", title: "Shocked", url: "https://media.giphy.com/media/Lcn0yF1RcLANG/giphy.gif" },
  { id: "5", title: "Dancing", url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif" },
  { id: "6", title: "Thumbs Up", url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif" },
  { id: "7", title: "Laughing", url: "https://media.giphy.com/media/10JhvtGP90VHEQ/giphy.gif" },
  { id: "8", title: "Cool", url: "https://media.giphy.com/media/l41YmQj5b80hCXa00/giphy.gif" },
  { id: "9", title: "Waiting", url: "https://media.giphy.com/media/tXL4FHPSnVJ0A/giphy.gif" },
  { id: "10", title: "Confused", url: "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif" },
  { id: "11", title: "Mic Drop", url: "https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif" },
  { id: "12", title: "Love", url: "https://media.giphy.com/media/26hpKMTa5Hg1XUA12/giphy.gif" },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
};

export default function GifPickerModal({ visible, onClose, onSelectGif }: Props) {
  const [query, setQuery] = useState("");

  const filteredGifs = query.trim()
    ? POPULAR_GIFS.filter((g) => g.title.toLowerCase().includes(query.toLowerCase()))
    : POPULAR_GIFS;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose a GIF</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="gif-picker-close">
              <Ionicons name="close" size={20} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.onSurfaceMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search GIFs…"
              placeholderTextColor={colors.onSurfaceDim}
              style={styles.searchInput}
              testID="gif-search-input"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={16} color={colors.onSurfaceDim} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredGifs}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.gifCard}
                onPress={() => {
                  onSelectGif(item.url);
                  onClose();
                }}
                activeOpacity={0.8}
                testID={`gif-item-${item.id}`}
              >
                <ExpoImage source={{ uri: item.url }} style={styles.gifImage} contentFit="cover" />
                <View style={styles.gifTitleWrap}>
                  <Text style={styles.gifTitle} numberOfLines={1}>{item.title}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    justifyContent: "flex-end",
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.glassBorder,
  },
  headerTitle: {
    ...font.title,
    fontSize: 16,
    color: colors.onSurface,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: colors.onSurface,
    fontSize: 14,
  },
  grid: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: 10,
  },
  gifCard: {
    flex: 1,
    height: 120,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  gifImage: {
    width: "100%",
    height: "100%",
  },
  gifTitleWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  gifTitle: {
    ...font.small,
    fontSize: 11,
    color: colors.onSurface,
  },
});
