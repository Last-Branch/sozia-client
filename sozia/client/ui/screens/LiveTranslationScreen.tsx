import type { CameraType } from 'expo-camera';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronDown, CircleX, Hand, Mic, PauseCircle, PlayCircle, Settings, SwitchCamera } from 'lucide-react-native';
import { NativeCameraView } from '../components/NativeCameraView';
import { WebCameraView } from '../components/WebCameraView';
import { useLanguage } from '../context/LanguageContext';

import { ModalityPath, SessionState } from '@common/models';
import { StatusBar } from '../components/StatusBar';
import { TranscriptView } from '../components/TranscriptView';
import { useSessionController } from '../controller/SessionController';
import type { MockTranscriptSource as MockTranscriptSourceType } from '../testing/MockTranscriptSource';


export function LiveTranslationScreen({ onBack }: { onBack: (noticeKey?: string) => void }) {
  const {
    state,
    sessionId,
    activePath,
    healthReports,
    startSession,
    stopSession,
    restartSession,
    pauseSession,
    resumeSession,
    store,
    setCameraVideoElement,
    setNativeLandmarks,
    config,
    enumerateDevices,
    selectMicrophone,
    selectCamera,
    restartAudioPipeline,
  } = useSessionController();
  const cameraContainerRef = useRef<View>(null);

  const { t } = useLanguage();
  const preferredCameraId = config.get('selectedCameraId');
  const [webCameraIds, setWebCameraIds] = useState<string[]>([]);
  const [activeWebCameraId, setActiveWebCameraId] = useState<string | null>(preferredCameraId);
  const [showSettings, setShowSettings] = useState(false);
  const [textSize, setTextSize] = useState(100);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [webMountAttempt, setWebMountAttempt] = useState(0);
  const [requestingWebPermission, setRequestingWebPermission] = useState(false);
  const [switchingAfterMountError, setSwitchingAfterMountError] = useState(false);
  const [skipNextFailedCameraId, setSkipNextFailedCameraId] = useState<string | null>(null);
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);
  const mountErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousAudioProblemRef = useRef<boolean | null>(null);
  const micHealthySeenRef = useRef(false);
  const selectedMicDisconnectedRef = useRef(false);
  const activeMicIdRef = useRef<string | null>(config.get('selectedMicId'));
  const cameraProblemRef = useRef(false);
  const hasForcedExitRef = useRef(false);

  const baseFontSize = (textSize / 100) * 30;
  const shouldShowLiveCamera = activePath === ModalityPath.SIGN || activePath === ModalityPath.SPEECH;
  const showDeviceNotice = useCallback((message: string) => {
    if (deviceNoticeTimerRef.current) {
      clearTimeout(deviceNoticeTimerRef.current);
    }
    setDeviceNotice(message);
    deviceNoticeTimerRef.current = setTimeout(() => {
      setDeviceNotice(null);
      deviceNoticeTimerRef.current = null;
    }, 3000);
  }, []);

  const backToMainMenu = useCallback((noticeKey: string) => {
    if (hasForcedExitRef.current) return;
    hasForcedExitRef.current = true;
    stopSession();
    onBack(noticeKey);
  }, [onBack, stopSession]);

  const audioHotplugRestartingRef = useRef(false);
  const runAudioHotplugRestart = useCallback(async () => {
    if (audioHotplugRestartingRef.current) return;
    audioHotplugRestartingRef.current = true;
    try {
      await restartAudioPipeline();
    } finally {
      audioHotplugRestartingRef.current = false;
    }
  }, [restartAudioPipeline]);

  const switchMicrophoneIfNeeded = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return false;
    }
    const selectedMicId = activeMicIdRef.current ?? config.get('selectedMicId');
    if (!selectedMicId) return false;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioIds = devices
        .filter((d) => d.kind === 'audioinput' && d.deviceId.length > 0)
        .map((d) => d.deviceId);
      const hasSelectedMic = audioIds.includes(selectedMicId);
      if (hasSelectedMic) {
        selectedMicDisconnectedRef.current = false;
        return false;
      }
      const fallbackMicId = audioIds.find((id) => id !== selectedMicId) ?? null;
      if (!fallbackMicId) {
        selectedMicDisconnectedRef.current = true;
        return false;
      }
      activeMicIdRef.current = fallbackMicId;
      selectMicrophone(fallbackMicId);
      config.set('selectedMicId', fallbackMicId);
      selectedMicDisconnectedRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, [config, selectMicrophone]);

  // Demo mode: MockTranscriptSource (dev-only, dynamically imported)
  const [demoActive, setDemoActive] = useState(false);
  const demoSource = useRef<MockTranscriptSourceType | null>(null);

  function toggleDemo() {
    if (demoActive) {
      demoSource.current?.stop();
      demoSource.current = null;
      setDemoActive(false);
    } else {
      import('../testing/MockTranscriptSource').then(({ MockTranscriptSource }) => {
        const src = new MockTranscriptSource(store, sessionId ?? 'demo');
        demoSource.current = src;
        src.start();
        setDemoActive(true);
      });
    }
  }

  useEffect(() => {
    return () => {
      demoSource.current?.stop();
      if (deviceNoticeTimerRef.current) {
        clearTimeout(deviceNoticeTimerRef.current);
        deviceNoticeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setCameraMountError(null);
  }, [cameraFacing, activePath, preferredCameraId]);

  useEffect(() => {
    activeMicIdRef.current = config.get('selectedMicId');
  }, [config, sessionId]);

  useEffect(() => {
    // New session: clear transient skip state.
    setSkipNextFailedCameraId(null);
    previousAudioProblemRef.current = null;
    micHealthySeenRef.current = false;
    selectedMicDisconnectedRef.current = false;
    cameraProblemRef.current = false;
    hasForcedExitRef.current = false;
    if (mountErrorTimerRef.current) {
      clearTimeout(mountErrorTimerRef.current);
      mountErrorTimerRef.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (activePath !== ModalityPath.SPEECH) return;
    if (state !== SessionState.RUNNING && state !== SessionState.DEGRADED) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;

    let cancelled = false;
    const evaluateMicPresence = async () => {
      const selectedMicId = activeMicIdRef.current ?? config.get('selectedMicId');
      if (!selectedMicId) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const audioIds = devices
          .filter((d) => d.kind === 'audioinput' && d.deviceId.length > 0)
          .map((d) => d.deviceId);
        const hasSelectedMic = audioIds.includes(selectedMicId);
        const isDisconnected = !hasSelectedMic;
        const fallbackMicId = audioIds.find((id) => id !== selectedMicId) ?? null;
        if (isDisconnected && fallbackMicId) {
          activeMicIdRef.current = fallbackMicId;
          selectMicrophone(fallbackMicId);
          config.set('selectedMicId', fallbackMicId);
          selectedMicDisconnectedRef.current = false;
          showDeviceNotice(t('live.micSwitchedToAnother'));
          await runAudioHotplugRestart();
          return;
        }
        if (isDisconnected && !fallbackMicId) {
          backToMainMenu('dashboard.noMicrophoneReturnMain');
          return;
        }
        const isStillSelected = devices.some(
          (d) => d.kind === 'audioinput' && d.deviceId === selectedMicId
        );
        const nextDisconnected = !isStillSelected;
        const wasDisconnected = selectedMicDisconnectedRef.current;
        selectedMicDisconnectedRef.current = nextDisconnected;
        if (nextDisconnected && cameraProblemRef.current) {
          backToMainMenu('dashboard.devicesMissingReturnMain');
          return;
        }
        if (wasDisconnected === nextDisconnected) return;
        showDeviceNotice(
          nextDisconnected
            ? t('live.micDisconnectedContinue')
            : t('live.micRecovered')
        );
      } catch {
        // Ignore transient enumerate failures.
      }
    };

    void evaluateMicPresence();
    navigator.mediaDevices.addEventListener('devicechange', evaluateMicPresence);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', evaluateMicPresence);
    };
  }, [activePath, state, config, selectMicrophone, showDeviceNotice, t, backToMainMenu, runAudioHotplugRestart]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    void enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        const ids = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => d.deviceId)
          .filter((id) => id.length > 0);
        setWebCameraIds(ids);
        const preferred = config.get('selectedCameraId');
        const nextId =
          preferred && ids.includes(preferred)
            ? preferred
            : (ids[0] ?? null);
        setActiveWebCameraId(nextId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enumerateDevices, config, activePath]);

  useEffect(() => {
    if (activePath !== ModalityPath.SPEECH) return;
    if (state !== SessionState.RUNNING && state !== SessionState.DEGRADED) return;
    const audioHealth = healthReports.find((h) => h.pipeline === 'audio');
    if (!audioHealth) return;

    const hasLowSignal = audioHealth.snr !== null && audioHealth.snr < 5;
    const audioProblem = !audioHealth.available || hasLowSignal;
    const previousProblem = previousAudioProblemRef.current;
    previousAudioProblemRef.current = audioProblem;

    if (!audioProblem) {
      micHealthySeenRef.current = true;
    }

    if (previousProblem === null || previousProblem === audioProblem) return;
    if (audioProblem && !micHealthySeenRef.current) return;
    if (audioProblem && cameraProblemRef.current) {
      backToMainMenu('dashboard.devicesMissingReturnMain');
      return;
    }

    showDeviceNotice(
      audioProblem
        ? t('live.micDisconnectedContinue')
        : t('live.micRecovered')
    );
  }, [healthReports, activePath, state, showDeviceNotice, t, backToMainMenu]);

  const switchCamera = async () => {
    if (!shouldShowLiveCamera) return;
    if (Platform.OS !== 'web') {
      setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
      return;
    }

    let ids = webCameraIds;
    try {
      const devices = await enumerateDevices();
      ids = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => d.deviceId)
        .filter((id) => id.length > 0);
      setWebCameraIds(ids);
    } catch {
      // Keep last known list if enumeration fails transiently.
    }

    if (ids.length === 0) return;
    if (ids.length === 1) return;

    const currentId = activeWebCameraId && ids.includes(activeWebCameraId)
      ? activeWebCameraId
      : ids[0];
    const currentIdx = ids.indexOf(currentId);
    const nextId = ids[(currentIdx + 1) % ids.length];
    setActiveWebCameraId(nextId);
    selectCamera(nextId);
    config.set('selectedCameraId', nextId);
  };

  const onWebMountError = useCallback((message: string, attemptedDeviceId?: string | null): void => {
    setCameraMountError(message);
    cameraProblemRef.current = true;
    if (Platform.OS !== 'web' || requestingWebPermission || switchingAfterMountError) return;

    if (mountErrorTimerRef.current) {
      clearTimeout(mountErrorTimerRef.current);
      mountErrorTimerRef.current = null;
    }

    const failedId = attemptedDeviceId ?? activeWebCameraId;
    const looksLikePermissionIssue = /denied|notallowed|permission/i.test(message);
    const switchToNextCamera = async () => {
      let currentIds = webCameraIds;
      try {
        const devices = await enumerateDevices();
        currentIds = devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => d.deviceId)
          .filter((id) => id.length > 0);
        setWebCameraIds(currentIds);
      } catch {
        // Keep last known list when enumeration temporarily fails.
      }

      if (currentIds.length <= 1) {
        if (activePath === ModalityPath.SIGN) {
          backToMainMenu('dashboard.signCameraMissingReturnMain');
          return;
        }
        if (activePath === ModalityPath.SPEECH && previousAudioProblemRef.current === true) {
          backToMainMenu('dashboard.devicesMissingReturnMain');
        }
        return;
      }
      const currentId = failedId && currentIds.includes(failedId)
        ? failedId
        : currentIds[0];
      const nextPool = currentIds.filter((id) => id !== currentId && id !== skipNextFailedCameraId);
      if (nextPool.length === 0) {
        if (activePath === ModalityPath.SIGN) {
          backToMainMenu('dashboard.signCameraMissingReturnMain');
          return;
        }
        if (activePath === ModalityPath.SPEECH && previousAudioProblemRef.current === true) {
          backToMainMenu('dashboard.devicesMissingReturnMain');
        }
        return;
      }
      const nextId = nextPool[0];
      setSkipNextFailedCameraId(currentId);
      setSwitchingAfterMountError(true);
      const micSwitched = await switchMicrophoneIfNeeded();
      if (micSwitched) await runAudioHotplugRestart();
      showDeviceNotice(micSwitched ? t('live.cameraAndMicSwitchedToAnother') : t('live.cameraSwitchedToAnother'));
      setActiveWebCameraId(nextId);
      selectCamera(nextId);
      config.set('selectedCameraId', nextId);
      setWebMountAttempt((n) => n + 1);
      setTimeout(() => setSwitchingAfterMountError(false), 250);
    };

    if (!looksLikePermissionIssue) {
      // Grace period: some cameras report transient mount errors while warming up.
      mountErrorTimerRef.current = setTimeout(() => {
        void switchToNextCamera();
        mountErrorTimerRef.current = null;
      }, 500);
      return;
    }

    setRequestingWebPermission(true);
    void navigator.mediaDevices.getUserMedia({ audio: false, video: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        // Permission granted now -> retry same selected camera first.
        setWebMountAttempt((n) => n + 1);
      })
      .catch(() => {
        // Still failing -> generic fallback to next available camera.
        mountErrorTimerRef.current = setTimeout(() => {
          void switchToNextCamera();
          mountErrorTimerRef.current = null;
        }, 500);
      })
      .finally(() => {
        setRequestingWebPermission(false);
      });
  }, [activeWebCameraId, config, requestingWebPermission, selectCamera, switchingAfterMountError, webCameraIds, skipNextFailedCameraId, showDeviceNotice, t, switchMicrophoneIfNeeded, activePath, backToMainMenu, enumerateDevices, runAudioHotplugRestart]);

  return (
    <SafeAreaView className="flex-1 w-full self-stretch bg-gradient-to-br from-[#2ECC71]/5 via-white dark:via-gray-900 to-[#2ECC71]/5">
      <View className="flex-1 w-full bg-black">
          {/* Top bar */}
          <View className="z-20 flex-row items-center justify-between bg-black/30 px-6 pt-3 pb-2">
            <Text className="text-xs font-semibold text-white">Sozia · {state}</Text>
            <TouchableOpacity onPress={() => { stopSession(); onBack(); }}>
              <Text className="text-xs font-semibold text-gray-300">{t('live.back')}</Text>
            </TouchableOpacity>
          </View>

          <StatusBar
            state={state}
            healthReports={healthReports}
            onRestart={() => {
              void restartSession();
            }}
          />
          {deviceNotice && (
            <View className="z-50 w-full flex-row items-center justify-center gap-2 px-4 py-2 bg-yellow-500/80">
              <Text className="text-xs font-semibold text-black">
                {deviceNotice}
              </Text>
            </View>
          )}

          <View className="relative flex-1">
            {/* Camera background */}
            <View ref={cameraContainerRef} className="absolute inset-0 items-center justify-center bg-gray-800" pointerEvents="none">
              {shouldShowLiveCamera ? (
                <>
                  {Platform.OS !== 'web' ? (
                    <NativeCameraView
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                      facing={cameraFacing}
                      active={true}
                      sessionId={sessionId ?? undefined}
                      onLandmarks={setNativeLandmarks}
                      onError={(message) => setCameraMountError(message)}
                    />
                  ) : (
                    <WebCameraView
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                      deviceId={activeWebCameraId}
                      facing={cameraFacing}
                      mirror={cameraFacing === 'front'}
                      active={true}
                      sessionKey={`${sessionId ?? ''}:${webMountAttempt}`}
                      onVideoElement={(el) => {
                        setCameraVideoElement(el);
                      }}
                      onCameraReady={() => {
                        if (mountErrorTimerRef.current) {
                          clearTimeout(mountErrorTimerRef.current);
                          mountErrorTimerRef.current = null;
                        }
                        setCameraMountError(null);
                        cameraProblemRef.current = false;
                        setSkipNextFailedCameraId(null);
                      }}
                      onMountError={onWebMountError}
                    />
                  )}
                  <View className="absolute inset-0 bg-black/20" />
                </>
              ) : (
                <>
                  <View className="absolute inset-0 bg-black/40" />
                  <Camera size={48} color="rgba(255,255,255,0.5)" />
                </>
              )}

              {cameraMountError && (
                <View className="z-10 items-center px-8">
                  <Text className="text-center text-sm font-semibold text-white">
                    {t('live.cameraUnavailable')}
                  </Text>
                </View>
              )}
            </View>

            {/* Modality switch button */}
            <View className="absolute left-6 top-6 z-30">
              <TouchableOpacity
                className={`flex-row items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-2 ${state === SessionState.INITIALIZING ? 'opacity-50' : ''}`}
                disabled={state === SessionState.INITIALIZING}
                onPress={async () => {
                  const newPath = activePath === ModalityPath.SPEECH ? ModalityPath.SIGN : ModalityPath.SPEECH;
                  stopSession();
                  try {
                    await startSession(newPath);
                  } catch (e: unknown) {
                    if (__DEV__) console.warn('Modality switch failed', e);
                  }
                }}
              >
                {activePath === ModalityPath.SPEECH
                  ? <Hand size={14} color="#fff" />
                  : <Mic size={14} color="#fff" />
                }
                <Text className="text-xs font-semibold text-white">
                  {activePath === ModalityPath.SPEECH ? t('modality.sign') : t('modality.speech')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Active indicator */}
            <View className="absolute left-6 top-[88px] z-30 flex-row items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1.5">
              <View className={`h-2.5 w-2.5 rounded-full ${
                state === SessionState.RUNNING || state === SessionState.DEGRADED
                  ? 'bg-[#2ECC71]'
                  : state === SessionState.PAUSED
                    ? 'bg-yellow-400'
                    : 'bg-gray-400'
              }`} />
              <Text className="text-xs font-semibold text-white">
                {state === SessionState.RUNNING || state === SessionState.DEGRADED
                  ? (activePath === ModalityPath.SIGN ? t('live.reading') : t('live.listening'))
                  : state === SessionState.PAUSED
                    ? t('live.paused')
                    : t('live.idle')}
              </Text>
            </View>

            {/* Controls */}
            <View className="absolute right-6 top-6 z-30 flex-row items-center gap-3">
              <TouchableOpacity
                className={`h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60 ${shouldShowLiveCamera ? '' : 'opacity-50'}`}
                disabled={!shouldShowLiveCamera}
                onPress={() => { void switchCamera(); }}
              >
                <SwitchCamera size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                className="h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60"
                onPress={() => setShowSettings((v) => !v)}
              >
                <Settings size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                className="h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/60"
                disabled={state === SessionState.INITIALIZING}
                onPress={() => {
                  if (state === SessionState.RUNNING || state === SessionState.DEGRADED) {
                    pauseSession();
                  } else if (state === SessionState.PAUSED) {
                    resumeSession();
                  } else if (state === SessionState.IDLE || state === SessionState.ERROR) {
                    const path = activePath ?? ModalityPath.SPEECH;
                    void startSession(path).catch((e: unknown) => {
                      if (__DEV__) console.warn('Session start failed', e);
                    });
                  }
                }}
              >
                {state === SessionState.RUNNING || state === SessionState.DEGRADED || state === SessionState.INITIALIZING
                  ? <PauseCircle size={22} color="#fff" />
                  : <PlayCircle size={22} color="#fff" />
                }
              </TouchableOpacity>
              <TouchableOpacity
                className="h-12 w-12 items-center justify-center rounded-full border-2 border-red-400 bg-red-500"
                onPress={() => {
                  stopSession();
                  onBack();
                }}
              >
                <CircleX size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Settings popover — anchored below the controls row */}
            {showSettings && (
              <View className="absolute right-6 top-20 z-40 w-72 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95">
                {/* Fixed header */}
                <View className="flex-row items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
                  <Text className="font-bold text-gray-900 dark:text-gray-100">{t('live.settings')}</Text>
                  <TouchableOpacity onPress={() => setShowSettings(false)}>
                    <ChevronDown size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* Scrollable body */}
                <ScrollView className="max-h-36 px-5 py-3" showsVerticalScrollIndicator={false}>

                {/* Subtitle Size */}
                <View className="mb-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('live.subtitleSize')}</Text>
                    <Text className="text-xs font-bold text-[#2ECC71]">{textSize}%</Text>
                  </View>
                  <SimpleSlider 
                    value={textSize} 
                    onValueChange={setTextSize} 
                    min={50} 
                    max={150} 
                  />
                </View>

                </ScrollView>

                {/* Fixed footer */}
                <View className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 gap-2">
                  {__DEV__ && (
                    <TouchableOpacity
                      className={`items-center rounded-2xl py-2 ${demoActive ? 'bg-red-400/20 border border-red-300 dark:border-red-700' : 'bg-blue-400/20 border border-blue-300 dark:border-blue-700'}`}
                      onPress={toggleDemo}
                    >
                      <Text className={`text-sm font-semibold ${demoActive ? 'text-red-500' : 'text-blue-500'}`}>
                        {demoActive ? 'Stop Demo' : t('live.demo')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    className="items-center rounded-2xl border border-red-300 dark:border-red-700 py-2"
                    onPress={() => store.clear()}
                  >
                    <Text className="text-sm font-semibold text-red-500">{t('live.clearTranscript')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View className="absolute bottom-0 left-0 right-0 z-30" pointerEvents="box-none">
              {/* Subtitle box — max-h-56 caps growth so it never reaches the top controls */}
              <View className="mx-4 mb-6 max-h-56 rounded-3xl border-t-2 border-white/20 bg-black/75 px-6 py-4">
                <TranscriptView store={store} fontSize={baseFontSize} />
                <View className="mt-3 items-center">
                  <Text className="text-xs text-gray-400">
                    {t('live.session')} {sessionId ?? '—'} · {t('live.path')} {activePath ?? '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// SimpleSlider
// ---------------------------------------------------------------------------

function SimpleSlider({ value, onValueChange, min, max }: { value: number; onValueChange: (v: number) => void; min: number; max: number }) {
  const [width, setWidth] = useState(0);
  const percent = Math.max(0, Math.min(1, (value - min) / (max - min)));

  return (
    <View 
      className="h-10 w-full justify-center" 
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e) => {
        if (width > 0) {
          const x = e.nativeEvent.locationX;
          onValueChange(Math.round(min + Math.max(0, Math.min(1, x / width)) * (max - min)));
        }
      }}
      onResponderMove={(e) => {
        if (width > 0) {
          const x = e.nativeEvent.locationX;
          onValueChange(Math.round(min + Math.max(0, Math.min(1, x / width)) * (max - min)));
        }
      }}
    >
      <View className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700" pointerEvents="none">
        <View className="h-2 rounded-full bg-[#2ECC71]" style={{ width: `${percent * 100}%` }} />
      </View>
      <View 
        className="absolute h-6 w-6 rounded-full bg-white shadow-md border border-gray-200 dark:border-gray-600 dark:bg-gray-800" 
        style={{ left: `${percent * 100}%`, transform: [{ translateX: -12 }] }} 
        pointerEvents="none"
      />
    </View>
  );
}
