import { Observable } from "./Observable";

/** A simple observable event that can be triggered externally. */
export class ObservableEvent extends Observable {
  /** Notify that the observable changed. */
  public changed(): void {
    this.notifyOnChange();
  }
}
