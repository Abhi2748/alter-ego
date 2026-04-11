import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Remote Expo push tokens are not available on Android Expo Go (SDK 53+).
 * iOS Expo Go, dev builds, and store builds use the normal notifications path.
 */
export function isAndroidExpoGoRemotePushUnavailable(): boolean {
  return Platform.OS === "android" && Constants.appOwnership === "expo";
}
