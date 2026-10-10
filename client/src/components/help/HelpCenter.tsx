import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, Compass, HelpCircle, Minimize2, X } from "lucide-react";
import type { NavTab } from "../layout/Sidebar";
import { pageHelp, welcomeSteps, type GuideStep, type TaskGuide } from "./guideContent";
import { allTaskGuides, pageTours } from "./workflowGuides";
import { useGuideResources } from "./GuideDataContext";
import { getSetupSteps, guideSupport, needsGuideSetup } from "./guidePrerequisites";
import { GuidePreview } from "./GuidePreview";
import { isGuideSandbox } from "./sandbox/runtime";
import "./help.css";

interface HelpCenterProps {
  userId: number;
  role: string;
  currentTab: NavTab;
  openRequest: number;
  onNavigate: (tab: NavTab) => void;
  isTabAllowed: (tab: NavTab) => boolean;
  initialGuide?: TaskGuide;
  initialGuideStep?: number;
}

// Storage can be unavailable in private or locked-down desktop sessions.
function readSeen(key: string): boolean {
  try { return localStorage.getItem(key) === "seen"; } catch { return false; }
}

interface SpotlightRect { top: number; left: number; width: number; height: number }

function getSpotlightRect(element: HTMLElement): SpotlightRect | null {
  const rect = element.getBoundingClientRect();
  let top = Math.max(0, rect.top - 8);
  let left = Math.max(0, rect.left - 8);
  let right = Math.min(window.innerWidth, rect.right + 8);
  let bottom = Math.min(window.innerHeight, rect.bottom + 8);
  // A field can extend behind a scrolling page or form; only reveal its visible part.
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      left = Math.max(left, bounds.left);
      right = Math.min(right, bounds.right);
    }
  }
  if (right <= left || bottom <= top) return null;
  return { top, left, width: right - left, height: bottom - top };
}

