/**
 * Static character & companion art (PNG).
 * User character: only male assets in repo — all users (male/female) use the same files.
 * Twin: twin_shadow.png. Pets: pet_1.png … pet_8.png (stage order matches PET_STAGE_NAMES).
 */

import type { ImageSourcePropType } from "react-native";

/** One Shadow Twin illustration for Twin tab / alerts — not stage-based. */
export const TWIN_CHARACTER_IMAGE: ImageSourcePropType = require("../../assets/images/characters/twin_shadow.png");

/** Home Twin strip thumbnail (TwinPulse). */
export const TWIN_STRIP_IMAGE: ImageSourcePropType = require("../../assets/images/characters/twin_strip.png");

/** Profile Identity + title share modals — single hero illustration. */
export const CHARACTER_IDENTITY_PAGE_IMAGE: ImageSourcePropType = require("../../assets/images/characters/character_identity_page.png");

const CHARACTER_MALE: Record<number, ImageSourcePropType> = {
  1: require("../../assets/images/characters/character_1_male.png"),
  2: require("../../assets/images/characters/character_2_male.png"),
  3: require("../../assets/images/characters/character_3_male.png"),
  4: require("../../assets/images/characters/character_4_male.png"),
  5: require("../../assets/images/characters/character_5_male.png"),
  6: require("../../assets/images/characters/character_6_male.png"),
};

/** Always uses male character art (single set on disk). */
export function getCharacterImageSource(stage: number, _gender?: "male" | "female"): ImageSourcePropType {
  const s = Math.min(6, Math.max(1, Math.floor(stage)));
  return CHARACTER_MALE[s];
}

export function getTwinCharacterImageSource(): ImageSourcePropType {
  return TWIN_CHARACTER_IMAGE;
}

/** Pet stage 1–8 → static PNG (Cat … Dragon). */
export const PET_IMAGES: Record<number, ImageSourcePropType> = {
  1: require("../../assets/images/pets/pet_1.png"),
  2: require("../../assets/images/pets/pet_2.png"),
  3: require("../../assets/images/pets/pet_3.png"),
  4: require("../../assets/images/pets/pet_4.png"),
  5: require("../../assets/images/pets/pet_5.png"),
  6: require("../../assets/images/pets/pet_6.png"),
  7: require("../../assets/images/pets/pet_7.png"),
  8: require("../../assets/images/pets/pet_8.png"),
};

export function getPetImageSource(stage: number): ImageSourcePropType {
  const s = Math.min(8, Math.max(1, Math.floor(stage)));
  return PET_IMAGES[s];
}
