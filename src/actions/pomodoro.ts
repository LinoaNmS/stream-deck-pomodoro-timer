import {
  action,
  KeyUpEvent,
  SingletonAction,
  WillAppearEvent,
  DidReceiveSettingsEvent,
} from "@elgato/streamdeck";

type PomodoroSettings = {
  focus_time?: number;
  short_break_time?: number;
  long_break_time?: number;
};

enum PomodoroPhase {
  IDLE,
  WORK,
  SHORT_BREAK,
  LONG_BREAK,
}

const DEFAULT_MINUTES = 25;
const LONG_PRESS_MS = 600;

@action({ UUID: "com.linoa.pomodoro-sd.pomodoro-timer" })
export class PomodoroTimer extends SingletonAction<PomodoroSettings> {
  private intervalId: NodeJS.Timeout | null = null;
  private pressStartTimestamp: number | null = null;
  private currentSettings: PomodoroSettings = {};
  private pomodoroCount: number = 0;

  private pomodoroState: PomodoroPhase = PomodoroPhase.IDLE;
  private remainingSeconds: number = DEFAULT_MINUTES * 60;
  private targetDuration: number = DEFAULT_MINUTES * 60;

  override onWillAppear(ev: WillAppearEvent<PomodoroSettings>) {
    this.updateSettingsAndDisplay(ev.payload.settings, ev.action);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PomodoroSettings>) {
    this.updateSettingsAndDisplay(ev.payload.settings, ev.action);
  }

  override onKeyDown() {
    this.pressStartTimestamp = Date.now();
  }

  override onKeyUp(ev: KeyUpEvent<PomodoroSettings>) {
    if (!this.pressStartTimestamp) return;

    const isLongPress = Date.now() - this.pressStartTimestamp > LONG_PRESS_MS;
    this.pressStartTimestamp = null;

    if (isLongPress) {
      this.reset(ev.action);
    } else {
      this.toggleTimer(ev.action);
    }
  }

  private updateSettingsAndDisplay(settings: PomodoroSettings, action: any) {
    this.currentSettings = settings;
    if (!this.intervalId) {
      this.targetDuration = this.getDurationForPhase(this.pomodoroState);
      this.remainingSeconds = this.targetDuration;
      this.updateDisplay(action);
    }
  }

  private toggleTimer(action: any) {
    if (this.intervalId) {
      this.stop();
    } else {
      if (this.pomodoroState === PomodoroPhase.IDLE) {
        this.pomodoroState = PomodoroPhase.WORK;
        this.targetDuration = this.getDurationForPhase(PomodoroPhase.WORK);
        this.remainingSeconds = this.targetDuration;
      }

      this.intervalId = setInterval(() => this.tick(action), 1000);
    }
  }

  private tick(action: any) {
    this.remainingSeconds--;
    this.updateDisplay(action);

    if (this.remainingSeconds <= 0) {
      this.stop();
      this.switchToNextPhase(action);
    }
  }

  private switchToNextPhase(action: any) {
    if (this.pomodoroState === PomodoroPhase.WORK) {
      this.pomodoroCount++;

      if (this.pomodoroCount >= 4) {
        this.pomodoroState = PomodoroPhase.LONG_BREAK;
        this.pomodoroCount = 0;
        action.setTitle("Long\nBreak");
      } else {
        this.pomodoroState = PomodoroPhase.SHORT_BREAK;
        action.setTitle("Short\nBreak");
      }
    } else {
      this.pomodoroState = PomodoroPhase.WORK;
      action.setTitle("Go\nWork");
    }

    this.targetDuration = this.getDurationForPhase(this.pomodoroState);
    this.remainingSeconds = this.targetDuration;
  }

  private getDurationForPhase(phase: PomodoroPhase): number {
    let minutes = 25;

    switch (phase) {
      case PomodoroPhase.IDLE:
      case PomodoroPhase.WORK:
        minutes = this.currentSettings.focus_time ?? 25;
        break;
      case PomodoroPhase.SHORT_BREAK:
        minutes = this.currentSettings.short_break_time ?? 5;
        break;
      case PomodoroPhase.LONG_BREAK:
        minutes = this.currentSettings.long_break_time ?? 15;
        break;
    }
    return minutes * 60;
  }

  private reset(action: any) {
    this.stop();
    this.pomodoroState = PomodoroPhase.IDLE;
    this.pomodoroCount = 0;

    this.targetDuration = this.getDurationForPhase(PomodoroPhase.WORK);
    this.remainingSeconds = this.targetDuration;

    this.updateDisplay(action);
  }

  private stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updateDisplay(action: any) {
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    action.setTitle(`${m}:${s.toString().padStart(2, "0")}`);
  }
}
