(function () {
  function resolve(target) {
    if (!target) return null;
    if (typeof target === "string") return document.getElementById(target);
    return target;
  }

  function show(target, hiddenClass) {
    const el = resolve(target);
    if (!el) return;
    el.classList.remove(hiddenClass || "hidden");
  }

  function hide(target, hiddenClass) {
    const el = resolve(target);
    if (!el) return;
    el.classList.add(hiddenClass || "hidden");
  }

  function setError(target, message, hiddenClass) {
    const el = resolve(target);
    if (!el) return;
    if (!message) {
      el.textContent = "";
      hide(el, hiddenClass);
      return;
    }
    el.textContent = message;
    show(el, hiddenClass);
  }

  function intFromInput(target, min, fallback) {
    const el = resolve(target);
    const floorMin = Number.isFinite(min) ? Math.floor(min) : 1;
    const safeFallback = Number.isFinite(fallback) ? Math.floor(fallback) : floorMin;
    const raw = el ? Number(el.value) : safeFallback;
    const parsed = Math.floor(raw);
    if (!Number.isFinite(parsed)) return Math.max(floorMin, safeFallback);
    return Math.max(floorMin, parsed);
  }

  function inSelectOptions(selectEl, value) {
    const el = resolve(selectEl);
    if (!el || !el.options) return false;
    return Array.from(el.options).some((opt) => opt.value === value);
  }

  function validateSelectPair(fromEl, toEl) {
    const from = resolve(fromEl);
    const to = resolve(toEl);
    const fromValue = from ? from.value : "";
    const toValue = to ? to.value : "";

    if (!fromValue || !toValue) return { ok: false, msg: "Select both From and To stops." };
    if (!inSelectOptions(from, fromValue) || !inSelectOptions(to, toValue)) {
      return { ok: false, msg: "Select stops from the available list." };
    }
    if (fromValue === toValue) return { ok: false, msg: "From and To stops must be different." };
    return { ok: true };
  }

  function validateWholeNumber(value, min, fieldLabel) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min) {
      return {
        ok: false,
        msg: fieldLabel + " must be a whole number of " + min + " or more."
      };
    }
    return { ok: true };
  }

  window.CCValidation = {
    show,
    hide,
    setError,
    intFromInput,
    inSelectOptions,
    validateSelectPair,
    validateWholeNumber
  };
})();
