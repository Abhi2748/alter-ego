/**
 * FocusScreen — Tab 4.
 * Timer: Pomodoro | Deep Work | Stopwatch + tags + settings.
 * Stats: today / weekly / all-time / by tag / recent.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import {
  useFocusTags,
  useFocusStats,
  useFocusSettings,
  useCreateFocusTag,
  useLogFocusSession,
  usePatchFocusSettings,
} from "@/hooks/useFocus";
import { fmtDuration, type FocusMode, type FocusTag } from "@/services/focus";
import { useUserStore } from "@/store/userStore";

const VIOLET = "#8B5CF6";
const VIOLET_DEEP = "#6D28D9";
const GREEN = "#10B981";
/** RGB for SVG radial stops (avoid hard “plate” from thick stroke rings) */
const GREEN_RGB = "rgb(16,185,129)";
const VIOLET_RGB = "rgb(139,92,246)";
const SURFACE = "#141824";
const BORDER = "#2A3050";
const TEXT = "#E5E7EB";
const MUTED = "#6B7280";
const DIM = "#4B5563";

const TAG_COLORS = [
  "#8B5CF6",
  "#F97316",
  "#10B981",
  "#3B82F6",
  "#EF4444",
  "#F59E0B",
  "#EC4899",
];

const DEEP_WORK_DURATIONS = [30, 45, 60, 90, 120];

