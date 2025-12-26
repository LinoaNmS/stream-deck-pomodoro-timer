import {
  action,
  KeyUpEvent,
  SingletonAction,
  WillAppearEvent,
  DidReceiveSettingsEvent,
} from "@elgato/streamdeck";

type PomodoroSettings = { focus_time?: number };
const DEFAULT_MINUTES = 25;
const LONG_PRESS_MS = 600;

@action({ UUID: "com.linoa.pomodoro-sd.pomodoro-timer" })
export class PomodoroTimer extends SingletonAction<PomodoroSettings> {
  private intervalId: NodeJS.Timeout | null = null;
  private pressStartTimestamp: number | null = null;

  private remainingSeconds: number = DEFAULT_MINUTES * 60;
  private targetDuration: number = DEFAULT_MINUTES * 60;

  override onWillAppear(ev: WillAppearEvent<PomodoroSettings>) {
    this.syncSettings(ev);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<PomodoroSettings>) {
    this.syncSettings(ev);
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

  private syncSettings(
    ev:
      | WillAppearEvent<PomodoroSettings>
      | DidReceiveSettingsEvent<PomodoroSettings>
  ) {
    const minutes = ev.payload.settings.focus_time ?? DEFAULT_MINUTES;
    this.targetDuration = minutes * 60;

    if (!this.intervalId) {
      this.remainingSeconds = this.targetDuration;
      this.updateDisplay(ev.action);
    }
  }

  private toggleTimer(action: any) {
    if (this.intervalId) {
      this.stop();
    } else {
      if (this.remainingSeconds <= 0)
        this.remainingSeconds = this.targetDuration;

      this.intervalId = setInterval(() => this.tick(action), 1000);
    }
  }

  private tick(action: any) {
    this.remainingSeconds--;
    this.updateDisplay(action);

    if (this.remainingSeconds <= 0) {
      this.stop();
      action.setTitle("Done");
    }
  }

  private reset(action: any) {
    this.stop();
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
