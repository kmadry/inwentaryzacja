"use client";

import { useActionState } from "react";
import { calibrateAction, tareAction, type ActionState } from "@/app/actions";

function Result({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p key={state.at} className={state.ok ? "msg msg--ok" : "msg msg--err"} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}

export function TareForm() {
  const [state, action, pending] = useActionState(tareAction, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Wyzerować wagę? Platforma musi być pusta (bez skrzynek i butelek) od co najmniej kilku minut.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn btn--accent" disabled={pending}>
        {pending ? "Zeruję…" : "Wyzeruj pustą wagę"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function CalibrateForm() {
  const [state, action, pending] = useActionState(calibrateAction, null);
  return (
    <form action={action} className="calib">
      <label htmlFor="mass_g">Na wadze leży znana masa [g]</label>
      <div className="row">
        <input id="mass_g" name="mass_g" inputMode="decimal" autoComplete="off" placeholder="np. 16440" required />
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Liczę…" : "Kalibruj"}
        </button>
      </div>
      <Result state={state} />
    </form>
  );
}