function findGuideTarget(name: string): HTMLElement | undefined {
  const modals = Array.from(document.querySelectorAll<HTMLElement>('[data-modal-panel]'))
    .filter(element => element.getClientRects().length > 0);
  const modal = modals[modals.length - 1];
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-guide="${name}"]`))
    .find(candidate => {
      const rect = candidate.getBoundingClientRect();
      return (!modal || modal.contains(candidate)) && candidate.getClientRects().length > 0
        && rect.width > 0 && rect.height > 0
        && (name !== "navigation" || (rect.right > 0 && rect.left < innerWidth));
    });
}

function useGuideTarget(step?: GuideStep, paused = false, attempt = 0, nextTarget?: string) {
  const [found, setFound] = useState(false);
  const [nextAvailable, setNextAvailable] = useState(false);
  const [dockLeft, setDockLeft] = useState<number | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  useEffect(() => {
    setFound(false);
    setNextAvailable(false);
    setDockLeft(null);
    setSpotlight(null);
    if (!step?.target || paused) return;
    // Only close the read-only passage reader, never an application/edit form.
    if (step.dismiss) findGuideTarget(step.dismiss)?.click();
    let revealed = false;
    const attempted = new Set<string>();
    let highlighted: HTMLElement | undefined;
    let frame = 0;
    const resizeObserver = new ResizeObserver(() => schedule());
    const update = () => {
      const element = findGuideTarget(step.target!);
      // Opening a form can hide the button from the preceding step. Allow
      // advancing when its next field is already available in that form.
      setNextAvailable(Boolean(nextTarget && findGuideTarget(nextTarget)));
      // Once reached, respect the user's decision to cancel/close this form.
      if (element) revealed = true;
      if (!element && step.reveal && !revealed) {
        const openers = Array.isArray(step.reveal) ? step.reveal : [step.reveal];
        for (const name of openers) {
          if (attempted.has(name)) continue;
          const opener = findGuideTarget(name);
          if (opener instanceof HTMLButtonElement && !opener.disabled) {
            attempted.add(name);
            if (opener.getAttribute("aria-expanded") === "true" || opener.getAttribute("aria-pressed") === "true") continue;
            opener.click();
            schedule();
            break;
          }
        }
      }
      if (element !== highlighted) {
        if (highlighted) resizeObserver.unobserve(highlighted);
        highlighted?.removeAttribute("data-guide-highlight");
        highlighted = element;
        setFound(Boolean(element));
        if (element) {
          element.setAttribute("data-guide-highlight", "true");
          element.scrollIntoView({ block: element.getBoundingClientRect().height > innerHeight * .6 ? "start" : "center", inline: "nearest", behavior: "instant" });
          resizeObserver.observe(element);
        }
      }
      const nextSpotlight = element ? getSpotlightRect(element) : null;
      setSpotlight(previous => {
        if (!previous || !nextSpotlight) return previous === nextSpotlight ? previous : nextSpotlight;
        return (Object.keys(previous) as (keyof SpotlightRect)[]).every(key => Math.abs(previous[key] - nextSpotlight[key]) < .5) ? previous : nextSpotlight;
      });
      const panel = document.querySelector<HTMLElement>(".help-guide-panel");
      if (element && panel && window.innerWidth >= 768) {
        const targetRect = element.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const rightDockLeft = window.innerWidth - 20 - panelRect.width;
        const leftDock = Math.max(20, (document.querySelector('main')?.getBoundingClientRect().left ?? 0) + 20);
        // Move to the other corner when the usual position would cover a control.
        setDockLeft(targetRect.left > leftDock + panelRect.width + 20 && targetRect.right > rightDockLeft && targetRect.bottom > panelRect.top ? leftDock : null);
      } else setDockLeft(null);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    update();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
      highlighted?.removeAttribute("data-guide-highlight");
    };
  }, [step, paused, attempt, nextTarget]);
  return { found, nextAvailable, dockLeft, spotlight };
}

function GuideSpotlight({ rect }: { rect: SpotlightRect }) {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  // Four separate backdrop panes leave the real control clear and interactive.
  // Raising/cloning the control would break menus, inputs, and modal stacking.
  return <div className="help-spotlight" aria-hidden="true">
    <div className="help-spotlight-shade" style={{ top: 0, left: 0, right: 0, height: rect.top }} />
    <div className="help-spotlight-shade" style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} />
    <div className="help-spotlight-shade" style={{ top: rect.top, left: right, right: 0, height: rect.height }} />
    <div className="help-spotlight-shade" style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
    <div className="help-spotlight-frame" style={rect} />
  </div>;
}

export const HelpCenter: React.FC<HelpCenterProps> = ({ userId, role, currentTab, openRequest, onNavigate, isTabAllowed, initialGuide, initialGuideStep = 0 }) => {
  const storageKey = `dpc_help_welcome_v1:${userId}:${role}`;
  const [view, setView] = useState<"home" | "page" | "guide" | "preview" | null>(null);
  const [isWelcome, setIsWelcome] = useState(false);
  const [task, setTask] = useState<TaskGuide | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [guideSearch, setGuideSearch] = useState("");
  const resources = useGuideResources();
  const [setupActive, setSetupActive] = useState(false);
  const [setupIndex, setSetupIndex] = useState(0);
  const [targetAttempt, setTargetAttempt] = useState(0);
  const [returnGuide, setReturnGuide] = useState<{ guide: TaskGuide; index: number } | null>(null);
  const [previewGuide, setPreviewGuide] = useState<TaskGuide | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewReturn = useRef<"page" | "guide">("page");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guideRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const expectedTab = useRef(currentTab);
  const permittedStep = (item: GuideStep) => (!item.roles || item.roles.includes(role)) && (!item.tab || isTabAllowed(item.tab));
  const tasks = allTaskGuides.filter(guide => guide.roles.includes(role) && isTabAllowed(guide.tab));
  const search = guideSearch.trim().toLowerCase();
  const visibleTasks = tasks.filter(guide => `${guide.title} ${guide.description} ${pageHelp[guide.tab].title}`.toLowerCase().includes(search));
  const help = pageHelp[currentTab];
  const pageGuide: TaskGuide = {
    id: `page-${currentTab}`, title: help.title, description: help.description, tab: currentTab, roles: [role],
    steps: pageTours[currentTab].filter(permittedStep),
  };
  const info = guideSupport[currentTab];
  const snapshot = info ? resources[info.resource] : undefined;
  const setupGuides = tasks.filter(guide => info?.setupGuides.includes(guide.id));
  const pageNeedsSetup = Boolean(info && needsGuideSetup(pageGuide, snapshot));
  const pageSteps = pageNeedsSetup && info ? getSetupSteps(info, snapshot, setupGuides.length > 0) : pageGuide.steps;
  const isModal = view === "home" || view === "page" || view === "preview";
  const needsSetup = Boolean(task && info && needsGuideSetup(task, snapshot));
  const showingSetup = Boolean(task && info && (needsSetup || setupActive));
  const baseSteps = task?.steps ?? welcomeSteps;
  const setupSteps = React.useMemo(() => info ? getSetupSteps(info,
    task && !needsSetup && snapshot ? { ...snapshot, status: "ready" } : snapshot,
    setupGuides.length > 0) : [], [info, snapshot, setupGuides.length, task, needsSetup]);
  const steps = showingSetup ? setupSteps : baseSteps;
  const activeIndex = Math.min(showingSetup ? setupIndex : stepIndex, Math.max(0, steps.length - 1));
  const step = view === "guide" ? steps[activeIndex] : undefined;
  const { found, nextAvailable, dockLeft, spotlight } = useGuideTarget(step, minimized || view === "preview", targetAttempt, steps[activeIndex + 1]?.target);
  const missingTarget = !showingSetup && Boolean(step?.target && !found && !nextAvailable);

  useEffect(() => {
    if (view === "guide" && needsSetup && snapshot?.status !== "loading") setSetupActive(true);
  }, [view, needsSetup, snapshot?.status]);

  useEffect(() => {
    const welcome = !readSeen(storageKey);
    setIsWelcome(welcome);
    setView(welcome ? "home" : null);
    setTask(null);
    setStepIndex(0);
    setMinimized(false);
    setSetupActive(false);
    setReturnGuide(null);
  }, [storageKey]);

  useEffect(() => {
    if (openRequest > 0) { setTask(null); setView("home"); setMinimized(false); setReturnGuide(null); setSetupActive(false); }
  }, [openRequest]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isModal && dialog && !dialog.open) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.showModal();
    } else if (!isModal && dialog?.open) {
      dialog.close();
    }
  }, [isModal]);

  useEffect(() => {
    if (view === "guide" && !minimized) guideRef.current?.focus({ preventScroll: true });
  }, [view, minimized]);

  // Navigating elsewhere ends a task so instructions never describe the wrong page.
  useEffect(() => {
    if (view === "guide" && task && currentTab !== expectedTab.current) {
      setView(null);
      setTask(null);
      setReturnGuide(null);
      setSetupActive(false);
    }
  }, [currentTab, task, view]);

  const rememberWelcome = () => {
    try { localStorage.setItem(storageKey, "seen"); } catch { /* Help still works without storage. */ }
    setIsWelcome(false);
  };
  const close = () => {
    rememberWelcome();
    dialogRef.current?.close();
    setView(null);
    setTask(null);
    setMinimized(false);
    setReturnGuide(null);
    setSetupActive(false);
    setPreviewGuide(null);
    const focus = previousFocus.current;
    if (focus?.isConnected && focus !== document.body && focus.closest("dialog") === null) focus.focus({ preventScroll: true });
    else (launcherRef.current ?? document.querySelector<HTMLButtonElement>('[data-guide="help-launcher"]'))?.focus({ preventScroll: true });
  };
  const openHome = () => { setTask(null); setView("home"); setMinimized(false); setReturnGuide(null); setSetupActive(false); };
  const startGuide = (guide: TaskGuide | null, initialStep = 0, initialSetupStep = 0) => {
    rememberWelcome();
    const allowedGuide = guide ? { ...guide, steps: guide.steps.filter(permittedStep) } : null;
    const guideInfo = guide ? guideSupport[guide.tab] : undefined;
    const startInSetup = Boolean(guide && guideInfo && needsGuideSetup(guide, resources[guideInfo.resource]));
    setTask(allowedGuide);
    setStepIndex(initialStep);
    setSetupIndex(startInSetup ? initialSetupStep : 0);
    setSetupActive(startInSetup && resources[guideInfo!.resource]?.status !== "loading");
    setMinimized(false);
    if (allowedGuide) {
      expectedTab.current = startInSetup ? allowedGuide.tab : allowedGuide.steps[initialStep]?.tab ?? allowedGuide.tab;
      onNavigate(expectedTab.current);
    }
    setView("guide");
  };
  const goToStep = (index: number) => {
    if (showingSetup) { setSetupIndex(index); return; }
    if (task) {
      expectedTab.current = steps[index].tab ?? task.tab;
      if (currentTab !== expectedTab.current) onNavigate(expectedTab.current);
    }
    setStepIndex(index);
  };
  const startPrerequisite = (guide: TaskGuide) => {
    if (task) setReturnGuide(previous => previous ?? { guide: task, index: stepIndex });
    startGuide(guide);
  };
  const returnToOriginal = () => {
    if (!returnGuide) return;
    const original = returnGuide;
    setReturnGuide(null);
    startGuide(original.guide, original.index);
  };
  const openPreview = (guide: TaskGuide) => {
    previewReturn.current = view === "guide" ? "guide" : "page";
    setPreviewGuide({ ...guide, steps: guide.steps.filter(permittedStep) });
    setPreviewIndex(view === "guide" && task?.id === guide.id ? stepIndex : 0);
    setView("preview");
  };
  const closePreview = () => { setView(previewReturn.current); setPreviewGuide(null); };
  const continueWalkthrough = () => { setSetupActive(false); setSetupIndex(0); setTargetAttempt(previous => previous + 1); };
  const advance = () => {
    if (activeIndex < steps.length - 1) { goToStep(activeIndex + 1); return; }
    if (showingSetup) {
      if (!needsSetup) continueWalkthrough();
      else snapshot?.retry?.();
    } else if (returnGuide) returnToOriginal();
    else close();
  };

  useEffect(() => {
    if (!initialGuide) return;
    startGuide(initialGuide, Math.min(initialGuideStep, initialGuide.steps.filter(permittedStep).length - 1));
  }, [initialGuide, initialGuideStep]);

  return (
    <>
      {currentTab !== "dashboard" && <div className="help-page-bar">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline text-xs text-muted">Step-by-step guides for your {role.toLowerCase()} role</span>
        </div>
        <button ref={launcherRef} type="button" onClick={() => setView("page")} className="help-text-button flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">How to use this page</span><span className="sm:hidden">Page help</span>
        </button>
      </div>}

      {role === "Member" && currentTab === "biblereading" && (
        <section aria-label="Getting started" className="help-shortcuts">
          <div>
            <h2 className="text-sm font-semibold text-charcoal">What would you like to do?</h2>
            <p className="text-xs text-muted mt-1">Choose a task and follow the steps on screen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tasks.slice(0, 3).map(guide => (
              <button key={guide.id} type="button" onClick={() => startGuide(guide)} className="help-task-shortcut">{guide.title}<ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></button>
            ))}
          </div>
        </section>
      )}

      {createPortal(
        <>
          <dialog ref={dialogRef} className={`help-dialog${view === "preview" ? " help-dialog--preview" : ""}`} aria-labelledby="help-dialog-title" onCancel={event => { event.preventDefault(); view === "preview" ? closePreview() : close(); }} onClick={event => { if (event.target === event.currentTarget) view === "preview" ? closePreview() : close(); }} onKeyDown={event => {
            if (event.key !== "Tab") return;
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), iframe"));
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }}>
            <div className="help-dialog-content">
              <div className="help-dialog-header flex items-start justify-between gap-4" data-modal-header>
                <div>
                  <p className="help-eyebrow">{view === "preview" ? "Interactive demo · Sample account" : view === "page" ? "Page guide" : `${role} workspace`}</p>
                  <h2 id="help-dialog-title" className="text-xl sm:text-2xl font-semibold text-charcoal mt-1">{view === "preview" ? previewGuide?.title : view === "page" ? help.title : isWelcome ? "Welcome to DPC" : "Start Here"}</h2>
                </div>
                <button type="button" className="help-icon-button" aria-label={view === "preview" ? "Close sample preview" : "Close help"} onClick={view === "preview" ? closePreview : close}><X className="w-5 h-5" /></button>
              </div>
              <div className="help-dialog-body" data-modal-body>
              {view === "preview" && previewGuide ? <GuidePreview guide={previewGuide} role={role} index={Math.min(previewIndex, previewGuide.steps.length - 1)} onClose={closePreview} /> : view === "page" ? (
                <>
                  <p className="help-description">{help.description}</p>
                  <p className="help-description">{pageNeedsSetup ? "Complete the setup for this page first, or explore its full walkthrough with sample data." : "Choose a step to go directly to its page control."}</p>
                  <ol className="help-page-steps">{pageSteps.map((item, index) => <li key={item.title}><button type="button" className="help-page-step" onClick={() => pageNeedsSetup ? startGuide(pageGuide, 0, index) : startGuide(pageGuide, index)}><span className="help-step-number" aria-hidden="true">{index + 1}</span><span><strong>{item.title}</strong><span>{item.text}</span></span><ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" /></button></li>)}</ol>
                  {!isGuideSandbox() && <button type="button" className="help-secondary w-full mt-3" onClick={() => openPreview(pageGuide)}>Preview with sample data</button>}
                  {tasks.filter(guide => guide.tab === currentTab).map(guide => <button key={guide.id} type="button" className="help-primary w-full mt-3" onClick={() => startGuide(guide)}>Guide me: {guide.title}<ArrowRight className="w-4 h-4" /></button>)}
                  <button type="button" className="help-secondary w-full mt-3" onClick={openHome}>See all guides</button>
                </>
              ) : (
                <>
                  <p className="help-description">Learn where things are, or choose a task to get step-by-step help while you work.</p>
                  <button type="button" className="help-secondary w-full mb-3" onClick={() => setView("page")}><HelpCircle className="w-4 h-4" aria-hidden="true" />How to use this page</button>
                  <button type="button" className="help-tour-button" onClick={() => startGuide(null)}><Compass className="w-5 h-5 shrink-0" aria-hidden="true" /><span><strong>{isWelcome ? "Take a quick welcome tour" : "Show the welcome tour again"}</strong><small>Four short steps to find your way around.</small></span><ArrowRight className="w-4 h-4 shrink-0" /></button>
                  <h3 className="text-sm font-semibold text-charcoal mt-6 mb-3">Choose a task</h3>
                  <label className="help-guide-search">Find a guide<input type="search" value={guideSearch} onChange={event => setGuideSearch(event.target.value)} placeholder="Search tasks or pages…" /></label>
                  <div className="help-task-grid">{visibleTasks.map(guide => <button key={guide.id} type="button" className="help-task-card" onClick={() => startGuide(guide)}><BookOpen className="w-4 h-4 text-indigo-600" aria-hidden="true" /><strong>{guide.title}</strong><span>{guide.description}</span><small>{pageHelp[guide.tab].title} · {guide.steps.length} steps</small></button>)}</div>
                  {visibleTasks.length === 0 && <p className="help-description">No matching guides. Try a page name or another task.</p>}
                  <button type="button" className="help-secondary w-full mt-5" onClick={close}>{isWelcome ? "Skip for now" : "Close guides"}</button>
                  <p className="text-xs text-muted mt-3 text-center">Reopen these guides any time using Start Here.</p>
                </>
              )}
              </div>
            </div>
          </dialog>

          {view === "guide" && !minimized && spotlight && <GuideSpotlight rect={spotlight} />}
          {view === "guide" && step && (minimized ? (
            <button type="button" className="help-resume" onClick={() => setMinimized(false)}><Compass className="w-4 h-4" />Resume guide · {activeIndex + 1}/{steps.length}</button>
          ) : (
            <section ref={guideRef} tabIndex={-1} className="help-guide-panel" data-guide-mode={showingSetup ? snapshot?.status === "error" ? "error" : snapshot?.status === "loading" ? "loading" : "setup" : "walkthrough"} data-dock-left={dockLeft !== null} style={dockLeft !== null ? { left: dockLeft } : undefined} aria-label={task?.title ?? "Welcome tour"} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
              <div data-modal-header className="flex items-center justify-between gap-3">
                <p className="help-eyebrow">{task?.title ?? "Welcome tour"}</p>
                <div className="flex gap-1">
                  <button type="button" className="help-icon-button" aria-label="Minimize guide" onClick={() => setMinimized(true)}><Minimize2 className="w-4 h-4" /></button>
                  <button type="button" className="help-icon-button" aria-label="Close guide" onClick={close}><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="help-guide-body" data-modal-body>
              {showingSetup && <p className="help-guide-state-label">{snapshot?.status === "error" ? "Loading failed" : snapshot?.status === "loading" ? "Loading page…" : "Setup before walkthrough"}</p>}
              <nav className="help-step-navigation" aria-label="Guide steps">{steps.map((item, index) => <button key={item.title} type="button" aria-label={`Go to step ${index + 1}: ${item.title}`} aria-current={index === activeIndex ? "step" : undefined} onClick={() => goToStep(index)}>{index + 1}</button>)}</nav>
              <div aria-live="polite" aria-atomic="true">
                <p className="text-xs text-muted mt-2">Step {activeIndex + 1} of {steps.length}</p>
                <h2 className="text-base font-semibold text-charcoal mt-1">{step.title}</h2>
                <p className="help-description">{step.text}</p>
                {step.details && <ul className="help-step-details">{step.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
                {missingTarget && <p className="help-prerequisite">{step.missing ?? "This control is not available yet. Complete the preceding setup or select the intended record, then check this step again."}</p>}
                {showingSetup && <>
                  {snapshot?.retry && <button type="button" disabled={snapshot.status === "loading"} className="help-secondary w-full mt-3" onClick={() => snapshot.retry?.()}>{snapshot.status === "error" ? "Retry loading" : "Refresh page data"}</button>}
                  {(snapshot?.status === "empty" || snapshot?.status === "filtered") && setupGuides.filter(guide => guide.id !== task?.id).map(guide => <button key={guide.id} type="button" className="help-primary w-full mt-3" onClick={() => startPrerequisite(guide)}>{guide.id === "assign-group" ? "Open group assignment guide" : `Open setup guide: ${guide.title}`}</button>)}
                </>}
                {missingTarget && <button type="button" className="help-secondary w-full mt-3" onClick={() => setTargetAttempt(previous => previous + 1)}>Check this step again</button>}
                {task && !isGuideSandbox() && <button type="button" className="help-secondary w-full mt-3" onClick={() => openPreview(task)}>Preview with sample data</button>}
                {returnGuide && <button type="button" className="help-secondary w-full mt-3" onClick={returnToOriginal}>Return to {returnGuide.guide.title}</button>}
              </div>
              <div className="help-progress" role="progressbar" aria-label="Guide progress" aria-valuenow={activeIndex + 1} aria-valuemin={0} aria-valuemax={steps.length}><span style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }} /></div>
              </div>
              <div className="flex items-center justify-between gap-2 mt-4">
                <button type="button" className="help-secondary" disabled={activeIndex === 0} onClick={() => goToStep(activeIndex - 1)}><ArrowLeft className="w-4 h-4" />Back</button>
                <button type="button" className="help-primary" disabled={missingTarget || (showingSetup && snapshot?.status === "loading")} onClick={advance}>{activeIndex === steps.length - 1 ? showingSetup ? needsSetup ? "Check readiness" : "Continue walkthrough" : "Finish guide" : "Next step"}<ArrowRight className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-muted mt-3">{isGuideSandbox() ? "Practice with the sample controls. Changes stay in this demo and are discarded when you close or restart it." : "Use the real page controls to complete your work. Guides and sample previews do not save records. You can minimize this guide while working."}</p>
            </section>
          ))}
        </>, document.body,
      )}
    </>
  );
};
