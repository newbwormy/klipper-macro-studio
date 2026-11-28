type TourTarget = "builder" | "library" | "printer" | "preview" | "code" | "export";

export interface TourStep {
  title: string;
  text: string;
  target?: TourTarget;
  view?: "builder" | "code";
}

export const tourStorageKey = "klipper-macro-studio.tour-complete";

export function initialTourStep(): number | null {
  try {
    return localStorage.getItem(tourStorageKey) ? null : 0;
  } catch {
    return 0;
  }
}

export function createTourSteps(browser: boolean): TourStep[] {
  const steps: TourStep[] = [
    { title: "Welcome to Klipper Macro Studio",
      text: "Use the sample macro to learn how to build, preview, and export a Klipper config. You can try the controls during the tour." },
    { title: "Build a macro", target: "builder", view: "builder",
      text: "Add a block, then edit its settings in the sequence. Use the arrows on a block to change its order." },
    { title: "Find a command", target: "library", view: "builder",
      text: "Open Command library and search by name or purpose. Try searching for “tap” with Eddy-NG selected as the source." },
  ];

  if (!browser) {
    steps.push({ title: "Set up the printer preview", target: "printer",
      text: "Import a printer.cfg or sync printer settings through Moonraker. You can also adjust the build volume and initial state here." });
  }

  steps.push(
    { title: "Preview the toolpath", target: "preview",
      text: browser
        ? "Press Play to watch the sample. Editing the macro previews its literal G-code. Drag the timeline to inspect a move."
        : "Press Play to watch the evaluated G-code. Drag the timeline to inspect a move and check the preview for diagnostics." },
    { title: "Inspect the generated code", target: "code", view: "code",
      text: "Review the Klipper config and the G-code used for preview. Switch back to Visual Builder to keep editing." },
    { title: "Export your macro", target: "export", view: "code",
      text: "Use Export .cfg to save the macro, or Copy Macro to paste it into your Klipper configuration." },
  );
  return steps;
}

export function FirstRunTour({ step, index, count, onNext, onBack, onClose }: {
  step: TourStep;
  index: number;
  count: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="tour" aria-label="Getting started tutorial">
      <div className="tour-instructions" aria-live="polite" aria-atomic="true">
        <span className="tour-progress">Step {index + 1} of {count}</span>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
      </div>
      <div className="tour-actions">
        <button type="button" onClick={onClose}>Skip tutorial</button>
        {index > 0 && <button type="button" onClick={onBack}>Back</button>}
        <button type="button" className="primary-button" onClick={onNext}>
          {index === 0 ? "Start tutorial" : index === count - 1 ? "Finish tutorial" : "Next"}
        </button>
      </div>
    </aside>
  );
}
