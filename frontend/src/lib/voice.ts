// Tactical Synthetic Voice Announcer using browser-native Web Speech API
class TacticalVoiceService {
  private synth: SpeechSynthesis | null = null;
  public enabled: boolean = true;
  private lastSpokenText: string = "";
  private lastSpokenTime: number = 0;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public speak(text: string, force: boolean = false) {
    if (!this.enabled || !this.synth) return;

    // Debounce duplicate messages within 4 seconds
    const now = Date.now();
    if (!force && this.lastSpokenText === text && now - this.lastSpokenTime < 4000) {
      return;
    }

    this.lastSpokenText = text;
    this.lastSpokenTime = now;

    try {
      // Cancel previous speech if queuing high-priority warning
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05; // Crisp military cadence
      utterance.pitch = 0.95; // Authoritative command tone
      utterance.volume = 0.9;

      // Select preferred English voice
      const voices = this.synth.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("David") ||
            v.name.includes("Mark") ||
            v.name.includes("Google US English") ||
            v.name.includes("Samantha"))
      );
      if (preferred) {
        utterance.voice = preferred;
      }

      this.synth.speak(utterance);
    } catch {
      // SpeechSynthesis may be restricted until first user interaction
    }
  }

  public cancel() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const tacticalVoice = new TacticalVoiceService();
