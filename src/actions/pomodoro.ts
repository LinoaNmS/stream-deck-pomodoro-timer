import {
  action,
  KeyDownEvent,
  KeyUpEvent,
  SingletonAction,
  WillAppearEvent,
} from "@elgato/streamdeck";

type PomodoroSettings = {
  timer?: number; // en minutes éventuellement (25, 15, etc.)
};

const DEFAULT_DURATION_SECONDS = 25 * 60; // 25 minutes
const LONG_PRESS_THRESHOLD_MS = 600; // au-delà de 600ms = "appui long"

@action({ UUID: "com.linoa.pomodoro-sd.pomodoro-timer" })
export class PomodoroTimer extends SingletonAction<PomodoroSettings> {
  private remaining: number = DEFAULT_DURATION_SECONDS;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  // pour différencier appui court / appui long
  private pressStartTimestamp: number | null = null;

  override onWillAppear(ev: WillAppearEvent<PomodoroSettings>) {
    ev.action.setTitle(this.formatTime(this.remaining));
  }

  override onKeyDown(ev: KeyDownEvent<PomodoroSettings>) {
    // on enregistre le moment où la touche est pressée
    this.pressStartTimestamp = Date.now();
  }

  override onKeyUp(ev: KeyUpEvent<PomodoroSettings>) {
    if (this.pressStartTimestamp === null) {
      return;
    }

    const pressDuration = Date.now() - this.pressStartTimestamp;
    this.pressStartTimestamp = null;

    // Appui long → reset
    if (pressDuration >= LONG_PRESS_THRESHOLD_MS) {
      this.reset(ev);
      return;
    }

    // Appui court → start / pause
    if (this.isRunning) {
      this.pause();
    } else {
      this.start(ev);
    }
  }

  private start(
    ev: KeyDownEvent<PomodoroSettings> | KeyUpEvent<PomodoroSettings>
  ) {
    // si déjà en cours, on ne relance pas
    if (this.isRunning) return;

    // si le timer est à 0, on repart du début
    if (this.remaining <= 0) {
      this.remaining = DEFAULT_DURATION_SECONDS;
    }

    this.isRunning = true;

    this.intervalId = setInterval(async () => {
      this.remaining--;

      await ev.action.setTitle(this.formatTime(this.remaining));

      if (this.remaining <= 0) {
        this.remaining = 0;
        // fin du timer → on stoppe tout
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        this.isRunning = false;
        // tu peux ajouter ici un son / une notif si tu veux
      }
    }, 1000);
  }

  private pause() {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // on garde `remaining` tel quel, pour pouvoir reprendre plus tard
  }

  private reset(ev: KeyUpEvent<PomodoroSettings>) {
    // stoppe le timer s'il tourne
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.remaining = DEFAULT_DURATION_SECONDS;

    ev.action.setTitle(this.formatTime(this.remaining));
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
}