const RING_SIZE = 256;
const RING_RADIUS = 120;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;
const RING_CX = RING_SIZE / 2;
const RING_CY = RING_SIZE / 2;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatCountdown(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad(m)}:${pad(s)}`;
}

function formatElapsed(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Device-local calendar day YYYY-MM-DD (matches backend focus weekly buckets). */
function localCalendarYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Weekday initial for API date string — parse as local calendar date, not UTC midnight. */
function chartDayLetterFromIsoDate(isoYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd.trim());
  if (!m) return "?";
  const y = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const local = new Date(y, month, day);
  return ["S", "M", "T", "W", "T", "F", "S"][local.getDay()];
}

/** idle | work run/pause | break run/pause | stopwatch run/pause */
type Segment = "idle" | "work" | "break" | "sw";

export function FocusScreen() {
  const insets = useSafeAreaInsets();
  const profile = useUserStore((s) => s.profile);

  const [subTab, setSubTab] = useState<"timer" | "stats">("timer");
  const [mode, setMode] = useState<FocusMode>("pomodoro");
  const [deepWorkMins, setDeepWorkMins] = useState(90);

  const { data: settings } = useFocusSettings();
  const patchSettings = usePatchFocusSettings();
  const { data: tags = [] } = useFocusTags();
  const [selectedTag, setSelectedTag] = useState<FocusTag | null>(null);
  const createTag = useCreateFocusTag();

  const { data: stats, isPending: statsPending, refetch: refetchStats } = useFocusStats();
  const logSession = useLogFocusSession();

  const workSecs = (settings?.pomodoro_work_minutes ?? 25) * 60;
  const shortBreakSecs = (settings?.pomodoro_short_break_minutes ?? 5) * 60;
  const longBreakSecs = (settings?.pomodoro_long_break_minutes ?? 15) * 60;
  const totalRounds = settings?.pomodoro_rounds ?? 4;
  const autoBreaks = settings?.auto_start_breaks ?? true;
  const autoWork = settings?.auto_start_work ?? false;

  const [segment, setSegment] = useState<Segment>("idle");
  const [run, setRun] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [elapsedFocus, setElapsedFocus] = useState(0);
  const [elapsedBreak, setElapsedBreak] = useState(0);
  const startedAtRef = useRef<string | null>(null);
  const elapsedFocusRef = useRef(0);
  const elapsedBreakRef = useRef(0);
  elapsedFocusRef.current = elapsedFocus;
  elapsedBreakRef.current = elapsedBreak;
  const [sessionComplete, setSessionComplete] = useState(false);

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const tagSheetRef = useRef<BottomSheetModal>(null);
  const settingsSheetRef = useRef<BottomSheetModal>(null);
  const createTagSheetRef = useRef<BottomSheetModal>(null);

  type DurationSettingKey =
    | "pomodoro_work_minutes"
    | "pomodoro_short_break_minutes"
    | "pomodoro_long_break_minutes"
    | "pomodoro_rounds";
  const [durationEdit, setDurationEdit] = useState<null | {
    key: DurationSettingKey;
    min: number;
    max: number;
    showMinutes: boolean;
    title: string;
  }>(null);
  const [durationDraft, setDurationDraft] = useState("");

  const deepSecs = deepWorkMins * 60;

  const getInitialSecs = useCallback(() => {
    if (mode === "pomodoro") return workSecs;
    if (mode === "deep_work") return deepSecs;
    return 0;
  }, [mode, workSecs, deepSecs]);

  const resetTimerUi = useCallback(() => {
    setRun(false);
    setSegment("idle");
    setSecondsLeft(0);
    setCurrentRound(1);
    setElapsedFocus(0);
    setElapsedBreak(0);
    startedAtRef.current = null;
  }, []);

  const logAbandonAndReset = useCallback(async () => {
    const endedAt = new Date().toISOString();
    if (startedAtRef.current && (elapsedFocus > 0 || elapsedBreak > 0)) {
      try {
        await logSession.mutateAsync({
          mode,
          tag_id: selectedTag?.id ?? null,
          started_at: startedAtRef.current,
          ended_at: endedAt,
          focus_seconds: elapsedFocus,
          break_seconds: elapsedBreak,
          rounds_completed:
            mode === "pomodoro"
              ? segment === "break"
                ? currentRound
                : Math.max(0, currentRound - 1)
              : 0,
          // Count toward stats/tags whenever the user actually focused (manual end is not a "failed" session).
          was_abandoned: elapsedFocus === 0,
        });
      } catch {
        /* non-blocking */
      }
    }
    resetTimerUi();
  }, [currentRound, elapsedBreak, elapsedFocus, logSession, mode, resetTimerUi, segment, selectedTag?.id]);

  const zeroTransitionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (subTab === "stats") void refetchStats();
  }, [subTab, refetchStats]);

  // 1s tick
  useEffect(() => {
    if (!run) return;

    const id = setInterval(() => {
      if (segment === "sw") {
        setElapsedFocus((f) => f + 1);
        return;
      }
      if (segment === "work") {
        setSecondsLeft((prev) => {
          if (prev <= 0) return 0;
          setElapsedFocus((f) => f + 1);
          return prev - 1;
        });
        return;
      }
      if (segment === "break") {
        setSecondsLeft((prev) => {
          if (prev <= 0) return 0;
          setElapsedBreak((b) => b + 1);
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(id);
  }, [run, segment]);

  // Transitions when countdown reaches 0 (debounced by key)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- elapsed totals read via refs for logging
  useEffect(() => {
    if (secondsLeft !== 0) {
      zeroTransitionKeyRef.current = null;
      return;
    }
    if (segment === "idle" || segment === "sw") return;

    const key = `${segment}-${mode}-${currentRound}`;
    if (zeroTransitionKeyRef.current === key) return;
    zeroTransitionKeyRef.current = key;

    if (segment === "work") {
      if (mode === "deep_work") {
        setRun(false);
        setSegment("idle");
        setSessionComplete(true);
        void logSession.mutateAsync({
          mode: "deep_work",
          tag_id: selectedTag?.id ?? null,
          started_at: startedAtRef.current ?? new Date().toISOString(),
          ended_at: new Date().toISOString(),
          focus_seconds: elapsedFocusRef.current,
          break_seconds: elapsedBreakRef.current,
          rounds_completed: 1,
          was_abandoned: false,
        });
        return;
      }
      if (mode === "pomodoro") {
        if (currentRound >= totalRounds) {
          setRun(false);
          setSegment("idle");
          setSessionComplete(true);
          void logSession.mutateAsync({
            mode: "pomodoro",
            tag_id: selectedTag?.id ?? null,
            started_at: startedAtRef.current ?? new Date().toISOString(),
            ended_at: new Date().toISOString(),
            focus_seconds: elapsedFocusRef.current,
            break_seconds: elapsedBreakRef.current,
            rounds_completed: totalRounds,
            was_abandoned: false,
          });
          return;
        }
        const breakLen = currentRound % totalRounds === 0 ? longBreakSecs : shortBreakSecs;
        setSegment("break");
        setSecondsLeft(breakLen);
        if (!autoBreaks) setRun(false);
      }
    } else if (segment === "break" && mode === "pomodoro") {
      setCurrentRound((r) => r + 1);
      setSegment("work");
      setSecondsLeft(workSecs);
      if (!autoWork) setRun(false);
    }
  }, [
    autoBreaks,
    autoWork,
    currentRound,
    logSession,
    longBreakSecs,
    mode,
    secondsLeft,
    segment,
    selectedTag?.id,
    shortBreakSecs,
    totalRounds,
    workSecs,
  ]);

  const handleStart = () => {
    startedAtRef.current = new Date().toISOString();
    setElapsedFocus(0);
    setElapsedBreak(0);
    setCurrentRound(1);
    setSessionComplete(false);
    if (mode === "stopwatch") {
      setSegment("sw");
      setRun(true);
      return;
    }
    setSegment("work");
    setSecondsLeft(getInitialSecs());
    setRun(true);
  };

  const handlePause = () => setRun(false);
  const handleResume = () => setRun(true);

  const handleReset = () => {
    Alert.alert(
      "End session?",
      elapsedFocus > 0
        ? "Your focus time will be saved to stats."
        : "Stop the timer without recording focus time?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: () => void logAbandonAndReset(),
        },
      ]
    );
  };

  const handleDoneStopwatch = () => {
    setRun(false);
    setSegment("idle");
    setSessionComplete(true);
    void logSession.mutateAsync({
      mode: "stopwatch",
      tag_id: selectedTag?.id ?? null,
      started_at: startedAtRef.current ?? new Date().toISOString(),
      ended_at: new Date().toISOString(),
      focus_seconds: elapsedFocus,
      break_seconds: 0,
      rounds_completed: 0,
      was_abandoned: false,
    });
  };

  const handleSkipBreak = () => {
    setCurrentRound((r) => r + 1);
    setSegment("work");
    setSecondsLeft(workSecs);
    setRun(true);
  };

  const dismissComplete = () => {
    setSessionComplete(false);
    resetTimerUi();
    void refetchStats();
  };

  const openDurationEdit = useCallback(
    (item: { key: DurationSettingKey; min: number; max: number; label: string }) => {
      if (!settings) return;
      setDurationDraft(String(settings[item.key]));
      setDurationEdit({
        key: item.key,
        min: item.min,
        max: item.max,
        showMinutes: item.key !== "pomodoro_rounds",
        title: item.label,
      });
    },
    [settings]
  );

  const commitDurationEdit = useCallback(() => {
    if (!durationEdit) return;
    const n = parseInt(durationDraft, 10);
    if (Number.isNaN(n)) return;
    const clamped = Math.max(durationEdit.min, Math.min(durationEdit.max, n));
    patchSettings.mutate({ [durationEdit.key]: clamped });
    setDurationEdit(null);
    setDurationDraft("");
  }, [durationDraft, durationEdit, patchSettings]);

  const isIdle = segment === "idle" && !run;
  const isBreak = segment === "break";
  const isPaused = !run && (segment === "work" || segment === "break" || segment === "sw");
  const isRunning = run && (segment === "work" || segment === "break" || segment === "sw");

  /** In-session atmosphere (running or paused) — soft radial bloom, not stroked bands */
  const inFocusSession = segment === "work" || segment === "break" || segment === "sw";

  const ringTotal = useMemo(() => {
    if (mode === "stopwatch") return 1;
    if (segment === "break") {
      const br = currentRound % totalRounds === 0 ? longBreakSecs : shortBreakSecs;
      return Math.max(1, br);
    }
    if (mode === "pomodoro") return Math.max(1, workSecs);
    return Math.max(1, deepSecs);
  }, [mode, segment, currentRound, totalRounds, longBreakSecs, shortBreakSecs, workSecs, deepSecs]);

  const ringProgress = useMemo(() => {
    if (mode === "stopwatch") return 0;
    return Math.max(0, Math.min(1, 1 - secondsLeft / ringTotal));
  }, [mode, secondsLeft, ringTotal]);

  const ringDashOffset = RING_CIRC * (1 - ringProgress);
  const ringColor = isBreak ? GREEN : VIOLET;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    ),
    []
  );

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await createTag.mutateAsync({ name: newTagName.trim(), color: newTagColor });
      setSelectedTag(tag);
      setNewTagName("");
      createTagSheetRef.current?.dismiss();
      tagSheetRef.current?.dismiss();
    } catch {
      Alert.alert("Error", "Could not create tag. Name may already exist.");
    }
  };

  const showStatsEmpty =
    stats &&
    stats.all_time.total_sessions === 0 &&
    stats.today.sessions === 0 &&
    stats.recent_sessions.length === 0;

  const modeLocked = isRunning || isPaused;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#09091A", "#07080F"]} style={StyleSheet.absoluteFill} />

      <View style={styles.topBar}>
        <View style={styles.tbLeft}>
          <View style={styles.tbAvatar}>
            <Text style={styles.tbAvatarText}>{profile?.username?.[0]?.toUpperCase() ?? "?"}</Text>
          </View>
          <View>
            <Text style={styles.tbName}>{profile?.username ?? "—"}</Text>
            <Text style={styles.tbStage}>{profile?.character_stage_name ?? ""}</Text>
          </View>
        </View>
        <View style={styles.tbRight}>
          <Text style={styles.tbPsLabel}>Power</Text>
          <Text style={styles.tbPsValue}>{profile?.power_score ?? 0}</Text>
        </View>
      </View>

      <View style={styles.subTabs}>
        <Pressable style={[styles.subTab, subTab === "timer" && styles.subTabActive]} onPress={() => setSubTab("timer")}>
          <Text style={[styles.subTabText, subTab === "timer" && styles.subTabTextActive]}>Timer</Text>
        </Pressable>
        <Pressable style={[styles.subTab, subTab === "stats" && styles.subTabActive]} onPress={() => setSubTab("stats")}>
          <Text style={[styles.subTabText, subTab === "stats" && styles.subTabTextActive]}>Stats</Text>
        </Pressable>
      </View>

      {subTab === "timer" ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {sessionComplete ? (
            <View style={styles.completeWrap}>
              <View style={styles.completeRing}>
                <Ionicons name="checkmark" size={48} color={VIOLET} />
              </View>
              <Text style={styles.completeTitle}>Session Complete</Text>
              <Text style={styles.completeSub}>
                {mode === "pomodoro"
                  ? `${totalRounds} pomodoro rounds finished`
                  : mode === "deep_work"
                    ? `${deepWorkMins}m deep work session`
                    : "Stopwatch session logged"}
              </Text>
              <View style={styles.completeSummary}>
                <View style={styles.completeStat}>
                  <View style={styles.completeStatIcon}>
                    <Ionicons name="time-outline" size={16} color={VIOLET} />
                  </View>
                  <Text style={styles.completeStatLabel}>Focus Time</Text>
                  <Text style={styles.completeStatVal}>{fmtDuration(elapsedFocus)}</Text>
                </View>
                {elapsedBreak > 0 ? (
                  <View style={styles.completeStat}>
                    <View style={[styles.completeStatIcon, { backgroundColor: "rgba(16,185,129,0.12)" }]}>
                      <Ionicons name="cafe-outline" size={16} color={GREEN} />
                    </View>
                    <Text style={styles.completeStatLabel}>Break Time</Text>
                    <Text style={styles.completeStatVal}>{fmtDuration(elapsedBreak)}</Text>
                  </View>
                ) : null}
                {selectedTag ? (
                  <View style={styles.completeStat}>
                    <View style={styles.completeStatIcon}>
                      <View style={[styles.tagDot, { backgroundColor: selectedTag.color }]} />
                    </View>
                    <Text style={styles.completeStatLabel}>Tag</Text>
                    <Text style={styles.completeStatVal}>{selectedTag.name}</Text>
                  </View>
                ) : null}
              </View>
              <Pressable style={styles.completeDoneBtn} onPress={dismissComplete}>
                <Text style={styles.completeDoneBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.modeRow}>
                {(["pomodoro", "deep_work", "stopwatch"] as FocusMode[]).map((m) => {
                  const active = mode === m && isIdle;
                  const label = m === "pomodoro" ? "Pomodoro" : m === "deep_work" ? "Deep Work" : "Stopwatch";
                  return (
                    <Pressable
                      key={m}
                      style={[styles.modeChip, mode === m && styles.modeChipActive, modeLocked && m !== mode && styles.modeChipDisabled]}
                      onPress={() => !modeLocked && setMode(m)}
                      disabled={modeLocked && m !== mode}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          mode === m && styles.modeChipTextActive,
                          modeLocked && m !== mode && { opacity: 0.35 },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.ringWrap}>
                <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
                  <Defs>
                    <RadialGradient id="focusAmbViolet" cx="50%" cy="50%" r="56%">
                      <Stop offset="0%" stopColor={VIOLET_RGB} stopOpacity={0.2} />
                      <Stop offset="28%" stopColor={VIOLET_RGB} stopOpacity={0.09} />
                      <Stop offset="52%" stopColor={VIOLET_RGB} stopOpacity={0.035} />
                      <Stop offset="78%" stopColor={VIOLET_RGB} stopOpacity={0.008} />
                      <Stop offset="100%" stopColor={VIOLET_RGB} stopOpacity={0} />
                    </RadialGradient>
                    <RadialGradient id="focusAmbGreen" cx="50%" cy="50%" r="56%">
                      <Stop offset="0%" stopColor={GREEN_RGB} stopOpacity={0.17} />
                      <Stop offset="28%" stopColor={GREEN_RGB} stopOpacity={0.075} />
                      <Stop offset="52%" stopColor={GREEN_RGB} stopOpacity={0.028} />
                      <Stop offset="78%" stopColor={GREEN_RGB} stopOpacity={0.006} />
                      <Stop offset="100%" stopColor={GREEN_RGB} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  {inFocusSession ? (
                    <Circle
                      cx={RING_CX}
                      cy={RING_CY}
                      r={RING_RADIUS + 46}
                      fill={isBreak ? "url(#focusAmbGreen)" : "url(#focusAmbViolet)"}
                    />
                  ) : null}
                  <Circle
                    cx={RING_CX}
                    cy={RING_CY}
                    r={RING_RADIUS}
                    stroke="rgba(42,48,80,0.4)"
                    strokeWidth={3}
                    fill="none"
                  />
                  {mode !== "stopwatch" && ringProgress > 0 ? (
                    <Circle
                      cx={RING_CX}
                      cy={RING_CY}
                      r={RING_RADIUS}
                      stroke={ringColor}
                      strokeWidth={3.5}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
                      strokeDashoffset={ringDashOffset}
                      transform={`rotate(-90, ${RING_CX}, ${RING_CY})`}
                    />
                  ) : null}
                  {mode === "stopwatch" && isRunning ? (
                    <Circle
                      cx={RING_CX}
                      cy={RING_CY}
                      r={RING_RADIUS}
                      stroke="rgba(139,92,246,0.15)"
                      strokeWidth={3}
                      fill="none"
                    />
                  ) : null}
                </Svg>
                <View style={styles.ringCenter} pointerEvents="none">
                  <Text style={[styles.ringTime, isBreak && { color: GREEN }]}>
                    {mode === "stopwatch"
                      ? formatElapsed(elapsedFocus)
                      : isIdle
                        ? formatCountdown(getInitialSecs())
                        : formatCountdown(secondsLeft)}
                  </Text>
                  <Text style={[styles.ringLabel, isBreak && { color: GREEN }]}>
                    {isBreak
                      ? "Break"
                      : mode === "pomodoro"
                        ? isRunning
                          ? `Work · Round ${currentRound}`
                          : "Work Session"
                        : mode === "deep_work"
                          ? "Deep Focus"
                          : isRunning
                            ? "Elapsed"
                            : "Ready"}
                  </Text>
                </View>
              </View>

              {mode === "pomodoro" ? (
                <View style={styles.dotsRow}>
                  {Array.from({ length: totalRounds }, (_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i < currentRound - 1 && styles.dotDone,
                        i === currentRound - 1 && isRunning && segment === "work" && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : null}

              {mode === "deep_work" && isIdle ? (
                <View style={styles.durationRow}>
                  {DEEP_WORK_DURATIONS.map((d) => (
                    <Pressable
                      key={d}
                      style={[styles.durationChip, deepWorkMins === d && styles.durationChipActive]}
                      onPress={() => setDeepWorkMins(d)}
                    >
                      <Text style={[styles.durationChipText, deepWorkMins === d && styles.durationChipTextActive]}>{d}m</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {isBreak ? (
                <View style={styles.breakMsg}>
                  <Text style={styles.breakMsgTitle}>Take a breather. You earned it.</Text>
                  <Text style={styles.breakMsgSub}>
                    {autoBreaks ? "Next work session starts automatically" : "Tap Resume when you are ready"}
                  </Text>
                </View>
              ) : null}

              {!isBreak ? (
                <Pressable
                  style={[
                    styles.tagRow,
                    selectedTag && {
                      borderColor: `${selectedTag.color}44`,
                      backgroundColor: `${selectedTag.color}0D`,
                    },
                  ]}
                  onPress={() => tagSheetRef.current?.present()}
                >
                  <Ionicons name="pricetag-outline" size={16} color={selectedTag ? selectedTag.color : MUTED} />
                  <Text style={[styles.tagRowText, selectedTag && { color: TEXT }]}>{selectedTag ? selectedTag.name : "No tag selected"}</Text>
                  {selectedTag ? (
                    <Text style={styles.taggedLabel}>TAGGED</Text>
                  ) : (
                    <Ionicons name="chevron-down" size={14} color={DIM} />
                  )}
                </Pressable>
              ) : null}

              <View style={styles.controlsRow}>
                {isIdle ? (
                  <>
                    <Pressable style={styles.startBtn} onPress={handleStart}>
                      <Ionicons name="play" size={18} color="white" />
                      <Text style={styles.startBtnText}>Start</Text>
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={() => settingsSheetRef.current?.present()}>
                      <Ionicons name="settings-outline" size={20} color={MUTED} />
                    </Pressable>
                  </>
                ) : isPaused ? (
                  <>
                    <Pressable style={styles.pauseBtn} onPress={handleResume}>
                      <Ionicons name="play" size={16} color={VIOLET} />
                      <Text style={styles.pauseBtnText}>Resume</Text>
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={handleReset}>
                      <Ionicons name="refresh" size={18} color={MUTED} />
                    </Pressable>
                  </>
                ) : isBreak ? (
                  <Pressable style={styles.skipBtn} onPress={handleSkipBreak}>
                    <Text style={styles.skipBtnText}>Skip Break</Text>
                    <Ionicons name="play-skip-forward" size={14} color={MUTED} />
                  </Pressable>
                ) : mode === "stopwatch" ? (
                  <>
                    <Pressable style={styles.startBtn} onPress={handleDoneStopwatch}>
                      <Ionicons name="checkmark" size={18} color="white" />
                      <Text style={styles.startBtnText}>Done</Text>
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={handlePause}>
                      <Ionicons name="pause" size={18} color={MUTED} />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable style={styles.pauseBtn} onPress={handlePause}>
                      <Ionicons name="pause" size={16} color={VIOLET} />
                      <Text style={styles.pauseBtnText}>Pause</Text>
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={handleReset}>
                      <Ionicons name="refresh" size={18} color={MUTED} />
                    </Pressable>
                  </>
                )}
              </View>

              {mode === "pomodoro" && isIdle && settings ? (
                <View style={styles.configRow}>
                  <View style={styles.configItem}>
                    <Text style={styles.configLabel}>WORK</Text>
                    <Text style={styles.configVal}>{settings.pomodoro_work_minutes}m</Text>
                  </View>
                  <View style={styles.configDivider} />
                  <View style={styles.configItem}>
                    <Text style={styles.configLabel}>BREAK</Text>
                    <Text style={styles.configVal}>{settings.pomodoro_short_break_minutes}m</Text>
                  </View>
                  <View style={styles.configDivider} />
                  <View style={styles.configItem}>
                    <Text style={styles.configLabel}>LONG</Text>
                    <Text style={styles.configVal}>{settings.pomodoro_long_break_minutes}m</Text>
                  </View>
                  <View style={styles.configDivider} />
                  <View style={styles.configItem}>
                    <Text style={styles.configLabel}>ROUNDS</Text>
                    <Text style={styles.configVal}>{settings.pomodoro_rounds}</Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      ) : statsPending ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={VIOLET} />
        </View>
      ) : showStatsEmpty ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="timer-outline" size={32} color="rgba(139,92,246,0.3)" />
            </View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Start your first focus session to see your stats here. Every minute counts.</Text>
          </View>
        </ScrollView>
      ) : stats ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statSection}>
            <Text style={styles.statSectionLabel}>Today</Text>
            <View style={styles.todayRow}>
              <View style={styles.todayCard}>
                <Text style={styles.todayCardLabel}>FOCUS</Text>
                <Text style={styles.todayCardVal}>{fmtDuration(stats.today.focus_seconds)}</Text>
              </View>
              <View style={styles.todayCard}>
                <Text style={styles.todayCardLabel}>BREAK</Text>
                <Text style={[styles.todayCardVal, { color: GREEN }]}>{fmtDuration(stats.today.break_seconds)}</Text>
              </View>
              <View style={styles.todayCard}>
                <Text style={styles.todayCardLabel}>SESSIONS</Text>
                <Text style={styles.todayCardVal}>{stats.today.sessions}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statSection}>
            <View style={styles.statSectionRow}>
              <Text style={styles.statSectionLabel}>This Week</Text>
              <Text style={styles.statSectionRight}>{fmtDuration(stats.week_total_focus_seconds)}</Text>
            </View>
            <View style={styles.chartCard}>
              {(() => {
                const maxSec = Math.max(...stats.weekly_chart.map((d) => d.focus_seconds), 1);
                const todayYmd = localCalendarYmd();
                return (
                  <View style={styles.chartBars}>
                    {stats.weekly_chart.map((d) => {
                      const h = Math.max(4, (d.focus_seconds / maxSec) * 96);
                      const isToday = d.date === todayYmd;
                      return (
                        <View key={d.date} style={styles.chartColWrap}>
                          <View style={[styles.chartBar, { height: h }, isToday && styles.chartBarToday]} />
                          <Text style={[styles.chartDayLabel, isToday && styles.chartDayLabelToday]}>
                            {chartDayLetterFromIsoDate(d.date)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          </View>

          <View style={styles.statSection}>
            <Text style={styles.statSectionLabel}>All Time</Text>
            <View style={styles.allTimeGrid}>
              {[
                { label: "TOTAL FOCUS", val: fmtDuration(stats.all_time.total_focus_seconds) },
                { label: "SESSIONS", val: String(stats.all_time.total_sessions) },
                { label: "LONGEST", val: fmtDuration(stats.all_time.longest_session_seconds) },
                { label: "AVG SESSION", val: fmtDuration(stats.all_time.avg_session_seconds) },
                { label: "FOCUS STREAK", val: `${stats.all_time.focus_streak_days}d`, color: "#F97316" },
                { label: "COMPLETED", val: `${stats.all_time.completion_pct}%`, color: GREEN },
              ].map((item) => (
                <View key={item.label} style={styles.allTimeCard}>
                  <Text style={styles.allTimeLabel}>{item.label}</Text>
                  <Text style={[styles.allTimeVal, item.color ? { color: item.color } : null]}>{item.val}</Text>
                </View>
              ))}
            </View>
          </View>

          {stats.by_tag.length > 0 ? (
            <View style={styles.statSection}>
              <Text style={styles.statSectionLabel}>By Tag</Text>
              {stats.by_tag.map((t, i) => (
                <View key={`${t.name}-${i}`} style={styles.tagStatCard}>
                  <View style={styles.tagStatTop}>
                    <View style={styles.tagStatLeft}>
                      <View style={[styles.tagDot, { backgroundColor: t.color }]} />
                      <Text style={styles.tagStatName}>{t.name}</Text>
                    </View>
                    <Text style={styles.tagStatTime}>{fmtDuration(t.focus_seconds)}</Text>
                  </View>
                  <View style={styles.tagStatTrack}>
                    <View style={[styles.tagStatFill, { width: `${Math.min(100, t.pct)}%`, backgroundColor: t.color }]} />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {stats.recent_sessions.length > 0 ? (
            <View style={styles.statSection}>
              <Text style={styles.statSectionLabel}>Recent Sessions</Text>
              {stats.recent_sessions.map((s) => (
                <View key={s.id} style={[styles.recentRow, s.was_abandoned && { opacity: 0.5 }]}>
                  <View style={[styles.tagDot, { backgroundColor: s.tag_color ?? "#4B5563" }]} />
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTag}>{s.tag_name ?? "Untagged"}</Text>
                    <Text style={styles.recentMeta}>
                      {s.mode === "pomodoro"
                        ? `Pomodoro · ${s.rounds_completed} rounds`
                        : s.mode === "deep_work"
                          ? "Deep Work"
                          : "Stopwatch"}
                      {s.was_abandoned ? " · Abandoned" : ""}
                      {" · "}
                      {new Date(s.ended_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Text style={styles.recentDuration}>{fmtDuration(s.focus_seconds)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      <BottomSheetModal
        ref={tagSheetRef}
        snapPoints={["55%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={styles.sheetContent}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Tag</Text>
            <Pressable
              onPress={() => {
                setSelectedTag(null);
                tagSheetRef.current?.dismiss();
              }}
            >
              <Text style={styles.sheetClear}>None</Text>
            </Pressable>
          </View>
          <View style={styles.sheetDivider} />
          <ScrollView style={styles.sheetScroll}>
            {tags.map((tag) => (
              <Pressable
                key={tag.id}
                style={[styles.tagOption, selectedTag?.id === tag.id && styles.tagOptionActive]}
                onPress={() => {
                  setSelectedTag(tag);
                  tagSheetRef.current?.dismiss();
                }}
              >
                <View style={[styles.tagDot, { backgroundColor: tag.color, width: 10, height: 10 }]} />
                <Text style={styles.tagOptionName}>{tag.name}</Text>
                <Text style={styles.tagOptionCount}>{tag.session_count} sessions</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.createTagBtn}
              onPress={() => {
                tagSheetRef.current?.dismiss();
                setTimeout(() => createTagSheetRef.current?.present(), 250);
              }}
            >
              <View style={styles.createTagIconWrap}>
                <Text style={styles.createTagPlus}>+</Text>
              </View>
              <Text style={styles.createTagText}>Create New Tag</Text>
            </Pressable>
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={createTagSheetRef}
        snapPoints={["50%", "88%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.createTagSheetScroll}
        >
          <Text style={styles.sheetTitle}>Create Tag</Text>
          <Text style={styles.sheetFieldLabel}>TAG NAME</Text>
          <BottomSheetTextInput
            style={styles.tagNameInput}
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="e.g. Coding, Study, Art..."
            placeholderTextColor={MUTED}
            maxLength={32}
          />
          <Text style={styles.sheetFieldLabel}>COLOR</Text>
          <View style={styles.colorRow}>
            {TAG_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, newTagColor === c && styles.colorDotActive]}
                onPress={() => setNewTagColor(c)}
              />
            ))}
          </View>
          <Pressable
            style={[styles.createTagSubmit, !newTagName.trim() && { opacity: 0.4 }]}
            disabled={!newTagName.trim()}
            onPress={handleCreateTag}
          >
            {createTag.isPending ? <ActivityIndicator color="white" /> : <Text style={styles.createTagSubmitText}>Create Tag</Text>}
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        ref={settingsSheetRef}
        snapPoints={["80%", "92%"]}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Focus Settings</Text>
          <View style={styles.sheetDivider} />
          {settings ? (
            <ScrollView style={styles.sheetScroll}>
              <Text style={styles.sheetSectionLabel}>POMODORO</Text>
              {(
                [
                  {
                    label: "Work Duration",
                    sub: "Length of each focus session",
                    key: "pomodoro_work_minutes" as const,
                    min: 5,
                    max: 120,
                  },
                  {
                    label: "Short Break",
                    sub: "Break between sessions",
                    key: "pomodoro_short_break_minutes" as const,
                    min: 1,
                    max: 30,
                  },
                  {
                    label: "Long Break",
                    sub: "Extended break after full set",
                    key: "pomodoro_long_break_minutes" as const,
                    min: 5,
                    max: 60,
                  },
                  {
                    label: "Rounds",
                    sub: "Sessions until long break",
                    key: "pomodoro_rounds" as const,
                    min: 1,
                    max: 10,
                  },
                ] as const
              ).map((item) => (
                <View key={item.key} style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingSub}>{item.sub}</Text>
                  </View>
                  <View style={styles.stepperRow}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => {
                        const current = Number(settings[item.key]);
                        if (current > item.min) patchSettings.mutate({ [item.key]: current - 1 });
                      }}
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </Pressable>
                    <Pressable
                      hitSlop={10}
                      onPress={() =>
                        openDurationEdit({
                          key: item.key,
                          min: item.min,
                          max: item.max,
                          label: item.label,
                        })
                      }
                      style={styles.stepperValPress}
                    >
                      <Text style={styles.stepperVal}>
                        {item.key === "pomodoro_rounds" ? String(settings[item.key]) : `${settings[item.key]}m`}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => {
                        const current = Number(settings[item.key]);
                        if (current < item.max) patchSettings.mutate({ [item.key]: current + 1 });
                      }}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              <View style={styles.sheetDivider} />
              <Text style={styles.sheetSectionLabel}>AUTOMATION</Text>

              {(
                [
                  { label: "Auto-start Breaks", sub: "Start break timer automatically", key: "auto_start_breaks" as const },
                  { label: "Auto-start Work", sub: "Start work after break ends", key: "auto_start_work" as const },
                  { label: "Sound & Vibration", sub: "Alert when session ends", key: "sound_enabled" as const },
                ] as const
              ).map((item) => (
                <View key={item.key} style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{item.label}</Text>
                    <Text style={styles.settingSub}>{item.sub}</Text>
                  </View>
                  <Switch
                    value={Boolean(settings[item.key])}
                    onValueChange={(v) => patchSettings.mutate({ [item.key]: v })}
                    trackColor={{ false: "#374151", true: "rgba(139,92,246,0.42)" }}
                    thumbColor={Boolean(settings[item.key]) ? "#A78BFA" : "#9CA3AF"}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>

      <Modal
        visible={durationEdit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setDurationEdit(null);
          setDurationDraft("");
        }}
      >
        <View style={styles.durationModalOuter}>
          <Pressable
            style={styles.durationModalBackdrop}
            onPress={() => {
              Keyboard.dismiss();
              setDurationEdit(null);
              setDurationDraft("");
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 12 : 0}
            style={styles.durationModalKb}
          >
            <View style={[styles.durationModalCard, { marginBottom: Math.max(insets.bottom, 16) }]}>
              <Text style={styles.durationModalTitle}>{durationEdit?.title ?? ""}</Text>
              <Text style={styles.durationModalHint}>
                {durationEdit
                  ? `${durationEdit.min}–${durationEdit.max}${durationEdit.showMinutes ? " minutes" : " rounds"}`
                  : ""}
              </Text>
              <TextInput
                style={styles.durationModalInput}
                value={durationDraft}
                onChangeText={(t) => setDurationDraft(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder={durationEdit ? String(durationEdit.min) : "0"}
                placeholderTextColor={MUTED}
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.durationModalActions}>
                <Pressable
                  style={styles.durationModalBtnGhost}
                  onPress={() => {
                    Keyboard.dismiss();
                    setDurationEdit(null);
                    setDurationDraft("");
                  }}
                >
                  <Text style={styles.durationModalBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.durationModalBtnPrimary} onPress={() => void commitDurationEdit()}>
                  <Text style={styles.durationModalBtnPrimaryText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 80 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(9,9,26,0.85)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.35)",
  },
  tbLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  tbAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(80,30,160,0.7)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  tbAvatarText: { fontSize: 13, fontWeight: "700", color: "rgba(167,139,250,0.8)" },
  tbName: { fontSize: 13, fontWeight: "600", color: TEXT },
  tbStage: { fontSize: 10, color: MUTED, marginTop: 1 },
  tbRight: { alignItems: "flex-end" },
  tbPsLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: MUTED,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tbPsValue: { fontSize: 18, fontWeight: "700", color: VIOLET },

  subTabs: {
    flexDirection: "row",
    margin: 16,
    backgroundColor: "rgba(20,24,36,0.6)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.4)",
    borderRadius: 14,
    padding: 3,
  },
  subTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 11 },
  subTabActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
  },
  subTabText: { fontSize: 12, fontWeight: "600", color: MUTED },
  subTabTextActive: { color: VIOLET },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },

  modeRow: { flexDirection: "row", gap: 6, marginBottom: 20 },
  modeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modeChipActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: "rgba(139,92,246,0.4)",
    borderWidth: 1.5,
  },
  modeChipDisabled: { opacity: 0.4 },
  modeChipText: { fontSize: 12, fontWeight: "500", color: MUTED },
  modeChipTextActive: { color: VIOLET, fontWeight: "600" },

  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringTime: { fontSize: 72, fontWeight: "700", color: TEXT, letterSpacing: -1, lineHeight: 72 },
  ringLabel: { fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginTop: 6 },

  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 16 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(42,48,80,0.4)",
    borderWidth: 1,
    borderColor: "rgba(42,48,80,0.6)",
  },
  dotDone: { backgroundColor: VIOLET },
  dotActive: { backgroundColor: VIOLET, borderColor: "#A78BFA" },

  durationRow: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" },
  durationChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  durationChipActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: "rgba(139,92,246,0.4)",
    borderWidth: 1.5,
  },
  durationChipText: { fontSize: 14, fontWeight: "600", color: MUTED },
  durationChipTextActive: { color: VIOLET, fontWeight: "700" },

  breakMsg: {
    backgroundColor: "rgba(16,185,129,0.06)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  breakMsgTitle: { fontSize: 13, color: GREEN, fontWeight: "500" },
  breakMsgSub: { fontSize: 11, color: MUTED, marginTop: 4 },

  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  tagRowText: { flex: 1, fontSize: 13, color: MUTED },
  taggedLabel: { fontSize: 9, color: MUTED, fontWeight: "600", letterSpacing: 0.5 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },

  controlsRow: { flexDirection: "row", gap: 12, justifyContent: "center", marginBottom: 20 },
  startBtn: {
    flex: 1,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: VIOLET_DEEP,
    borderRadius: 16,
    shadowColor: "rgba(139,92,246,0.4)",
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  startBtnText: { color: "white", fontSize: 15, fontWeight: "700" },
  pauseBtn: {
    flex: 1,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.4)",
    borderRadius: 16,
  },
  pauseBtnText: { color: VIOLET, fontSize: 15, fontWeight: "700" },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  skipBtnText: { fontSize: 13, color: MUTED, fontWeight: "600" },
  iconBtn: {
    width: 52,
    height: 52,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  configRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  configItem: { alignItems: "center" },
  configLabel: { fontSize: 9, color: DIM, letterSpacing: 0.5, marginBottom: 2 },
  configVal: { fontSize: 14, fontWeight: "700", color: MUTED },
  configDivider: { width: 1, height: 28, backgroundColor: "rgba(42,48,80,0.5)" },

  completeWrap: { alignItems: "center", paddingTop: 40 },
  completeRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(139,92,246,0.08)",
    borderWidth: 2,
    borderColor: "rgba(139,92,246,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  completeTitle: { fontSize: 20, fontWeight: "800", color: TEXT, marginBottom: 6 },
  completeSub: { fontSize: 13, color: MUTED, marginBottom: 28 },
  completeSummary: { width: "100%", gap: 8, marginBottom: 28 },
  completeStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  completeStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  completeStatLabel: { flex: 1, fontSize: 13, color: MUTED },
  completeStatVal: { fontSize: 18, fontWeight: "700", color: TEXT },
  completeDoneBtn: {
    width: "100%",
    height: 48,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  completeDoneBtnText: { fontSize: 14, fontWeight: "600", color: MUTED },

  emptyWrap: { alignItems: "center", justifyContent: "center", paddingTop: 120, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(139,92,246,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: TEXT, marginBottom: 8 },
  emptySub: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 20 },

  statSection: { marginBottom: 20 },
  statSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  statSectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  statSectionRight: { fontSize: 12, fontWeight: "600", color: MUTED },
  todayRow: { flexDirection: "row", gap: 8 },
  todayCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  todayCardLabel: { fontSize: 9, color: MUTED, marginBottom: 4 },
  todayCardVal: { fontSize: 20, fontWeight: "700", color: TEXT },
  chartCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
  },
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 5, height: 100 },
  chartColWrap: { flex: 1, alignItems: "center", gap: 4 },
  chartBar: { width: "100%", backgroundColor: VIOLET, borderRadius: 4 },
  chartBarToday: {
    backgroundColor: "#A78BFA",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.9)",
  },
  chartDayLabel: { fontSize: 9, color: MUTED },
  chartDayLabelToday: { color: VIOLET, fontWeight: "700" },
  allTimeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  allTimeCard: {
    width: "47%",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  allTimeLabel: { fontSize: 9, color: MUTED, marginBottom: 4 },
  allTimeVal: { fontSize: 18, fontWeight: "700", color: TEXT },
  tagStatCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
  },
  tagStatTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  tagStatLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  tagStatName: { fontSize: 13, fontWeight: "500", color: TEXT },
  tagStatTime: { fontSize: 13, fontWeight: "600", color: MUTED },
  tagStatTrack: { height: 4, backgroundColor: "rgba(42,48,80,0.4)", borderRadius: 2, overflow: "hidden" },
  tagStatFill: { height: "100%", borderRadius: 2 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  recentInfo: { flex: 1 },
  recentTag: { fontSize: 13, fontWeight: "500", color: TEXT },
  recentMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  recentDuration: { fontSize: 14, fontWeight: "700", color: MUTED },

  sheetBg: { backgroundColor: "#141824" },
  sheetHandle: { backgroundColor: "#2A3050" },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 24, flex: 1 },
  createTagSheetScroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: TEXT, marginBottom: 12 },
  sheetClear: { fontSize: 13, color: MUTED },
  sheetDivider: { height: 1, backgroundColor: "rgba(42,48,80,0.4)", marginBottom: 16 },
  sheetScroll: { flex: 1 },
  sheetFieldLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 12,
  },
  sheetSectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  tagOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    marginBottom: 4,
  },
  tagOptionActive: { backgroundColor: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.25)" },
  tagOptionName: { flex: 1, fontSize: 14, fontWeight: "500", color: TEXT },
  tagOptionCount: { fontSize: 11, color: MUTED },
  createTagBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "rgba(109,40,217,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.3)",
    borderStyle: "dashed",
    borderRadius: 14,
    marginTop: 4,
  },
  createTagIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  createTagPlus: { color: VIOLET, fontSize: 14, fontWeight: "700" },
  createTagText: { fontSize: 14, fontWeight: "500", color: VIOLET },
  tagNameInput: {
    backgroundColor: SURFACE,
    borderWidth: 1.5,
    borderColor: "rgba(139,92,246,0.4)",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: TEXT,
    marginBottom: 8,
  },
  colorRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  colorDotActive: { borderColor: "rgba(255,255,255,0.6)", borderWidth: 2.5 },
  createTagSubmit: {
    height: 48,
    backgroundColor: VIOLET_DEEP,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  createTagSubmitText: { color: "white", fontSize: 14, fontWeight: "700" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(42,48,80,0.3)",
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: "500", color: TEXT },
  settingSub: { fontSize: 11, color: DIM, marginTop: 2 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { fontSize: 16, color: MUTED, fontWeight: "300" },
  stepperValPress: { minWidth: 52, paddingVertical: 6, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  stepperVal: { fontSize: 16, fontWeight: "700", color: TEXT, minWidth: 40, textAlign: "center" },

  durationModalOuter: { flex: 1 },
  durationModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  durationModalKb: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  durationModalCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  durationModalTitle: { fontSize: 16, fontWeight: "700", color: TEXT, marginBottom: 4 },
  durationModalHint: { fontSize: 12, color: MUTED, marginBottom: 12 },
  durationModalInput: {
    backgroundColor: "#0F111C",
    borderRadius: 12,
    padding: 16,
    fontSize: 22,
    fontWeight: "700",
    color: TEXT,
    borderWidth: 1,
    borderColor: BORDER,
  },
  durationModalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  durationModalBtnGhost: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  durationModalBtnGhostText: { color: MUTED, fontWeight: "600" },
  durationModalBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: VIOLET_DEEP,
  },
  durationModalBtnPrimaryText: { color: "white", fontWeight: "700" },
});
