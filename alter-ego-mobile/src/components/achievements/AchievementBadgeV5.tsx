/**
 * Achievement badge glyphs + category accents — matches docs/ALTER_EGO_Badges_v5.html
 * (phone mockup: 34×34 viewBox icons, category-tinted frames).
 */

import React from 'react';
import Svg, {
  Path,
  Circle,
  Rect,
  Text as SvgText,
  G,
} from 'react-native-svg';
import type { Achievement, AchievementCategory } from '@/services/achievements';

/** RGB triple for rgba(...) frame styles — from v5 HTML category strips */
export const CATEGORY_ACCENT_RGB: Record<AchievementCategory, string> = {
  season: '234,179,8',
  streak: '249,115,22',
  discipline: '139,92,246',
  character: '99,102,241',
  companion: '20,184,166',
  quit: '16,185,129',
  interest: '217,70,239',
  power: '245,158,11',
};

function streakFontSize(n: number): number {
  if (n <= 7) return 13;
  if (n <= 60) return 11;
  return 9;
}

/** Inner artwork only; outer frame / tick live in AchievementsScreen */
export function AchievementBadgeV5Icon({
  achievement,
  size = 54,
  earned,
}: {
  achievement: Pick<Achievement, 'key' | 'category'>;
  size?: number;
  earned: boolean;
}) {
  const { key } = achievement;

  const inner = (() => {
    switch (key) {
      case 'season_1_complete':
        return (
          <>
            <Path
              d="M17 2L30 7V17C30 25 24 30 17 33C10 30 4 25 4 17V7Z"
              fill="#EAB308"
            />
            <Path
              d="M17 5L27 9V17C27 23 22 27 17 30C12 27 7 23 7 17V9Z"
              fill="rgba(0,0,0,0.25)"
            />
            <SvgText
              x={17}
              y={22}
              textAnchor="middle"
              fontSize={11}
              fontWeight="800"
              fill="#FEF9C3"
            >
              I
            </SvgText>
          </>
        );
      case 'season_1_perfect':
        return (
          <>
            <Path
              d="M17 2L30 7V17C30 25 24 30 17 33C10 30 4 25 4 17V7Z"
              fill="#EAB308"
            />
            <Path
              d="M17 5L27 9V17C27 23 22 27 17 30C12 27 7 23 7 17V9Z"
              fill="rgba(0,0,0,0.25)"
            />
            <Path
              d="M10 21L10 15L13.5 18.5L17 10L20.5 18.5L24 15L24 21Z"
              fill="#FEF9C3"
              opacity={0.9}
            />
            <Rect x={9} y={21} width={16} height={3} rx={1.5} fill="#FEF9C3" opacity={0.9} />
          </>
        );
      case 'season_2_complete':
        return (
          <>
            <Path
              d="M17 2L30 7V17C30 25 24 30 17 33C10 30 4 25 4 17V7Z"
              fill="#EAB308"
            />
            <Path
              d="M17 5L27 9V17C27 23 22 27 17 30C12 27 7 23 7 17V9Z"
              fill="rgba(0,0,0,0.25)"
            />
            <SvgText
              x={17}
              y={22}
              textAnchor="middle"
              fontSize={10}
              fontWeight="800"
              fill="#FEF9C3"
            >
              II
            </SvgText>
          </>
        );
      case 'season_3_complete':
        return (
          <>
            <Path
              d="M17 2L30 7V17C30 25 24 30 17 33C10 30 4 25 4 17V7Z"
              fill="#EAB308"
            />
            <Path
              d="M17 5L27 9V17C27 23 22 27 17 30C12 27 7 23 7 17V9Z"
              fill="rgba(0,0,0,0.25)"
            />
            <SvgText
              x={17}
              y={22}
              textAnchor="middle"
              fontSize={9}
              fontWeight="800"
              fill="#FEF9C3"
            >
              III
            </SvgText>
          </>
        );
      case 'season_4_complete':
        return (
          <>
            <Path
              d="M17 2L30 7V17C30 25 24 30 17 33C10 30 4 25 4 17V7Z"
              fill="#EAB308"
            />
            <Path
              d="M17 5L27 9V17C27 23 22 27 17 30C12 27 7 23 7 17V9Z"
              fill="rgba(0,0,0,0.25)"
            />
            <SvgText
              x={17}
              y={22}
              textAnchor="middle"
              fontSize={9}
              fontWeight="800"
              fill="#FEF9C3"
            >
              IV
            </SvgText>
          </>
        );
      case 'season_5_complete':
        return (
          <>
            <Path
              d="M17 2L30 7V17C30 25 24 30 17 33C10 30 4 25 4 17V7Z"
              fill="#EAB308"
            />
            <Path
              d="M17 5L27 9V17C27 23 22 27 17 30C12 27 7 23 7 17V9Z"
              fill="rgba(0,0,0,0.25)"
            />
            <SvgText
              x={17}
              y={22}
              textAnchor="middle"
              fontSize={9}
              fontWeight="800"
              fill="#FEF9C3"
            >
              V
            </SvgText>
          </>
        );
      case 'veteran':
        return (
          <>
            <Path
              d="M17 2L30 7V17C30 25 24 30 17 33C10 30 4 25 4 17V7Z"
              fill="#EAB308"
            />
            <Path
              d="M17 5L27 9V17C27 23 22 27 17 30C12 27 7 23 7 17V9Z"
              fill="rgba(0,0,0,0.25)"
            />
            <Path
              d="M10 15L10 9L13 12L17 5L21 12L24 9L24 15Z"
              fill="#FEF9C3"
              opacity={0.85}
            />
            <SvgText
              x={17}
              y={27}
              textAnchor="middle"
              fontSize={8}
              fontWeight="800"
              fill="#FEF9C3"
              opacity={0.8}
            >
              VET
            </SvgText>
          </>
        );
      default:
        if (key.startsWith('streak_')) {
          const n = parseInt(key.replace('streak_', ''), 10) || 0;
          const fs = streakFontSize(n);
          return (
            <>
              <Path
                d="M17 31C11 31 5 26 5 19.5C5 11 13 3 17 1C21 3 29 11 29 19.5C29 26 23 31 17 31Z"
                fill="#F97316"
              />
              <Path
                d="M17 28C12.5 28 8.5 24.5 8.5 20C8.5 14 13 9 17 6C21 9 25.5 14 25.5 20C25.5 24.5 21.5 28 17 28Z"
                fill="#FED7AA"
              />
              <SvgText
                x={17}
                y={25}
                textAnchor="middle"
                fontSize={fs}
                fontWeight="800"
                fill="#7C2D12"
              >
                {String(n)}
              </SvgText>
            </>
          );
        }
        break;
    }

    switch (key) {
      case 'stage_2':
        return (
          <>
            <Path
              d="M17 3L22 13H32L24 19.5L27 30L17 23.5L7 30L10 19.5L2 13H12Z"
              fill="#6366F1"
            />
            <Path
              d="M17 7L21 14.5H28L22 19L24.5 26.5L17 22L9.5 26.5L12 19L6 14.5H13Z"
              fill="rgba(199,210,254,0.18)"
            />
            <Circle cx={17} cy={17.5} r={3.5} fill="#C7D2FE" opacity={0.7} />
          </>
        );
      case 'stage_3':
        return (
          <>
            <Path
              d="M17 3L22 13H32L24 19.5L27 30L17 23.5L7 30L10 19.5L2 13H12Z"
              fill="#6366F1"
            />
            <Path
              d="M17 7L21 14.5H28L22 19L24.5 26.5L17 22L9.5 26.5L12 19L6 14.5H13Z"
              fill="rgba(199,210,254,0.18)"
            />
            <Circle cx={17} cy={17.5} r={3.5} fill="#C7D2FE" opacity={0.7} />
            <Path
              d="M17 2C17 2 14 6 14 9C14 11 15.5 12.5 17 12.5C18.5 12.5 20 11 20 9C20 6 17 2 17 2Z"
              fill="#F97316"
              opacity={0.7}
            />
          </>
        );
      case 'stage_4':
        return (
          <>
            <Path
              d="M17 1L20.5 10L30 10L22.5 15.8L25.5 25L17 19.5L8.5 25L11.5 15.8L4 10L13.5 10Z"
              fill="#6366F1"
            />
            <Path
              d="M17 5L19.5 12L27 12L21 16.5L23.2 23.5L17 19.5L10.8 23.5L13 16.5L7 12L14.5 12Z"
              fill="rgba(199,210,254,0.16)"
            />
            <Circle cx={17} cy={16} r={3} fill="#C7D2FE" opacity={0.65} />
          </>
        );
      case 'stage_5':
        return (
          <>
            <Path
              d="M17 1L20.5 10L30 10L22.5 15.8L25.5 25L17 19.5L8.5 25L11.5 15.8L4 10L13.5 10Z"
              fill="#6366F1"
            />
            <Path
              d="M17 5L19.5 12L27 12L21 16.5L23.2 23.5L17 19.5L10.8 23.5L13 16.5L7 12L14.5 12Z"
              fill="rgba(199,210,254,0.16)"
            />
            <Circle cx={17} cy={16} r={3} fill="#C7D2FE" opacity={0.65} />
            <Circle cx={17} cy={1.5} r={1.5} fill="#C7D2FE" opacity={0.55} />
            <Circle cx={4} cy={10} r={1.5} fill="#C7D2FE" opacity={0.55} />
            <Circle cx={30} cy={10} r={1.5} fill="#C7D2FE" opacity={0.55} />
          </>
        );
      case 'stage_6':
        return (
          <>
            <Path
              d="M17 1L20.5 10L30 10L22.5 15.8L25.5 25L17 19.5L8.5 25L11.5 15.8L4 10L13.5 10Z"
              fill="#6366F1"
            />
            <Path
              d="M17 5L19.5 12L27 12L21 16.5L23.2 23.5L17 19.5L10.8 23.5L13 16.5L7 12L14.5 12Z"
              fill="rgba(199,210,254,0.16)"
            />
            <Path d="M13 3L13 0L15 2L17 0L19 2L21 0L21 3Z" fill="#C7D2FE" opacity={0.8} />
            <Circle cx={17} cy={16} r={3} fill="#E0E7FF" opacity={0.8} />
            <Circle cx={4} cy={10} r={1.8} fill="#C7D2FE" opacity={0.5} />
            <Circle cx={30} cy={10} r={1.8} fill="#C7D2FE" opacity={0.5} />
          </>
        );
      case 'pet_unlock':
        return (
          <>
            <Circle cx={12} cy={10} r={3.5} fill="#14B8A6" />
            <Circle cx={22} cy={10} r={3.5} fill="#14B8A6" />
            <Circle cx={7} cy={17} r={2.8} fill="#14B8A6" />
            <Circle cx={27} cy={17} r={2.8} fill="#14B8A6" />
            <Path
              d="M8 22C8 16 26 16 26 22C26 28 22 31 17 31C12 31 8 28 8 22Z"
              fill="#14B8A6"
            />
            <Path
              d="M14 24C14 22.5 15.3 21.5 17 21.5C18.7 21.5 20 22.5 20 24C20 25.5 18.7 26.5 17 26.5C15.3 26.5 14 25.5 14 24Z"
              fill="rgba(204,251,241,0.3)"
            />
          </>
        );
      case 'pet_stage_2':
        return (
          <>
            <Path
              d="M3 5L10 12L7 18C7 26 11 31 17 31C23 31 27 26 27 18L24 12L31 5L26 14C24 10 21 8 17 8C13 8 10 10 8 14Z"
              fill="#14B8A6"
            />
            <Path
              d="M17 14C14 14 12 16 12 19C12 22 14 24 17 24C20 24 22 22 22 19C22 16 20 14 17 14Z"
              fill="rgba(204,251,241,0.25)"
            />
            <Circle cx={14} cy={18} r={1.5} fill="rgba(204,251,241,0.6)" />
            <Circle cx={20} cy={18} r={1.5} fill="rgba(204,251,241,0.6)" />
            <Path
              d="M15 21.5C15 21.5 16 22.5 17 22.5C18 22.5 19 21.5 19 21.5"
              stroke="rgba(204,251,241,0.5)"
              strokeWidth={1}
              strokeLinecap="round"
              fill="none"
            />
          </>
        );
      case 'pet_stage_3':
        return (
          <>
            <Path
              d="M7 4L12 10V14C12 14 10 16 10 19C10 24 13 28 17 28C21 28 24 24 24 19C24 16 22 14 22 14V10L27 4L22 12C20 9 18 8 17 8C16 8 14 9 12 12Z"
              fill="#14B8A6"
            />
            <Circle cx={14} cy={19} r={1.8} fill="rgba(204,251,241,0.6)" />
            <Circle cx={20} cy={19} r={1.8} fill="rgba(204,251,241,0.6)" />
            <Path
              d="M14 23C14 23 15.5 24.5 17 24.5C18.5 24.5 20 23 20 23"
              stroke="rgba(204,251,241,0.45)"
              strokeWidth={1.2}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={17} cy={14} r={2} fill="rgba(204,251,241,0.15)" />
          </>
        );
      case 'pet_stage_4':
        return (
          <>
            <Path
              d="M9 8C9 8 7 3 5 2L10 7C10 7 11 5 17 5C23 5 24 7 24 7L29 2C27 3 25 8 25 8C28 11 29 16 29 21C29 27 24 31 17 31C10 31 5 27 5 21C5 16 6 11 9 8Z"
              fill="#14B8A6"
            />
            <Circle cx={13} cy={19} r={2} fill="rgba(204,251,241,0.55)" />
            <Circle cx={21} cy={19} r={2} fill="rgba(204,251,241,0.55)" />
            <Path
              d="M14 24C14 24 15.5 25.5 17 25.5C18.5 25.5 20 24 20 24"
              stroke="rgba(204,251,241,0.4)"
              strokeWidth={1.2}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M17 13L17 17"
              stroke="rgba(204,251,241,0.3)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </>
        );
      case 'pet_stage_5':
        return (
          <>
            <Path
              d="M9 8C9 8 7 3 5 2L10 7C10 7 11 5 17 5C23 5 24 7 24 7L29 2C27 3 25 8 25 8C28 11 29 16 29 21C29 27 24 31 17 31C10 31 5 27 5 21C5 16 6 11 9 8Z"
              fill="#14B8A6"
            />
            <Circle cx={13} cy={19} r={2} fill="rgba(204,251,241,0.55)" />
            <Circle cx={21} cy={19} r={2} fill="rgba(204,251,241,0.55)" />
            <Path
              d="M14 24C14 24 15.5 25.5 17 25.5C18.5 25.5 20 24 20 24"
              stroke="rgba(204,251,241,0.4)"
              strokeWidth={1.2}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={11} cy={13} r={1.5} fill="rgba(204,251,241,0.22)" />
            <Circle cx={23} cy={13} r={1.5} fill="rgba(204,251,241,0.22)" />
            <Circle cx={17} cy={11} r={1.5} fill="rgba(204,251,241,0.22)" />
            <Circle cx={9} cy={22} r={1.2} fill="rgba(204,251,241,0.18)" />
            <Circle cx={25} cy={22} r={1.2} fill="rgba(204,251,241,0.18)" />
          </>
        );
      case 'pet_stage_6':
        return (
          <>
            <Path
              d="M9 8C9 8 7 3 5 2L10 7C10 7 11 5 17 5C23 5 24 7 24 7L29 2C27 3 25 8 25 8C28 11 29 16 29 21C29 27 24 31 17 31C10 31 5 27 5 21C5 16 6 11 9 8Z"
              fill="#14B8A6"
            />
            <Circle cx={13} cy={19} r={2} fill="rgba(204,251,241,0.55)" />
            <Circle cx={21} cy={19} r={2} fill="rgba(204,251,241,0.55)" />
            <Path
              d="M14 24C14 24 15.5 25.5 17 25.5C18.5 25.5 20 24 20 24"
              stroke="rgba(204,251,241,0.4)"
              strokeWidth={1.2}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M15 7.5L15.5 11"
              stroke="rgba(204,251,241,0.3)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <Path
              d="M17 7L17 11"
              stroke="rgba(204,251,241,0.3)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <Path
              d="M19 7.5L18.5 11"
              stroke="rgba(204,251,241,0.3)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </>
        );
      case 'pet_stage_7':
        return (
          <>
            <Path
              d="M17 18C17 18 8 14 3 8C5 16 10 20 17 20C24 20 29 16 31 8C26 14 17 18 17 18Z"
              fill="#14B8A6"
            />
            <Path d="M14 18L11 31L17 26L23 31L20 18" fill="#14B8A6" opacity={0.8} />
            <Circle cx={17} cy={12} r={4} fill="#14B8A6" />
            <Path
              d="M15 12C15 10 16 8 17 6C18 8 19 10 19 12"
              fill="#F97316"
              opacity={0.7}
            />
          </>
        );
      case 'pet_stage_8':
        return (
          <>
            <Path
              d="M10 20C10 14 13 10 17 10C21 10 24 14 24 20C24 26 21 30 17 30C13 30 10 26 10 20Z"
              fill="#14B8A6"
            />
            <Path d="M13 11C13 11 11 6 10 4C11 7 12 9 13 11Z" fill="#14B8A6" />
            <Path d="M21 11C21 11 23 6 24 4C23 7 22 9 21 11Z" fill="#14B8A6" />
            <Path
              d="M10 18C10 18 4 15 2 10C5 15 9 17 10 20"
              fill="#14B8A6"
              opacity={0.6}
            />
            <Path
              d="M24 18C24 18 30 15 32 10C29 15 25 17 24 20"
              fill="#14B8A6"
              opacity={0.6}
            />
            <Circle cx={14} cy={19} r={2} fill="rgba(204,251,241,0.6)" />
            <Circle cx={20} cy={19} r={2} fill="rgba(204,251,241,0.6)" />
            <Path
              d="M15 27C16 26 17 28 19 27C20 30 18 32 17 32C16 32 14 30 15 27Z"
              fill="#F97316"
              opacity={0.65}
            />
          </>
        );
      case 'full_day':
        return (
          <>
            <Circle cx={17} cy={17} r={13} stroke="#8B5CF6" strokeWidth={3} fill="none" />
            <Path
              d="M9.5 17L14.5 22L24.5 11"
              stroke="#8B5CF6"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </>
        );
      case 'perfect_week':
        return (
          <>
            <Circle cx={6} cy={18} r={2.8} fill="#8B5CF6" />
            <Circle cx={10} cy={11} r={2.8} fill="#8B5CF6" />
            <Circle cx={17} cy={8} r={2.8} fill="#8B5CF6" />
            <Circle cx={24} cy={11} r={2.8} fill="#8B5CF6" />
            <Circle cx={28} cy={18} r={2.8} fill="#8B5CF6" />
            <Circle cx={24} cy={25} r={2.8} fill="#8B5CF6" />
            <Circle cx={10} cy={25} r={2.8} fill="#8B5CF6" />
            <Circle cx={17} cy={18} r={3.5} fill="#C4B5FD" opacity={0.7} />
          </>
        );
      case 'quit_first':
        return (
          <>
            <Rect
              x={2}
              y={13}
              width={13}
              height={9}
              rx={4.5}
              stroke="#10B981"
              strokeWidth={2.5}
              fill="none"
            />
            <Rect
              x={19}
              y={13}
              width={13}
              height={9}
              rx={4.5}
              stroke="#10B981"
              strokeWidth={2.5}
              fill="none"
            />
            <Path
              d="M15 11L15 13M15 22L15 24"
              stroke="#10B981"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <Path
              d="M19 11L19 13M19 22L19 24"
              stroke="#10B981"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </>
        );
      case 'quit_week':
        return (
          <>
            <Rect x={9} y={16} width={16} height={13} rx={3} fill="#10B981" />
            <Path
              d="M13 16V11.5A4 4 0 0 1 21 11.5"
              stroke="#10B981"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={17} cy={22} r={2.5} fill="#D1FAE5" opacity={0.8} />
          </>
        );
      case 'quit_free':
        return (
          <>
            <Path
              d="M17 20C17 20 5 14 3 6C6 13 12 16 17 18C22 16 28 13 31 6C29 14 17 20 17 20Z"
              fill="#10B981"
            />
            <Path d="M14 19L10 31L17 26L24 31L20 19" fill="#10B981" opacity={0.7} />
            <Circle cx={17} cy={12} r={4.5} fill="#10B981" />
            <Circle cx={19} cy={11} r={1.5} fill="#D1FAE5" opacity={0.7} />
          </>
        );
      case 'interest_first':
        return (
          <>
            <Path
              d="M17 3L19.4 14.6L31 17L19.4 19.4L17 31L14.6 19.4L3 17L14.6 14.6Z"
              fill="#D946EF"
            />
            <Path
              d="M17 8L18.8 15.2L26 17L18.8 18.8L17 26L15.2 18.8L8 17L15.2 15.2Z"
              fill="rgba(240,171,252,0.2)"
            />
            <Circle cx={17} cy={17} r={2.8} fill="#FAE8FF" opacity={0.85} />
          </>
        );
      case 'interest_7':
      case 'interest_25':
      case 'interest_50':
      case 'interest_100': {
        const label =
          key === 'interest_7'
            ? '7 sessions'
            : key === 'interest_25'
              ? '25 sessions'
              : key === 'interest_50'
                ? '50 sessions'
                : '100 sessions';
        return (
          <>
            <Path
              d="M17 3L19.4 14.6L31 17L19.4 19.4L17 31L14.6 19.4L3 17L14.6 14.6Z"
              fill="#D946EF"
            />
            <Path
              d="M17 8L18.8 15.2L26 17L18.8 18.8L17 26L15.2 18.8L8 17L15.2 15.2Z"
              fill="rgba(240,171,252,0.2)"
            />
            <Circle cx={17} cy={17} r={2.8} fill="#FAE8FF" opacity={0.85} />
            <SvgText
              x={17}
              y={32.5}
              textAnchor="middle"
              fontSize={7}
              fontWeight="700"
              fill="rgba(217,70,239,0.55)"
            >
              {label}
            </SvgText>
          </>
        );
      }
      case 'power_1000':
        return (
          <>
            <Path d="M22 2L9 18H17L11 32L27 14H19L22 2Z" fill="#F59E0B" />
            <Path
              d="M24 4L12 18H19L14 30L28 14H21L24 4Z"
              fill="rgba(254,243,199,0.15)"
            />
          </>
        );
      case 'power_5000':
        return (
          <>
            <Path d="M19 2L7 17H15L9 32L24 14H16L19 2Z" fill="#F59E0B" />
            <Path d="M24 6L14 19H21L16 31L29 17H22L24 6Z" fill="#F59E0B" opacity={0.45} />
          </>
        );
      case 'power_10000':
        return (
          <>
            <Path d="M17 2L5 16H13L7 31L22 14H14L17 2Z" fill="#F59E0B" />
            <Path d="M22 4L12 17H19L14 30L27 15H20L22 4Z" fill="#F59E0B" opacity={0.4} />
            <Path d="M26 7L17 18H23L19 29L30 17H24L26 7Z" fill="#F59E0B" opacity={0.2} />
            <Circle cx={17} cy={3} r={2} fill="#FEF3C7" opacity={0.8} />
          </>
        );
      default:
        return (
          <>
            <Circle cx={17} cy={17} r={12} fill="#8B5CF6" opacity={0.35} />
            <SvgText
              x={17}
              y={21}
              textAnchor="middle"
              fontSize={10}
              fontWeight="800"
              fill="#E5E7EB"
            >
              ?
            </SvgText>
          </>
        );
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      <G opacity={earned ? 1 : 0.12}>{inner}</G>
    </Svg>
  );
}
